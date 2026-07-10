use tauri::State;

use crate::db::repositories::appointment_repo;
use crate::db::Database;
use crate::models::appointment::{
    AddProcedureRequest, Appointment, AppointmentProcedure, AppointmentStatus,
    AppointmentSummary, ChangeStatusRequest, CreateAppointmentRequest, ListAppointmentsFilter,
    RemoveProcedureRequest, UpdateAppointmentRequest,
};
use crate::models::user::UserRole;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_appointment(
    request: CreateAppointmentRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Appointment, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate start < end
    if request.start_time >= request.end_time {
        return Err("La hora de inicio debe ser anterior a la hora de fin.".to_string());
    }

    let appointment = appointment_repo::create(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "create_appointment", appointment.id);
    Ok(appointment)
}

#[tauri::command]
pub fn update_appointment(
    request: UpdateAppointmentRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Appointment, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Cannot update terminal appointments
    let current = appointment_repo::get_by_id(&conn, request.id)?;
    let status = AppointmentStatus::from_str(&current.status)?;
    if status.is_terminal() {
        return Err("No se puede modificar una cita finalizada, cancelada o de no-show.".to_string());
    }

    // Validate time if both provided
    if let (Some(ref start), Some(ref end)) = (&request.start_time, &request.end_time) {
        if start >= end {
            return Err("La hora de inicio debe ser anterior a la hora de fin.".to_string());
        }
    }

    let appointment = appointment_repo::update(&conn, &request)?;

    log_audit(&conn, user.id, "update_appointment", appointment.id);
    Ok(appointment)
}

#[tauri::command]
pub fn get_appointment(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Appointment, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    appointment_repo::get_by_id(&conn, id)
}

#[tauri::command]
pub fn list_appointments(
    filter: ListAppointmentsFilter,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<AppointmentSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    appointment_repo::list(&conn, &filter)
}

#[tauri::command]
pub fn change_appointment_status(
    request: ChangeStatusRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Appointment, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let current = appointment_repo::get_by_id(&conn, request.appointment_id)?;
    let current_status = AppointmentStatus::from_str(&current.status)?;
    let new_status = AppointmentStatus::from_str(&request.new_status)?;

    // Validate state transition
    if !current_status.can_transition_to(&new_status) {
        return Err(format!(
            "No se puede cambiar de '{}' a '{}'. Transiciones válidas: {:?}",
            current.status,
            request.new_status,
            current_status
                .valid_transitions()
                .iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
        ));
    }

    // Only doctor or master can mark as completed
    if new_status == AppointmentStatus::Completed {
        if user.role != UserRole::Master && user.role != UserRole::Doctor {
            return Err(
                "Solo el doctor o administrador puede marcar una cita como completada.".to_string(),
            );
        }
    }

    let appointment =
        appointment_repo::change_status(&conn, request.appointment_id, new_status.as_str())?;

    log_audit(&conn, user.id, "change_appointment_status", appointment.id);
    Ok(appointment)
}

#[tauri::command]
pub fn add_procedure_to_appointment(
    request: AddProcedureRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<AppointmentProcedure, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Check appointment exists and is not terminal
    let appointment = appointment_repo::get_by_id(&conn, request.appointment_id)?;
    let status = AppointmentStatus::from_str(&appointment.status)?;
    if status.is_terminal() {
        return Err(
            "No se pueden agregar procedimientos a una cita finalizada o cancelada.".to_string(),
        );
    }

    let proc = appointment_repo::add_procedure(&conn, &request)?;

    log_audit(
        &conn,
        user.id,
        "add_procedure_to_appointment",
        proc.id,
    );
    Ok(proc)
}

#[tauri::command]
pub fn remove_procedure_from_appointment(
    request: RemoveProcedureRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Check appointment is not terminal
    let appointment = appointment_repo::get_by_id(&conn, request.appointment_id)?;
    let status = AppointmentStatus::from_str(&appointment.status)?;
    if status.is_terminal() {
        return Err(
            "No se pueden eliminar procedimientos de una cita finalizada o cancelada.".to_string(),
        );
    }

    appointment_repo::remove_procedure(&conn, request.appointment_procedure_id, request.appointment_id)?;

    log_audit(
        &conn,
        user.id,
        "remove_procedure_from_appointment",
        request.appointment_procedure_id,
    );
    Ok(())
}

#[tauri::command]
pub fn get_appointment_procedures(
    appointment_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<AppointmentProcedure>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    appointment_repo::get_appointment_procedures(&conn, appointment_id)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'appointments', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
