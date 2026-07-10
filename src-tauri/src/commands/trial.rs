use serde::Serialize;
use tauri::State;

use crate::db::Database;

const TRIAL_DAYS: i64 = 40;
/// Secret salt — change this and keep it private. Do NOT share your source with clients.
const LICENSE_SALT: &str = "DentalSystem2026_S3cr3t_K3y_X9m2";

#[derive(Debug, Serialize)]
pub struct TrialStatus {
    pub is_expired: bool,
    pub days_remaining: i64,
    pub days_used: i64,
    pub trial_start: String,
    pub trial_end: String,
    pub installation_id: String,
}

/// Get or create a unique installation ID for this machine/install
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

    // Generate new UUID
    let uuid = generate_uuid();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('installation_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        rusqlite::params![uuid],
    )
    .map_err(|e| e.to_string())?;

    Ok(uuid)
}

/// Generate a simple UUID v4-like string
fn generate_uuid() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.gen();
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5], bytes[6], bytes[7]
    )
}

/// Generate a license key for a given installation ID.
/// Uses SHA-256 hash which is reproducible across platforms.
pub fn compute_license_key(installation_id: &str) -> String {
    use sha2::{Sha256, Digest};

    let input = format!("{}{}", installation_id, LICENSE_SALT);
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();

    // Take first 8 bytes and format as license
    let hex: String = result[..8].iter().map(|b| format!("{:02X}", b)).collect();
    format!(
        "DS-{}-{}-{}-{}",
        &hex[0..4], &hex[4..8], &hex[8..12], &hex[12..16]
    )
}

/// Verify a license key against an installation ID
fn verify_license_key(installation_id: &str, license_key: &str) -> bool {
    let expected = compute_license_key(installation_id);
    expected.eq_ignore_ascii_case(license_key.trim())
}

#[tauri::command]
pub fn check_trial(
    db: State<'_, Database>,
) -> Result<TrialStatus, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let installation_id = get_installation_id(&conn)?;

    // Get or set trial start date
    let trial_start: String = match conn.query_row(
        "SELECT value FROM settings WHERE key = 'trial_start_date'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(date) => {
            if date.is_empty() {
                let now = chrono::Local::now().format("%Y-%m-%d").to_string();
                conn.execute(
                    "UPDATE settings SET value = ?1 WHERE key = 'trial_start_date'",
                    rusqlite::params![now],
                ).map_err(|e| e.to_string())?;
                now
            } else {
                date
            }
        }
        Err(_) => {
            let now = chrono::Local::now().format("%Y-%m-%d").to_string();
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('trial_start_date', ?1)",
                rusqlite::params![now],
            ).map_err(|e| e.to_string())?;
            now
        }
    };

    // Calculate days
    let start = chrono::NaiveDate::parse_from_str(&trial_start, "%Y-%m-%d")
        .map_err(|_| "Fecha de trial inválida.".to_string())?;
    let today = chrono::Local::now().date_naive();
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
    })
}

#[tauri::command]
pub fn activate_license(
    license_key: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let installation_id = get_installation_id(&conn)?;

    // Verify the license key matches this installation
    if verify_license_key(&installation_id, &license_key) {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('license_activated', 'true')
             ON CONFLICT(key) DO UPDATE SET value = 'true'",
            [],
        ).map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('license_key', ?1)
             ON CONFLICT(key) DO UPDATE SET value = ?1",
            rusqlite::params![license_key],
        ).map_err(|e| e.to_string())?;

        return Ok(true);
    }

    Err("Clave de licencia inválida para esta instalación.".to_string())
}

#[tauri::command]
pub fn is_licensed(
    db: State<'_, Database>,
) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'license_activated'",
            [],
            |row| row.get(0),
        )
        .ok();

    Ok(result.as_deref() == Some("true"))
}

/// DEV ONLY: Generate a license for a given installation ID.
/// Call this from a separate tool or test — NOT exposed to the frontend.
#[tauri::command]
pub fn dev_generate_license(
    installation_id: String,
    db: State<'_, Database>,
    session: State<'_, crate::services::session::SessionState>,
) -> Result<String, String> {
    use crate::models::user::UserRole;
    session.require_role(&UserRole::Master)?;

    Ok(compute_license_key(&installation_id))
}
