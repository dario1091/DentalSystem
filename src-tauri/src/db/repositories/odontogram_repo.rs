use rusqlite::{params, Connection};

use crate::models::odontogram::{
    AddFindingRequest, CreateOdontogramRequest, Odontogram, OdontogramDetail, OdontogramFinding,
    OdontogramSummary,
};

pub fn create(
    conn: &Connection,
    req: &CreateOdontogramRequest,
    user_id: i64,
) -> Result<Odontogram, String> {
    let dentition_type = req.dentition_type.as_deref().unwrap_or("permanent");
    let is_initial = req.is_initial.unwrap_or(false);

    conn.execute(
        "INSERT INTO odontograms (patient_id, appointment_id, dentition_type, is_initial, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            req.patient_id,
            req.appointment_id,
            dentition_type,
            is_initial as i32,
            req.notes,
            user_id,
        ],
    )
    .map_err(|e| format!("Error al crear odontograma: {}", e))?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Odontogram, String> {
    conn.query_row(
        "SELECT o.id, o.patient_id, o.appointment_id, o.dentition_type, o.is_initial,
                o.notes, o.created_by, u.display_name, o.created_at,
                (SELECT COUNT(*) FROM odontogram_findings WHERE odontogram_id = o.id) as findings_count
         FROM odontograms o
         LEFT JOIN users u ON u.id = o.created_by
         WHERE o.id = ?1",
        params![id],
        |row| {
            Ok(Odontogram {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                appointment_id: row.get(2)?,
                dentition_type: row.get(3)?,
                is_initial: row.get::<_, i32>(4)? != 0,
                notes: row.get(5)?,
                created_by: row.get(6)?,
                created_by_name: row.get(7)?,
                created_at: row.get(8)?,
                findings_count: row.get(9)?,
            })
        },
    )
    .map_err(|_| "Odontograma no encontrado.".to_string())
}

pub fn get_by_patient(conn: &Connection, patient_id: i64) -> Result<Vec<OdontogramSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT o.id, o.patient_id, o.dentition_type, o.is_initial, u.display_name, o.created_at,
                    (SELECT COUNT(*) FROM odontogram_findings WHERE odontogram_id = o.id) as findings_count
             FROM odontograms o
             LEFT JOIN users u ON u.id = o.created_by
             WHERE o.patient_id = ?1
             ORDER BY o.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![patient_id], |row| {
            Ok(OdontogramSummary {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                dentition_type: row.get(2)?,
                is_initial: row.get::<_, i32>(3)? != 0,
                created_by_name: row.get(4)?,
                created_at: row.get(5)?,
                findings_count: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn get_detail(conn: &Connection, odontogram_id: i64) -> Result<OdontogramDetail, String> {
    let odontogram = get_by_id(conn, odontogram_id)?;
    let findings = get_findings(conn, odontogram_id)?;

    Ok(OdontogramDetail {
        odontogram,
        findings,
    })
}

pub fn get_findings(conn: &Connection, odontogram_id: i64) -> Result<Vec<OdontogramFinding>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, odontogram_id, tooth_number, face, finding_type, color, notes, created_at
             FROM odontogram_findings
             WHERE odontogram_id = ?1
             ORDER BY tooth_number, face",
        )
        .map_err(|e| e.to_string())?;

    let findings = stmt
        .query_map(params![odontogram_id], |row| {
            Ok(OdontogramFinding {
                id: row.get(0)?,
                odontogram_id: row.get(1)?,
                tooth_number: row.get(2)?,
                face: row.get(3)?,
                finding_type: row.get(4)?,
                color: row.get(5)?,
                notes: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(findings)
}

pub fn add_finding(conn: &Connection, req: &AddFindingRequest) -> Result<OdontogramFinding, String> {
    // If finding is "full" type (affects whole tooth), remove existing findings for that tooth first
    if req.face.as_deref() == Some("full") {
        conn.execute(
            "DELETE FROM odontogram_findings WHERE odontogram_id = ?1 AND tooth_number = ?2",
            params![req.odontogram_id, req.tooth_number],
        )
        .map_err(|e| format!("Error al limpiar hallazgos previos: {}", e))?;
    } else {
        // Remove any existing finding for the same tooth+face
        conn.execute(
            "DELETE FROM odontogram_findings WHERE odontogram_id = ?1 AND tooth_number = ?2 AND face = ?3",
            params![req.odontogram_id, req.tooth_number, req.face],
        )
        .map_err(|e| format!("Error al reemplazar hallazgo: {}", e))?;
    }

    conn.execute(
        "INSERT INTO odontogram_findings (odontogram_id, tooth_number, face, finding_type, color, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            req.odontogram_id,
            req.tooth_number,
            req.face,
            req.finding_type,
            req.color,
            req.notes,
        ],
    )
    .map_err(|e| format!("Error al agregar hallazgo: {}", e))?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, odontogram_id, tooth_number, face, finding_type, color, notes, created_at
         FROM odontogram_findings WHERE id = ?1",
        params![id],
        |row| {
            Ok(OdontogramFinding {
                id: row.get(0)?,
                odontogram_id: row.get(1)?,
                tooth_number: row.get(2)?,
                face: row.get(3)?,
                finding_type: row.get(4)?,
                color: row.get(5)?,
                notes: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|_| "Error al obtener hallazgo creado.".to_string())
}

pub fn remove_finding(
    conn: &Connection,
    finding_id: i64,
    odontogram_id: i64,
) -> Result<(), String> {
    let affected = conn
        .execute(
            "DELETE FROM odontogram_findings WHERE id = ?1 AND odontogram_id = ?2",
            params![finding_id, odontogram_id],
        )
        .map_err(|e| format!("Error al eliminar hallazgo: {}", e))?;

    if affected == 0 {
        return Err("Hallazgo no encontrado.".to_string());
    }
    Ok(())
}
