use tauri::{Manager, State};

use crate::db::repositories::patient_repo;
use crate::db::Database;
use crate::models::patient::{
    CreatePatientRequest, Patient, PatientSummary, SearchPatientsRequest, UpdatePatientRequest,
};
use crate::services::pdf_generator;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_patient(
    request: CreatePatientRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Patient, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let patient = patient_repo::create(&conn, &request)?;

    // Audit
    log_audit(&conn, user.id, "create_patient", patient.id);

    Ok(patient)
}

#[tauri::command]
pub fn update_patient(
    request: UpdatePatientRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Patient, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let patient = patient_repo::update(&conn, &request)?;

    log_audit(&conn, user.id, "update_patient", patient.id);

    Ok(patient)
}

#[tauri::command]
pub fn get_patient(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Patient, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    patient_repo::get_by_id(&conn, id)
}

#[tauri::command]
pub fn search_patients(
    request: SearchPatientsRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<PatientSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    patient_repo::search(&conn, &request)
}

#[tauri::command]
pub fn deactivate_patient(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    patient_repo::deactivate(&conn, id)?;

    log_audit(&conn, user.id, "deactivate_patient", id);

    Ok(())
}

#[tauri::command]
pub fn count_patients(
    active_only: bool,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<u32, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    patient_repo::count(&conn, active_only)
}

#[tauri::command]
pub fn export_patient_pdf(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let patient = patient_repo::get_by_id(&conn, id)?;

    let output_dir = app_handle
        .path()
        .download_dir()
        .map_err(|e| format!("Path error: {}", e))?;

    pdf_generator::generate_patient_card(&patient, &output_dir)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'patients', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
