use tauri::State;

use crate::db::repositories::clinical_history_repo;
use crate::db::Database;
use crate::models::clinical_history::{
    AddAddendumRequest, AddEvolutionRequest, ClinicalHistory, ClinicalHistoryDetail,
    CreateClinicalHistoryRequest, Evolution, UpdateClinicalHistoryRequest, UpdateEvolutionRequest,
};
use crate::models::user::UserRole;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_clinical_history(
    request: CreateClinicalHistoryRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<ClinicalHistory, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::create(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "create_clinical_history", history.id);
    Ok(history)
}

#[tauri::command]
pub fn update_clinical_history(
    request: UpdateClinicalHistoryRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<ClinicalHistory, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::update(&conn, &request)?;

    log_audit(&conn, user.id, "update_clinical_history", history.id);
    Ok(history)
}

#[tauri::command]
pub fn get_clinical_history(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Option<ClinicalHistoryDetail>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::get_by_patient(&conn, patient_id)?;

    match history {
        Some(h) => {
            let detail = clinical_history_repo::get_detail(&conn, h.id)?;
            Ok(Some(detail))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn add_evolution(
    request: AddEvolutionRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Evolution, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Verify clinical history exists
    let _ = clinical_history_repo::get_by_id(&conn, request.clinical_history_id)?;

    let evolution = clinical_history_repo::add_evolution(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "add_evolution", evolution.id);
    Ok(evolution)
}

#[tauri::command]
pub fn add_addendum(
    request: AddAddendumRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Evolution, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let evolution = clinical_history_repo::add_addendum(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "add_addendum", evolution.id);
    Ok(evolution)
}

#[tauri::command]
pub fn update_evolution(
    request: UpdateEvolutionRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Evolution, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let evolution = clinical_history_repo::update_evolution(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "update_evolution", evolution.id);
    Ok(evolution)
}

#[tauri::command]
pub fn get_evolutions(
    clinical_history_id: i64,
    from_date: Option<String>,
    to_date: Option<String>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Evolution>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    clinical_history_repo::get_evolutions(
        &conn,
        clinical_history_id,
        from_date.as_deref(),
        to_date.as_deref(),
    )
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'clinical_histories', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
