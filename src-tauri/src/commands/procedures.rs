use tauri::State;

use crate::db::repositories::procedure_repo;
use crate::db::Database;
use crate::models::procedure::{
    CreateProcedureRequest, PriceHistoryEntry, Procedure, ProcedureSummary, UpdatePriceRequest,
    UpdateProcedureRequest,
};
use crate::models::user::UserRole;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_procedure(
    request: CreateProcedureRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Procedure, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if request.base_price < 0.0 {
        return Err("El precio no puede ser negativo.".to_string());
    }

    let procedure = procedure_repo::create(&conn, &request)?;

    log_audit(&conn, user.id, "create_procedure", procedure.id);
    Ok(procedure)
}

#[tauri::command]
pub fn update_procedure(
    request: UpdateProcedureRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Procedure, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let procedure = procedure_repo::update(&conn, &request)?;

    log_audit(&conn, user.id, "update_procedure", procedure.id);
    Ok(procedure)
}

#[tauri::command]
pub fn list_procedures(
    active_only: bool,
    category: Option<String>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<ProcedureSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    procedure_repo::list(&conn, active_only, category.as_deref())
}

#[tauri::command]
pub fn search_procedures(
    query: String,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<ProcedureSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    procedure_repo::search(&conn, &query)
}

#[tauri::command]
pub fn get_procedure(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Procedure, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    procedure_repo::get_by_id(&conn, id)
}

#[tauri::command]
pub fn update_procedure_price(
    request: UpdatePriceRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Procedure, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if request.new_price < 0.0 {
        return Err("El precio no puede ser negativo.".to_string());
    }

    let procedure = procedure_repo::update_price(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "update_procedure_price", procedure.id);
    Ok(procedure)
}

#[tauri::command]
pub fn get_procedure_price_history(
    procedure_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<PriceHistoryEntry>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    procedure_repo::get_price_history(&conn, procedure_id)
}

#[tauri::command]
pub fn deactivate_procedure(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    procedure_repo::deactivate(&conn, id)?;

    log_audit(&conn, user.id, "deactivate_procedure", id);
    Ok(())
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'procedures', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
