use tauri::State;

use crate::db::repositories::credits_repo;
use crate::db::Database;
use crate::models::billing::{
    AddCreditRequest, ApplyCreditRequest, CreditMovement, PatientCredit, RefundCreditRequest,
    RefundResult,
};
use crate::services::session::SessionState;

/// Registra un abono/anticipo del paciente (entra dinero al saldo a favor).
#[tauri::command]
pub fn add_patient_credit(
    request: AddCreditRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<PatientCredit, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let credit = credits_repo::add_credit(
        &conn,
        request.patient_id,
        request.amount,
        &request.payment_method,
        request.reference.as_deref(),
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "add_credit", request.patient_id);
    Ok(credit)
}

/// Devuelve el saldo a favor disponible de un paciente.
#[tauri::command]
pub fn get_patient_credit(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<PatientCredit, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    credits_repo::get_credit(&conn, patient_id)
}

/// Lista los movimientos del saldo a favor de un paciente.
#[tauri::command]
pub fn list_credit_movements(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<CreditMovement>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    credits_repo::list_movements(&conn, patient_id)
}

/// Aplica saldo a favor a una factura existente (manual).
#[tauri::command]
pub fn apply_credit_to_invoice(
    request: ApplyCreditRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<PatientCredit, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let credit = credits_repo::apply_credit_to_invoice(
        &conn,
        request.patient_id,
        request.invoice_id,
        request.amount,
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "apply_credit", request.patient_id);
    Ok(credit)
}

/// Devuelve todo el saldo a favor al paciente aplicando la penalización del 20%.
#[tauri::command]
pub fn refund_patient_credit(
    request: RefundCreditRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<RefundResult, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result = credits_repo::refund_credit(
        &conn,
        request.patient_id,
        &request.payment_method,
        request.reference.as_deref(),
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "refund_credit", request.patient_id);
    Ok(result)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'credits', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
