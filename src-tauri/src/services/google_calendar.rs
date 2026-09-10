//! Google Calendar integration service.
//!
//! Implements a one-way sync (app -> Google Calendar) using OAuth 2.0
//! Authorization Code flow with PKCE, suitable for desktop apps.
//!
//! Tokens and configuration live in the existing `settings` key-value table:
//!   - google_calendar_enabled   ("true" / "false")
//!   - google_client_id
//!   - google_client_secret      (optional for PKCE, Google still issues one for Desktop apps)
//!   - google_refresh_token
//!   - google_access_token
//!   - google_token_expiry       (RFC3339 UTC instant when the access token expires)
//!   - google_calendar_id        (defaults to "primary")
//!   - google_account_email      (informational, shown in UI)

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use rusqlite::Connection;
use sha2::{Digest, Sha256};

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://www.googleapis.com/oauth2/v3/userinfo";
const CALENDAR_API: &str = "https://www.googleapis.com/calendar/v3/calendars";
const SCOPE: &str = "https://www.googleapis.com/auth/calendar.events openid email profile";

/// Local ports we try to bind for the OAuth redirect (must match the
/// redirect URIs allowed by a Desktop OAuth client, which accepts any loopback port).
const CALLBACK_PORTS: [u16; 5] = [8412, 8413, 8414, 8415, 8416];

/// OAuth client for the distributed app (Model A: one client for all installs;
/// each user connects their own Google account). The credentials are injected
/// at build time from environment variables (populated from GitHub Secrets in
/// CI) so they never live in the source tree or git history.
///
/// For local development you can export GOOGLE_OAUTH_CLIENT_ID /
/// GOOGLE_OAUTH_CLIENT_SECRET before building, or configure them at runtime via
/// the "Opciones avanzadas" in Settings. When unset, these resolve to empty
/// strings and the app falls back to any per-install override in `settings`.
const DEFAULT_CLIENT_ID: &str = match option_env!("GOOGLE_OAUTH_CLIENT_ID") {
    Some(v) => v,
    None => "",
};
const DEFAULT_CLIENT_SECRET: &str = match option_env!("GOOGLE_OAUTH_CLIENT_SECRET") {
    Some(v) => v,
    None => "",
};

/// Effective client id: stored override if present, otherwise the build-time default.
/// May be empty if neither is configured.
fn client_id(conn: &Connection) -> String {
    get_setting(conn, "google_client_id")
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string())
}

/// Effective client secret: stored override if present, otherwise the embedded default.
fn client_secret(conn: &Connection) -> Option<String> {
    get_setting(conn, "google_client_secret").or_else(|| {
        if DEFAULT_CLIENT_SECRET.is_empty() {
            None
        } else {
            Some(DEFAULT_CLIENT_SECRET.to_string())
        }
    })
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .filter(|v| !v.is_empty())
}

fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![key, value],
    )
    .map_err(|e| format!("Error al guardar {}: {}", key, e))?;
    Ok(())
}

fn delete_setting(conn: &Connection, key: &str) {
    let _ = conn.execute("DELETE FROM settings WHERE key = ?1", rusqlite::params![key]);
}

pub fn is_enabled(conn: &Connection) -> bool {
    get_setting(conn, "google_calendar_enabled").as_deref() == Some("true")
        && get_setting(conn, "google_refresh_token").is_some()
}

/// Public connection status for the UI.
#[derive(serde::Serialize)]
pub struct GoogleStatus {
    pub connected: bool,
    pub enabled: bool,
    pub account_email: Option<String>,
    pub calendar_id: Option<String>,
    pub has_client_id: bool,
}

pub fn status(conn: &Connection) -> GoogleStatus {
    GoogleStatus {
        connected: get_setting(conn, "google_refresh_token").is_some(),
        enabled: get_setting(conn, "google_calendar_enabled").as_deref() == Some("true"),
        account_email: get_setting(conn, "google_account_email"),
        calendar_id: get_setting(conn, "google_calendar_id"),
        // Always true: we ship an embedded client id (Model A).
        has_client_id: !client_id(conn).is_empty(),
    }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

fn generate_code_verifier() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 64] = std::array::from_fn(|_| rng.gen());
    URL_SAFE_NO_PAD.encode(bytes)
}

fn code_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn random_state() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = std::array::from_fn(|_| rng.gen());
    URL_SAFE_NO_PAD.encode(bytes)
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

/// Runs the full OAuth flow: opens the browser, waits for the loopback
/// redirect, exchanges the code for tokens and persists them.
///
/// `open_url` is a callback used to open the system browser (so the caller
/// can use the Tauri shell/opener plugin).
pub fn authorize<F>(conn: &Connection, open_url: F) -> Result<String, String>
where
    F: FnOnce(&str) -> Result<(), String>,
{
    let client_id = client_id(conn);
    if client_id.is_empty() {
        return Err(
            "No hay credenciales de Google configuradas en esta versión. Ingrese un Client ID en Opciones avanzadas."
                .to_string(),
        );
    }
    let client_secret = client_secret(conn);

    // Bind the loopback server first so we know which port to advertise.
    let server = bind_callback_server()?;
    let port = server
        .server_addr()
        .to_ip()
        .map(|a| a.port())
        .ok_or_else(|| "No se pudo determinar el puerto local.".to_string())?;
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    let verifier = generate_code_verifier();
    let challenge = code_challenge(&verifier);
    let state = random_state();

    let auth_url = format!(
        "{auth}?client_id={cid}&redirect_uri={redirect}&response_type=code\
         &scope={scope}&code_challenge={challenge}&code_challenge_method=S256\
         &state={state}&access_type=offline&prompt=consent",
        auth = AUTH_ENDPOINT,
        cid = urlencoding::encode(&client_id),
        redirect = urlencoding::encode(&redirect_uri),
        scope = urlencoding::encode(SCOPE),
        challenge = challenge,
        state = state,
    );

    open_url(&auth_url)?;

    // Wait for the redirect and extract the authorization code.
    let code = wait_for_code(server, &state)?;

    // Exchange the code for tokens.
    let client = reqwest::blocking::Client::new();
    let mut params = vec![
        ("client_id", client_id.as_str()),
        ("code", code.as_str()),
        ("code_verifier", verifier.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri.as_str()),
    ];
    if let Some(ref secret) = client_secret {
        params.push(("client_secret", secret.as_str()));
    }

    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&params)
        .send()
        .map_err(|e| format!("Error al contactar Google: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().unwrap_or_default();
        return Err(format!("Google rechazó el intercambio de token: {}", body));
    }

    let token: TokenResponse = resp
        .json()
        .map_err(|e| format!("Respuesta de token inválida: {}", e))?;

    let refresh_token = token
        .refresh_token
        .ok_or_else(|| "Google no devolvió refresh_token. Revoque el acceso y reintente.".to_string())?;

    persist_tokens(conn, &token.access_token, &refresh_token, token.expires_in)?;

    // Fetch the account email for display (best-effort).
    let email = fetch_account_email(&client, &token.access_token).ok();
    if let Some(ref e) = email {
        set_setting(conn, "google_account_email", e)?;
    }

    // Default calendar and enable.
    if get_setting(conn, "google_calendar_id").is_none() {
        set_setting(conn, "google_calendar_id", "primary")?;
    }
    set_setting(conn, "google_calendar_enabled", "true")?;

    Ok(email.unwrap_or_else(|| "cuenta conectada".to_string()))
}

fn bind_callback_server() -> Result<tiny_http::Server, String> {
    for port in CALLBACK_PORTS {
        if let Ok(server) = tiny_http::Server::http(("127.0.0.1", port)) {
            return Ok(server);
        }
    }
    Err("No se pudo abrir un puerto local para la autenticación. Cierre otras apps e intente de nuevo.".to_string())
}

fn wait_for_code(server: tiny_http::Server, expected_state: &str) -> Result<String, String> {
    // Block until the browser hits the redirect (with a timeout guard).
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(300);

    loop {
        if std::time::Instant::now() > deadline {
            return Err("Tiempo de espera agotado para la autorización de Google.".to_string());
        }

        match server.recv_timeout(std::time::Duration::from_secs(1)) {
            Ok(Some(request)) => {
                let url = request.url().to_string();
                let (code, state, error) = parse_callback_query(&url);

                let (status, body) = if let Some(err) = error {
                    (400u32, format!("<h2>Autorización cancelada</h2><p>{}</p>", err))
                } else if state.as_deref() != Some(expected_state) {
                    (400u32, "<h2>Error de seguridad (state no coincide)</h2>".to_string())
                } else if code.is_some() {
                    (200u32, "<h2>Conectado con Google Calendar</h2><p>Puede cerrar esta pestaña y volver a la aplicación.</p>".to_string())
                } else {
                    (400u32, "<h2>No se recibió el código de autorización.</h2>".to_string())
                };

                let response = tiny_http::Response::from_string(format!(
                    "<html><head><meta charset=\"utf-8\"></head><body style=\"font-family:sans-serif;text-align:center;margin-top:80px\">{}</body></html>",
                    body
                ))
                .with_header(
                    "Content-Type: text/html; charset=utf-8"
                        .parse::<tiny_http::Header>()
                        .unwrap(),
                )
                .with_status_code(status);
                let _ = request.respond(response);

                if let Some(err) = parse_callback_query(&url).2 {
                    return Err(format!("Google devolvió un error: {}", err));
                }
                if state.as_deref() != Some(expected_state) {
                    return Err("Fallo de verificación de seguridad (state).".to_string());
                }
                if let Some(c) = code {
                    return Ok(c);
                }
            }
            Ok(None) => continue, // timeout tick, loop and re-check deadline
            Err(e) => return Err(format!("Error del servidor local: {}", e)),
        }
    }
}

fn parse_callback_query(url: &str) -> (Option<String>, Option<String>, Option<String>) {
    // url looks like "/?code=...&state=..." or "/?error=access_denied&state=..."
    let query = url.splitn(2, '?').nth(1).unwrap_or("");
    let mut code = None;
    let mut state = None;
    let mut error = None;
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        let key = it.next().unwrap_or("");
        let value = it.next().unwrap_or("");
        let decoded = urlencoding::decode(value).map(|c| c.into_owned()).unwrap_or_default();
        match key {
            "code" => code = Some(decoded),
            "state" => state = Some(decoded),
            "error" => error = Some(decoded),
            _ => {}
        }
    }
    (code, state, error)
}

fn persist_tokens(
    conn: &Connection,
    access_token: &str,
    refresh_token: &str,
    expires_in: Option<i64>,
) -> Result<(), String> {
    set_setting(conn, "google_access_token", access_token)?;
    set_setting(conn, "google_refresh_token", refresh_token)?;
    let expiry = Utc::now() + Duration::seconds(expires_in.unwrap_or(3600) - 60);
    set_setting(conn, "google_token_expiry", &expiry.to_rfc3339())?;
    Ok(())
}

/// Returns a valid access token, refreshing it if expired.
fn valid_access_token(conn: &Connection) -> Result<String, String> {
    let expiry = get_setting(conn, "google_token_expiry")
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|d| d.with_timezone(&Utc));

    let still_valid = matches!(expiry, Some(e) if e > Utc::now());
    if still_valid {
        if let Some(token) = get_setting(conn, "google_access_token") {
            return Ok(token);
        }
    }

    // Refresh.
    let refresh_token = get_setting(conn, "google_refresh_token")
        .ok_or_else(|| "No hay conexión con Google (falta refresh_token).".to_string())?;
    let client_id = client_id(conn);
    let client_secret = client_secret(conn);

    let client = reqwest::blocking::Client::new();
    let mut params = vec![
        ("client_id", client_id.as_str()),
        ("refresh_token", refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ];
    if let Some(ref secret) = client_secret {
        params.push(("client_secret", secret.as_str()));
    }

    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&params)
        .send()
        .map_err(|e| format!("Error al refrescar token de Google: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().unwrap_or_default();
        return Err(format!("No se pudo refrescar el token de Google: {}", body));
    }

    let token: TokenResponse = resp
        .json()
        .map_err(|e| format!("Respuesta de refresh inválida: {}", e))?;

    // A refresh response usually omits the refresh_token; keep the existing one.
    set_setting(conn, "google_access_token", &token.access_token)?;
    let expiry = Utc::now() + Duration::seconds(token.expires_in.unwrap_or(3600) - 60);
    set_setting(conn, "google_token_expiry", &expiry.to_rfc3339())?;

    Ok(token.access_token)
}

fn fetch_account_email(client: &reqwest::blocking::Client, access_token: &str) -> Result<String, String> {
    let resp = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(access_token)
        .send()
        .map_err(|e| e.to_string())?;
    let info: UserInfoResponse = resp.json().map_err(|e| e.to_string())?;
    info.email.ok_or_else(|| "sin email".to_string())
}

/// Disconnect: revoke best-effort and wipe stored tokens.
pub fn disconnect(conn: &Connection) -> Result<(), String> {
    if let Some(token) = get_setting(conn, "google_refresh_token")
        .or_else(|| get_setting(conn, "google_access_token"))
    {
        let client = reqwest::blocking::Client::new();
        let _ = client
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token.as_str())])
            .send();
    }
    for key in [
        "google_refresh_token",
        "google_access_token",
        "google_token_expiry",
        "google_account_email",
    ] {
        delete_setting(conn, key);
    }
    set_setting(conn, "google_calendar_enabled", "false")?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Event mapping + operations
// ---------------------------------------------------------------------------

/// Minimal appointment data needed to build a calendar event.
pub struct EventData {
    pub summary: String,
    pub description: String,
    pub start_time: String,
    pub end_time: String,
    pub cancelled: bool,
}

fn calendar_id(conn: &Connection) -> String {
    get_setting(conn, "google_calendar_id").unwrap_or_else(|| "primary".to_string())
}

/// Convert a local naive datetime string ("YYYY-MM-DDTHH:MM:SS") to an RFC3339
/// value. We send it without an offset and let Google interpret it in the
/// calendar's timezone via the `timeZone` field.
fn event_body(data: &EventData, time_zone: &str) -> serde_json::Value {
    serde_json::json!({
        "summary": data.summary,
        "description": data.description,
        "start": { "dateTime": normalize_datetime(&data.start_time), "timeZone": time_zone },
        "end": { "dateTime": normalize_datetime(&data.end_time), "timeZone": time_zone },
        "status": if data.cancelled { "cancelled" } else { "confirmed" },
    })
}

fn normalize_datetime(s: &str) -> String {
    // Ensure a seconds component is present: "2026-01-02T09:00" -> "2026-01-02T09:00:00"
    if s.len() == 16 {
        format!("{}:00", s)
    } else {
        s.to_string()
    }
}

/// Create an event and return its Google event id.
pub fn create_event(conn: &Connection, data: &EventData) -> Result<String, String> {
    let token = valid_access_token(conn)?;
    let cal = calendar_id(conn);
    let tz = get_setting(conn, "google_calendar_timezone").unwrap_or_else(|| "America/Bogota".to_string());

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!("{}/{}/events", CALENDAR_API, urlencoding::encode(&cal)))
        .bearer_auth(&token)
        .json(&event_body(data, &tz))
        .send()
        .map_err(|e| format!("Error al crear evento en Google: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().unwrap_or_default();
        return Err(format!("Google rechazó la creación del evento: {}", body));
    }

    let event: EventResponse = resp.json().map_err(|e| e.to_string())?;
    Ok(event.id)
}

/// Update an existing event.
pub fn update_event(conn: &Connection, event_id: &str, data: &EventData) -> Result<(), String> {
    let token = valid_access_token(conn)?;
    let cal = calendar_id(conn);
    let tz = get_setting(conn, "google_calendar_timezone").unwrap_or_else(|| "America/Bogota".to_string());

    let client = reqwest::blocking::Client::new();
    let resp = client
        .patch(format!(
            "{}/{}/events/{}",
            CALENDAR_API,
            urlencoding::encode(&cal),
            urlencoding::encode(event_id)
        ))
        .bearer_auth(&token)
        .json(&event_body(data, &tz))
        .send()
        .map_err(|e| format!("Error al actualizar evento en Google: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().unwrap_or_default();
        return Err(format!("Google rechazó la actualización del evento: {}", body));
    }
    Ok(())
}

/// Delete an event. Treats 404/410 as success (already gone).
pub fn delete_event(conn: &Connection, event_id: &str) -> Result<(), String> {
    let token = valid_access_token(conn)?;
    let cal = calendar_id(conn);

    let client = reqwest::blocking::Client::new();
    let resp = client
        .delete(format!(
            "{}/{}/events/{}",
            CALENDAR_API,
            urlencoding::encode(&cal),
            urlencoding::encode(event_id)
        ))
        .bearer_auth(&token)
        .send()
        .map_err(|e| format!("Error al eliminar evento en Google: {}", e))?;

    let code = resp.status().as_u16();
    if resp.status().is_success() || code == 404 || code == 410 {
        return Ok(());
    }
    let body = resp.text().unwrap_or_default();
    Err(format!("Google rechazó la eliminación del evento: {}", body))
}

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

#[derive(serde::Deserialize)]
struct EventResponse {
    id: String,
}

#[derive(serde::Deserialize)]
struct UserInfoResponse {
    #[serde(default)]
    email: Option<String>,
}
