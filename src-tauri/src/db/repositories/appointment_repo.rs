use rusqlite::{params, Connection};

use crate::models::appointment::{
    AddProcedureRequest, Appointment, AppointmentProcedure, AppointmentSummary,
    CreateAppointmentRequest, ListAppointmentsFilter, UpdateAppointmentRequest,
};

pub fn create(
    conn: &Connection,
    req: &CreateAppointmentRequest,
    user_id: i64,
) -> Result<Appointment, String> {
    // Validate no overlap for the same doctor
    check_overlap(conn, req.doctor_id, &req.start_time, &req.end_time, None)?;

    conn.execute(
        "INSERT INTO appointments (patient_id, doctor_id, start_time, end_time, reason, notes, created_by, status_changed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            req.patient_id,
            req.doctor_id,
            req.start_time,
            req.end_time,
            req.reason,
            req.notes,
            user_id,
        ],
    )
    .map_err(|e| format!("Error al crear cita: {}", e))?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Appointment, String> {
    conn.query_row(
        "SELECT a.id, a.patient_id, (p.first_name || ' ' || p.last_name) as patient_name,
                a.doctor_id, ('Dr. ' || d.first_name || ' ' || d.last_name) as doctor_name,
                a.start_time, a.end_time, a.status, a.reason, a.notes,
                a.total_amount, a.status_changed_at, a.created_by, a.created_at, a.updated_at
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         WHERE a.id = ?1",
        params![id],
        |row| {
            Ok(Appointment {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                patient_name: row.get(2)?,
                doctor_id: row.get(3)?,
                doctor_name: row.get(4)?,
                start_time: row.get(5)?,
                end_time: row.get(6)?,
                status: row.get(7)?,
                reason: row.get(8)?,
                notes: row.get(9)?,
                total_amount: row.get(10)?,
                status_changed_at: row.get(11)?,
                created_by: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        },
    )
    .map_err(|_| "Cita no encontrada.".to_string())
}

pub fn update(conn: &Connection, req: &UpdateAppointmentRequest) -> Result<Appointment, String> {
    // If changing doctor or time, check overlap
    let current = get_by_id(conn, req.id)?;
    let doctor_id = req.doctor_id.unwrap_or(current.doctor_id);
    let start_time = req.start_time.as_deref().unwrap_or(&current.start_time);
    let end_time = req.end_time.as_deref().unwrap_or(&current.end_time);

    if req.doctor_id.is_some() || req.start_time.is_some() || req.end_time.is_some() {
        check_overlap(conn, doctor_id, start_time, end_time, Some(req.id))?;
    }

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(pid) = req.patient_id {
        sets.push("patient_id = ?".to_string());
        values.push(Box::new(pid));
    }
    if let Some(did) = req.doctor_id {
        sets.push("doctor_id = ?".to_string());
        values.push(Box::new(did));
    }
    if let Some(ref st) = req.start_time {
        sets.push("start_time = ?".to_string());
        values.push(Box::new(st.clone()));
    }
    if let Some(ref et) = req.end_time {
        sets.push("end_time = ?".to_string());
        values.push(Box::new(et.clone()));
    }
    if let Some(ref reason) = req.reason {
        sets.push("reason = ?".to_string());
        values.push(Box::new(reason.clone()));
    }
    if let Some(ref notes) = req.notes {
        sets.push("notes = ?".to_string());
        values.push(Box::new(notes.clone()));
    }

    if sets.is_empty() {
        return get_by_id(conn, req.id);
    }

    sets.push("updated_at = datetime('now')".to_string());

    let sql = format!("UPDATE appointments SET {} WHERE id = ?", sets.join(", "));
    values.push(Box::new(req.id));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params_ref.as_slice())
        .map_err(|e| format!("Error al actualizar cita: {}", e))?;

    get_by_id(conn, req.id)
}

pub fn change_status(
    conn: &Connection,
    appointment_id: i64,
    new_status: &str,
) -> Result<Appointment, String> {
    conn.execute(
        "UPDATE appointments SET status = ?1, status_changed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?2",
        params![new_status, appointment_id],
    )
    .map_err(|e| format!("Error al cambiar estado: {}", e))?;

    get_by_id(conn, appointment_id)
}

pub fn list(
    conn: &Connection,
    filter: &ListAppointmentsFilter,
) -> Result<Vec<AppointmentSummary>, String> {
    let mut sql = String::from(
        "SELECT a.id, (p.first_name || ' ' || p.last_name) as patient_name,
                ('Dr. ' || d.first_name || ' ' || d.last_name) as doctor_name,
                a.start_time, a.end_time, a.status, a.reason, a.total_amount
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         WHERE 1=1",
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(did) = filter.doctor_id {
        sql.push_str(&format!(" AND a.doctor_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(did));
    }
    if let Some(pid) = filter.patient_id {
        sql.push_str(&format!(" AND a.patient_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(pid));
    }
    if let Some(ref status) = filter.status {
        sql.push_str(&format!(" AND a.status = ?{}", param_values.len() + 1));
        param_values.push(Box::new(status.clone()));
    }
    if let Some(ref from) = filter.date_from {
        sql.push_str(&format!(" AND a.start_time >= ?{}", param_values.len() + 1));
        param_values.push(Box::new(from.clone()));
    }
    if let Some(ref to) = filter.date_to {
        sql.push_str(&format!(" AND a.start_time <= ?{}", param_values.len() + 1));
        param_values.push(Box::new(to.clone()));
    }

    sql.push_str(" ORDER BY a.start_time DESC LIMIT 200");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|v| v.as_ref()).collect();

    let appointments = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok(AppointmentSummary {
                id: row.get(0)?,
                patient_name: row.get(1)?,
                doctor_name: row.get(2)?,
                start_time: row.get(3)?,
                end_time: row.get(4)?,
                status: row.get(5)?,
                reason: row.get(6)?,
                total_amount: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(appointments)
}

// --- Appointment Procedures ---

pub fn add_procedure(
    conn: &Connection,
    req: &AddProcedureRequest,
) -> Result<AppointmentProcedure, String> {
    let quantity = req.quantity.unwrap_or(1);
    let discount_value = req.discount_value.unwrap_or(0.0);

    // Calculate final price
    let final_price = calculate_line_price(req.unit_price, quantity, req.discount_type.as_deref(), discount_value);

    conn.execute(
        "INSERT INTO appointment_procedures (appointment_id, procedure_id, quantity, unit_price, discount_type, discount_value, final_price, tooth_number, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            req.appointment_id,
            req.procedure_id,
            quantity,
            req.unit_price,
            req.discount_type,
            discount_value,
            final_price,
            req.tooth_number,
            req.notes,
        ],
    )
    .map_err(|e| format!("Error al agregar procedimiento: {}", e))?;

    let id = conn.last_insert_rowid();

    // Recalculate appointment total
    recalculate_total(conn, req.appointment_id)?;

    get_appointment_procedure(conn, id)
}

pub fn remove_procedure(
    conn: &Connection,
    appointment_procedure_id: i64,
    appointment_id: i64,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM appointment_procedures WHERE id = ?1 AND appointment_id = ?2",
        params![appointment_procedure_id, appointment_id],
    )
    .map_err(|e| format!("Error al eliminar procedimiento: {}", e))?;

    // Recalculate total
    recalculate_total(conn, appointment_id)?;
    Ok(())
}

pub fn get_appointment_procedures(
    conn: &Connection,
    appointment_id: i64,
) -> Result<Vec<AppointmentProcedure>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT ap.id, ap.appointment_id, ap.procedure_id, pr.name, pr.code,
                    ap.quantity, ap.unit_price, ap.discount_type, ap.discount_value,
                    ap.final_price, ap.tooth_number, ap.notes
             FROM appointment_procedures ap
             LEFT JOIN procedures pr ON pr.id = ap.procedure_id
             WHERE ap.appointment_id = ?1
             ORDER BY ap.id",
        )
        .map_err(|e| e.to_string())?;

    let procs = stmt
        .query_map(params![appointment_id], |row| {
            Ok(AppointmentProcedure {
                id: row.get(0)?,
                appointment_id: row.get(1)?,
                procedure_id: row.get(2)?,
                procedure_name: row.get(3)?,
                procedure_code: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
                discount_type: row.get(7)?,
                discount_value: row.get(8)?,
                final_price: row.get(9)?,
                tooth_number: row.get(10)?,
                notes: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(procs)
}

// --- Private helpers ---

fn get_appointment_procedure(
    conn: &Connection,
    id: i64,
) -> Result<AppointmentProcedure, String> {
    conn.query_row(
        "SELECT ap.id, ap.appointment_id, ap.procedure_id, pr.name, pr.code,
                ap.quantity, ap.unit_price, ap.discount_type, ap.discount_value,
                ap.final_price, ap.tooth_number, ap.notes
         FROM appointment_procedures ap
         LEFT JOIN procedures pr ON pr.id = ap.procedure_id
         WHERE ap.id = ?1",
        params![id],
        |row| {
            Ok(AppointmentProcedure {
                id: row.get(0)?,
                appointment_id: row.get(1)?,
                procedure_id: row.get(2)?,
                procedure_name: row.get(3)?,
                procedure_code: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
                discount_type: row.get(7)?,
                discount_value: row.get(8)?,
                final_price: row.get(9)?,
                tooth_number: row.get(10)?,
                notes: row.get(11)?,
            })
        },
    )
    .map_err(|_| "Procedimiento de cita no encontrado.".to_string())
}

fn check_overlap(
    conn: &Connection,
    doctor_id: i64,
    start_time: &str,
    end_time: &str,
    exclude_id: Option<i64>,
) -> Result<(), String> {
    let exclude = exclude_id.unwrap_or(0);
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM appointments
             WHERE doctor_id = ?1
               AND id != ?2
               AND status NOT IN ('cancelled', 'no_show')
               AND start_time < ?4
               AND end_time > ?3",
            params![doctor_id, exclude, start_time, end_time],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al verificar disponibilidad: {}", e))?;

    if count > 0 {
        return Err(
            "El doctor ya tiene una cita programada en ese horario. Por favor seleccione otro horario."
                .to_string(),
        );
    }
    Ok(())
}

fn recalculate_total(conn: &Connection, appointment_id: i64) -> Result<(), String> {
    let total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(final_price), 0) FROM appointment_procedures WHERE appointment_id = ?1",
            params![appointment_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al calcular total: {}", e))?;

    conn.execute(
        "UPDATE appointments SET total_amount = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![total, appointment_id],
    )
    .map_err(|e| format!("Error al actualizar total: {}", e))?;

    Ok(())
}

fn calculate_line_price(
    unit_price: f64,
    quantity: i32,
    discount_type: Option<&str>,
    discount_value: f64,
) -> f64 {
    let subtotal = unit_price * quantity as f64;
    let final_price = match discount_type {
        Some("percentage") => {
            let clamped = discount_value.clamp(0.0, 100.0);
            subtotal * (1.0 - clamped / 100.0)
        }
        Some("fixed") => {
            let clamped = discount_value.clamp(0.0, subtotal);
            subtotal - clamped
        }
        _ => subtotal,
    };
    (final_price * 100.0).round() / 100.0
}
