use tauri::State;
use tauri_plugin_opener::OpenerExt;

use crate::db::repositories::appointment_repo;
use crate::db::Database;
use crate::models::appointment::AppointmentStatus;
use crate::models::user::UserRole;
use crate::services::google_calendar::{self, EventData, GoogleStatus};
use crate::services::session::SessionState;

/// Start the OAuth flow. Opens the system browser and blocks until the user
/// finishes authorizing (or the flow times out). Returns the connected account.
#[tauri::command]
pub fn google_auth_start(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    google_calendar::authorize(&conn, |url| {
        app_handle
            .opener()
            .open_url(url.to_string(), None::<&str>)
            .map_err(|e| format!("No se pudo abrir el navegador: {}", e))
    })
}

/// Save the OAuth client credentials (client id + optional secret) and the
/// preferred calendar / timezone. Master only.
#[tauri::command]
pub fn google_set_config(
    client_id: String,
    client_secret: Option<String>,
    calendar_id: Option<String>,
    time_zone: Option<String>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Only override the embedded client id when a non-empty value is provided.
    if !client_id.trim().is_empty() {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('google_client_id', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
            rusqlite::params![client_id.trim()],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(secret) = client_secret.filter(|s| !s.trim().is_empty()) {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('google_client_secret', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
            rusqlite::params![secret.trim()],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(cal) = calendar_id {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('google_calendar_id', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
            rusqlite::params![cal.trim()],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(tz) = time_zone {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('google_calendar_timezone', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
            rusqlite::params![tz.trim()],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Current connection status for the settings UI.
#[tauri::command]
pub fn google_auth_status(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<GoogleStatus, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(google_calendar::status(&conn))
}

/// Disconnect from Google (revoke + wipe tokens). Master only.
#[tauri::command]
pub fn google_disconnect(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    google_calendar::disconnect(&conn)
}

/// Force-sync a single appointment to Google. Useful for a manual retry.
#[tauri::command]
pub fn google_sync_appointment(
    appointment_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    if !google_calendar::is_enabled(&conn) {
        return Err("La sincronización con Google Calendar no está activa.".to_string());
    }
    sync_appointment(&conn, appointment_id)
}

/// Best-effort sync used by appointment commands. Never returns an error to the
/// caller so a Google failure cannot break the local operation; it only logs.
pub fn sync_appointment_best_effort(conn: &rusqlite::Connection, appointment_id: i64) {
    if !google_calendar::is_enabled(conn) {
        return;
    }
    if let Err(e) = sync_appointment(conn, appointment_id) {
        log::warn!(
            "Google Calendar sync falló para la cita {}: {}",
            appointment_id,
            e
        );
    }
}

/// Reconcile a single appointment with Google Calendar.
/// - cancelled/no_show + existing event  -> delete event, clear id
/// - otherwise + existing event          -> update event
/// - otherwise + no event                -> create event, store id
fn sync_appointment(conn: &rusqlite::Connection, appointment_id: i64) -> Result<(), String> {
    let appt = appointment_repo::get_by_id(conn, appointment_id)?;
    let status = AppointmentStatus::from_str(&appt.status)?;

    let should_remove = matches!(status, AppointmentStatus::Cancelled | AppointmentStatus::NoShow);

    match (appt.google_event_id.as_deref(), should_remove) {
        (Some(event_id), true) => {
            google_calendar::delete_event(conn, event_id)?;
            appointment_repo::set_google_event_id(conn, appointment_id, None)?;
        }
        (Some(event_id), false) => {
            google_calendar::update_event(conn, event_id, &build_event(&appt))?;
        }
        (None, true) => {
            // Nothing in Google and it's cancelled — nothing to do.
        }
        (None, false) => {
            let event_id = google_calendar::create_event(conn, &build_event(&appt))?;
            appointment_repo::set_google_event_id(conn, appointment_id, Some(&event_id))?;
        }
    }
    Ok(())
}

fn build_event(appt: &crate::models::appointment::Appointment) -> EventData {
    let patient = appt.patient_name.clone().unwrap_or_else(|| "Paciente".to_string());
    let doctor = appt.doctor_name.clone().unwrap_or_default();
    let reason = appt.reason.clone().unwrap_or_default();

    let summary = if reason.is_empty() {
        format!("Cita: {}", patient)
    } else {
        format!("{} - {}", patient, reason)
    };

    let mut description = String::new();
    if !doctor.is_empty() {
        description.push_str(&format!("Doctor: {}\n", doctor));
    }
    if let Some(notes) = &appt.notes {
        if !notes.is_empty() {
            description.push_str(&format!("Notas: {}\n", notes));
        }
    }
    description.push_str(&format!("Estado: {}", appt.status));

    EventData {
        summary,
        description,
        start_time: appt.start_time.clone(),
        end_time: appt.end_time.clone(),
        cancelled: false,
    }
}
