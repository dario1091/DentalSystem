use serde::Serialize;
use tauri::State;

use crate::db::Database;

/// Free trial length (days from first run).
const TRIAL_DAYS: i64 = 40;

/// Warn the user this many days before trial/license expiration.
const WARN_DAYS: i64 = 5;

/// Ed25519 PUBLIC key (hex, 32 bytes). Used only to VERIFY license keys.
/// The matching PRIVATE key lives only in the offline generator (tools/).
const LICENSE_PUBLIC_KEY_HEX: &str =
    "cb188b0bee24bc4efc75f817e75e1393e9a96f3386a41d822d91c434570fc1f5";

#[derive(Debug, Serialize)]
pub struct TrialStatus {
    /// True when the current access (trial or timed license) has expired.
    pub is_expired: bool,
    /// Days remaining before expiration (0 when expired). For permanent
    /// licenses this is a large sentinel and `is_permanent` is true.
    pub days_remaining: i64,
    pub days_used: i64,
    pub trial_start: String,
    pub trial_end: String,
    pub installation_id: String,
    /// True when a license is active (timed or permanent).
    pub licensed: bool,
    /// True when the active license never expires.
    pub is_permanent: bool,
    /// True when within the warning window (<= WARN_DAYS and not expired).
    pub warning: bool,
    /// Expiration date of the active timed license (YYYY-MM-DD), if any.
    pub license_expires: Option<String>,
}

// ---------------------------------------------------------------------------
// Installation id
// ---------------------------------------------------------------------------

fn get_installation_id(conn: &rusqlite::Connection) -> Result<String, String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'installation_id'",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        if !id.is_empty() {
            return Ok(id);
        }
    }

    let uuid = generate_uuid();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('installation_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        rusqlite::params![uuid],
    )
    .map_err(|e| e.to_string())?;

    Ok(uuid)
}

fn generate_uuid() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.gen();
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]
    )
}

// ---------------------------------------------------------------------------
// License key verification (Ed25519)
// ---------------------------------------------------------------------------

/// Parsed license payload: which install it targets and how long it lasts.
struct LicensePayload {
    installation_id: String,
    /// None = permanent; Some(n) = valid for n days from activation.
    days: Option<i64>,
}

/// A license key is: "DS-<payloadHex>-<signatureHex>".
/// The signed message is the raw payload bytes "<installation_id>|<days|perm>".
fn parse_and_verify(license_key: &str) -> Result<LicensePayload, String> {
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};

    let trimmed = license_key.trim();
    let body = trimmed
        .strip_prefix("DS-")
        .ok_or_else(|| "Formato de clave inválido.".to_string())?;

    let mut parts = body.splitn(2, '-');
    let payload_hex = parts.next().unwrap_or("");
    let sig_hex = parts.next().unwrap_or("");
    if payload_hex.is_empty() || sig_hex.is_empty() {
        return Err("Clave incompleta.".to_string());
    }

    let payload_bytes =
        hex::decode(payload_hex).map_err(|_| "Clave corrupta (payload).".to_string())?;
    let sig_bytes = hex::decode(sig_hex).map_err(|_| "Clave corrupta (firma).".to_string())?;

    // Verify signature with the embedded public key.
    let pub_bytes = hex::decode(LICENSE_PUBLIC_KEY_HEX)
        .map_err(|_| "Clave pública inválida.".to_string())?;
    let pub_arr: [u8; 32] = pub_bytes
        .as_slice()
        .try_into()
        .map_err(|_| "Clave pública inválida.".to_string())?;
    let verifying_key =
        VerifyingKey::from_bytes(&pub_arr).map_err(|_| "Clave pública inválida.".to_string())?;

    let sig_arr: [u8; 64] = sig_bytes
        .as_slice()
        .try_into()
        .map_err(|_| "Firma inválida.".to_string())?;
    let signature = Signature::from_bytes(&sig_arr);

    verifying_key
        .verify(&payload_bytes, &signature)
        .map_err(|_| "Clave de licencia no válida o alterada.".to_string())?;

    // Payload is UTF-8 "<installation_id>|<days|perm>".
    let payload_str =
        String::from_utf8(payload_bytes).map_err(|_| "Payload inválido.".to_string())?;
    let mut it = payload_str.splitn(2, '|');
    let installation_id = it.next().unwrap_or("").to_string();
    let dur = it.next().unwrap_or("").trim();

    let days = if dur.eq_ignore_ascii_case("perm") {
        None
    } else {
        Some(dur.parse::<i64>().map_err(|_| "Duración inválida en la clave.".to_string())?)
    };

    Ok(LicensePayload { installation_id, days })
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .filter(|v: &String| !v.is_empty())
}

fn set_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn check_trial(db: State<'_, Database>) -> Result<TrialStatus, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let installation_id = get_installation_id(&conn)?;
    let today = chrono::Local::now().date_naive();

    // If a license is active, its state takes precedence over the trial.
    if get_setting(&conn, "license_activated").as_deref() == Some("true") {
        let permanent = get_setting(&conn, "license_permanent").as_deref() == Some("true");
        if permanent {
            return Ok(TrialStatus {
                is_expired: false,
                days_remaining: i64::MAX,
                days_used: 0,
                trial_start: String::new(),
                trial_end: String::new(),
                installation_id,
                licensed: true,
                is_permanent: true,
                warning: false,
                license_expires: None,
            });
        }

        // Timed license: read expiration.
        if let Some(exp_str) = get_setting(&conn, "license_expires_at") {
            if let Ok(exp) = chrono::NaiveDate::parse_from_str(&exp_str, "%Y-%m-%d") {
                let remaining = (exp - today).num_days();
                let expired = remaining < 0;
                return Ok(TrialStatus {
                    is_expired: expired,
                    days_remaining: remaining.max(0),
                    days_used: 0,
                    trial_start: String::new(),
                    trial_end: exp_str.clone(),
                    installation_id,
                    licensed: !expired,
                    is_permanent: false,
                    warning: !expired && remaining <= WARN_DAYS,
                    license_expires: Some(exp_str),
                });
            }
        }
    }

    // Otherwise, evaluate the free trial.
    let trial_start = match get_setting(&conn, "trial_start_date") {
        Some(date) => date,
        None => {
            let now = today.format("%Y-%m-%d").to_string();
            set_setting(&conn, "trial_start_date", &now)?;
            now
        }
    };

    let start = chrono::NaiveDate::parse_from_str(&trial_start, "%Y-%m-%d")
        .map_err(|_| "Fecha de trial inválida.".to_string())?;
    let days_used = (today - start).num_days();
    let days_remaining = TRIAL_DAYS - days_used;
    let is_expired = days_remaining <= 0;
    let trial_end = (start + chrono::Duration::days(TRIAL_DAYS))
        .format("%Y-%m-%d")
        .to_string();

    Ok(TrialStatus {
        is_expired,
        days_remaining: days_remaining.max(0),
        days_used,
        trial_start,
        trial_end,
        installation_id,
        licensed: false,
        is_permanent: false,
        warning: !is_expired && days_remaining <= WARN_DAYS,
        license_expires: None,
    })
}

#[tauri::command]
pub fn activate_license(license_key: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let installation_id = get_installation_id(&conn)?;

    let payload = parse_and_verify(&license_key)?;

    if payload.installation_id != installation_id {
        return Err("Esta clave no corresponde a este equipo.".to_string());
    }

    set_setting(&conn, "license_activated", "true")?;
    set_setting(&conn, "license_key", license_key.trim())?;

    match payload.days {
        None => {
            // Permanent.
            set_setting(&conn, "license_permanent", "true")?;
            let _ = conn.execute(
                "DELETE FROM settings WHERE key = 'license_expires_at'",
                [],
            );
        }
        Some(days) => {
            set_setting(&conn, "license_permanent", "false")?;
            let today = chrono::Local::now().date_naive();
            let expires = (today + chrono::Duration::days(days))
                .format("%Y-%m-%d")
                .to_string();
            set_setting(&conn, "license_expires_at", &expires)?;
        }
    }

    Ok(true)
}

#[tauri::command]
pub fn is_licensed(db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if get_setting(&conn, "license_activated").as_deref() != Some("true") {
        return Ok(false);
    }

    // Permanent licenses are always valid.
    if get_setting(&conn, "license_permanent").as_deref() == Some("true") {
        return Ok(true);
    }

    // Timed license: valid only if not past expiration.
    if let Some(exp_str) = get_setting(&conn, "license_expires_at") {
        if let Ok(exp) = chrono::NaiveDate::parse_from_str(&exp_str, "%Y-%m-%d") {
            let today = chrono::Local::now().date_naive();
            return Ok((exp - today).num_days() >= 0);
        }
    }

    Ok(false)
}

/// DEV ONLY: not used for signed keys (kept for compatibility, always errors in
/// release). License keys are generated with the offline tool in `tools/`.
#[tauri::command]
pub fn dev_generate_license(_installation_id: String) -> Result<String, String> {
    Err("Las claves se generan con la herramienta offline (tools/generate-license.cjs).".to_string())
}
