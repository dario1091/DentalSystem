use tauri::State;

use crate::db::repositories::rewards_repo;
use crate::db::Database;
use crate::models::rewards::{
    CreatePrizeRequest, PatientPrize, Prize, RedeemPrizeRequest, SpinRequest, UpdatePrizeRequest,
};
use crate::models::user::UserRole;
use crate::services::session::SessionState;

// ===== Catálogo (administración: solo master) =====

#[tauri::command]
pub fn create_prize(
    request: CreatePrizeRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Prize, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let prize = rewards_repo::create_prize(
        &conn,
        &request.name,
        request.color.as_deref().unwrap_or("#3b82f6"),
        request.weight.unwrap_or(1.0),
        request.validity_days.unwrap_or(30),
    )?;

    log_audit(&conn, user.id, "create_prize", prize.id);
    Ok(prize)
}

#[tauri::command]
pub fn update_prize(
    request: UpdatePrizeRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Prize, String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let prize = rewards_repo::update_prize(
        &conn,
        request.id,
        &request.name,
        &request.color,
        request.weight,
        request.validity_days,
        request.active,
    )?;

    log_audit(&conn, user.id, "update_prize", prize.id);
    Ok(prize)
}

#[tauri::command]
pub fn delete_prize(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    rewards_repo::delete_prize(&conn, id)?;
    log_audit(&conn, user.id, "delete_prize", id);
    Ok(())
}

/// Lista premios. `only_active` = true para la ruleta; false para administración.
#[tauri::command]
pub fn list_prizes(
    only_active: bool,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Prize>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    rewards_repo::list_prizes(&conn, only_active)
}

// ===== Girar y premios ganados (cualquier usuario) =====

#[tauri::command]
pub fn spin_wheel(
    request: SpinRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<PatientPrize, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result = rewards_repo::spin(&conn, request.patient_id, user.id)?;
    log_audit(&conn, user.id, "spin_wheel", result.id);
    Ok(result)
}

#[tauri::command]
pub fn list_patient_prizes(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<PatientPrize>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    rewards_repo::list_by_patient(&conn, patient_id)
}

#[tauri::command]
pub fn list_pending_prizes(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<PatientPrize>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    rewards_repo::list_pending(&conn)
}

#[tauri::command]
pub fn redeem_prize(
    request: RedeemPrizeRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<PatientPrize, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result = rewards_repo::redeem(&conn, request.patient_prize_id, request.notes.as_deref())?;
    log_audit(&conn, user.id, "redeem_prize", result.id);
    Ok(result)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'rewards', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
