use tauri::State;

use crate::db::repositories::odontogram_repo;
use crate::db::Database;
use crate::models::odontogram::{
    AddFindingRequest, CreateOdontogramRequest, OdontogramDetail, OdontogramFinding,
    OdontogramSummary, RemoveFindingRequest,
};
use crate::models::user::UserRole;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_odontogram(
    request: CreateOdontogramRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<OdontogramDetail, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let odontogram = odontogram_repo::create(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "create_odontogram", odontogram.id);

    odontogram_repo::get_detail(&conn, odontogram.id)
}

#[tauri::command]
pub fn add_finding(
    request: AddFindingRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<OdontogramFinding, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate tooth number format (FDI: 11-48 for permanent, 51-85 for deciduous)
    let tooth_num: u32 = request
        .tooth_number
        .parse()
        .map_err(|_| "Número de diente inválido.".to_string())?;

    let valid_permanent = (11..=18).contains(&tooth_num)
        || (21..=28).contains(&tooth_num)
        || (31..=38).contains(&tooth_num)
        || (41..=48).contains(&tooth_num);
    let valid_deciduous = (51..=55).contains(&tooth_num)
        || (61..=65).contains(&tooth_num)
        || (71..=75).contains(&tooth_num)
        || (81..=85).contains(&tooth_num);

    if !valid_permanent && !valid_deciduous {
        return Err("Número de diente no válido según nomenclatura FDI.".to_string());
    }

    let finding = odontogram_repo::add_finding(&conn, &request)?;

    log_audit(&conn, user.id, "add_finding", finding.id);
    Ok(finding)
}

#[tauri::command]
pub fn remove_finding(
    request: RemoveFindingRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    odontogram_repo::remove_finding(&conn, request.finding_id, request.odontogram_id)?;

    log_audit(&conn, user.id, "remove_finding", request.finding_id);
    Ok(())
}

#[tauri::command]
pub fn get_odontograms_by_patient(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<OdontogramSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    odontogram_repo::get_by_patient(&conn, patient_id)
}

#[tauri::command]
pub fn get_odontogram_detail(
    odontogram_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<OdontogramDetail, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    odontogram_repo::get_detail(&conn, odontogram_id)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'odontograms', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
