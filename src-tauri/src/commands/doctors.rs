use tauri::State;

use crate::db::repositories::doctor_repo;
use crate::db::Database;
use crate::models::doctor::{CreateDoctorRequest, Doctor, DoctorSummary, UpdateDoctorRequest};
use crate::models::user::UserRole;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_doctor(
    request: CreateDoctorRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Doctor, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let doctor = doctor_repo::create(&conn, &request)?;

    log_audit(&conn, user.id, "create_doctor", doctor.id);
    Ok(doctor)
}

#[tauri::command]
pub fn update_doctor(
    request: UpdateDoctorRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Doctor, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let doctor = doctor_repo::update(&conn, &request)?;

    log_audit(&conn, user.id, "update_doctor", doctor.id);
    Ok(doctor)
}

#[tauri::command]
pub fn get_doctor(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Doctor, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    doctor_repo::get_by_id(&conn, id)
}

#[tauri::command]
pub fn list_doctors(
    active_only: bool,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<DoctorSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    doctor_repo::list(&conn, active_only)
}

#[tauri::command]
pub fn deactivate_doctor(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    doctor_repo::deactivate(&conn, id)?;

    log_audit(&conn, user.id, "deactivate_doctor", id);
    Ok(())
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'doctors', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
