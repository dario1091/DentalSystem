use rusqlite::{params, Connection};

use crate::models::consent::Consent;

pub fn create(
    conn: &Connection,
    patient_id: i64,
    appointment_id: Option<i64>,
    procedure_id: Option<i64>,
    template_name: &str,
    notes: Option<&str>,
    pdf_path: Option<&str>,
    created_by: i64,
) -> Result<Consent, String> {
    conn.execute(
        "INSERT INTO consents (patient_id, appointment_id, procedure_id, template_name, notes, pdf_path, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![patient_id, appointment_id, procedure_id, template_name, notes, pdf_path, created_by],
    )
    .map_err(|e| format!("Error al crear consentimiento: {}", e))?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Consent, String> {
    conn.query_row(
        "SELECT c.id, c.patient_id, c.appointment_id, c.procedure_id, c.template_name,
                c.status, c.pdf_path, c.signature_path, c.signed_pdf_path, c.notes,
                c.sent_at, c.signed_at, c.created_by, u.display_name, c.created_at,
                (p.first_name || ' ' || p.last_name) as patient_name,
                pr.name as procedure_name
         FROM consents c
         LEFT JOIN users u ON u.id = c.created_by
         LEFT JOIN patients p ON p.id = c.patient_id
         LEFT JOIN procedures pr ON pr.id = c.procedure_id
         WHERE c.id = ?1",
        params![id],
        |row| {
            Ok(Consent {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                appointment_id: row.get(2)?,
                procedure_id: row.get(3)?,
                template_name: row.get(4)?,
                status: row.get(5)?,
                pdf_path: row.get(6)?,
                signature_path: row.get(7)?,
                signed_pdf_path: row.get(8)?,
                notes: row.get(9)?,
                sent_at: row.get(10)?,
                signed_at: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                created_at: row.get(14)?,
                patient_name: row.get(15)?,
                procedure_name: row.get(16)?,
            })
        },
    )
    .map_err(|_| "Consentimiento no encontrado.".to_string())
}

pub fn list_by_patient(conn: &Connection, patient_id: i64) -> Result<Vec<Consent>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.patient_id, c.appointment_id, c.procedure_id, c.template_name,
                    c.status, c.pdf_path, c.signature_path, c.signed_pdf_path, c.notes,
                    c.sent_at, c.signed_at, c.created_by, u.display_name, c.created_at,
                    (p.first_name || ' ' || p.last_name) as patient_name,
                    pr.name as procedure_name
             FROM consents c
             LEFT JOIN users u ON u.id = c.created_by
             LEFT JOIN patients p ON p.id = c.patient_id
             LEFT JOIN procedures pr ON pr.id = c.procedure_id
             WHERE c.patient_id = ?1
             ORDER BY c.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![patient_id], |row| {
            Ok(Consent {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                appointment_id: row.get(2)?,
                procedure_id: row.get(3)?,
                template_name: row.get(4)?,
                status: row.get(5)?,
                pdf_path: row.get(6)?,
                signature_path: row.get(7)?,
                signed_pdf_path: row.get(8)?,
                notes: row.get(9)?,
                sent_at: row.get(10)?,
                signed_at: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                created_at: row.get(14)?,
                patient_name: row.get(15)?,
                procedure_name: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn update_status(conn: &Connection, id: i64, status: &str) -> Result<Consent, String> {
    let extra = match status {
        "sent" => ", sent_at = datetime('now', 'localtime')",
        "signed" => ", signed_at = datetime('now', 'localtime')",
        _ => "",
    };

    let sql = format!("UPDATE consents SET status = ?1{} WHERE id = ?2", extra);
    conn.execute(&sql, params![status, id])
        .map_err(|e| format!("Error al actualizar estado: {}", e))?;

    get_by_id(conn, id)
}

pub fn set_signature_path(conn: &Connection, id: i64, path: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE consents SET signature_path = ?1, status = 'signed', signed_at = datetime('now', 'localtime') WHERE id = ?2",
        params![path, id],
    )
    .map_err(|e| format!("Error al guardar firma: {}", e))?;
    Ok(())
}

pub fn set_pdf_path(conn: &Connection, id: i64, path: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE consents SET pdf_path = ?1 WHERE id = ?2",
        params![path, id],
    )
    .map_err(|e| format!("Error al guardar PDF: {}", e))?;
    Ok(())
}
