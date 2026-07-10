use rusqlite::{params, Connection};

use crate::models::patient::{
    CreatePatientRequest, Patient, PatientSummary, SearchPatientsRequest, UpdatePatientRequest,
};

/// Create a new patient. Returns the created patient.
pub fn create(conn: &Connection, req: &CreatePatientRequest) -> Result<Patient, String> {
    let consent_date = if req.data_consent {
        Some(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string())
    } else {
        None
    };

    conn.execute(
        "INSERT INTO patients (document_type, document_number, first_name, last_name, birth_date, gender, marital_status, phone, phone_secondary, email, address, eps, blood_type, allergies, current_medications, medical_history, guardian_name, guardian_relationship, guardian_phone, data_consent, data_consent_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
        params![
            req.document_type,
            req.document_number,
            req.first_name,
            req.last_name,
            req.birth_date,
            req.gender,
            req.marital_status,
            req.phone,
            req.phone_secondary,
            req.email,
            req.address,
            req.eps,
            req.blood_type,
            req.allergies,
            req.current_medications,
            req.medical_history,
            req.guardian_name,
            req.guardian_relationship,
            req.guardian_phone,
            req.data_consent as i32,
            consent_date,
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Ya existe un paciente con ese número de documento.".to_string()
        } else {
            format!("Error al crear paciente: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

/// Get a patient by ID.
pub fn get_by_id(conn: &Connection, id: i64) -> Result<Patient, String> {
    conn.query_row(
        "SELECT id, document_type, document_number, first_name, last_name, birth_date, gender, marital_status, phone, phone_secondary, email, address, eps, blood_type, allergies, current_medications, medical_history, guardian_name, guardian_relationship, guardian_phone, photo_path, data_consent, data_consent_date, is_active, created_at, updated_at
         FROM patients WHERE id = ?1",
        params![id],
        |row| Ok(row_to_patient(row)),
    )
    .map_err(|_| "Paciente no encontrado.".to_string())
}

/// Search patients by name, document number, or phone.
pub fn search(conn: &Connection, req: &SearchPatientsRequest) -> Result<Vec<PatientSummary>, String> {
    let active_only = req.active_only.unwrap_or(true);
    let limit = req.limit.unwrap_or(50);
    let offset = req.offset.unwrap_or(0);

    let has_query = req.query.as_ref().map_or(false, |q| !q.trim().is_empty());

    let active_filter = if active_only { " AND is_active = 1" } else { "" };

    let sql = if has_query {
        format!(
            "SELECT id, document_type, document_number, first_name, last_name, phone, is_active, created_at
             FROM patients WHERE (first_name || ' ' || last_name LIKE ?1 OR document_number LIKE ?1 OR phone LIKE ?1){}
             ORDER BY last_name, first_name LIMIT ?2 OFFSET ?3",
            active_filter
        )
    } else {
        format!(
            "SELECT id, document_type, document_number, first_name, last_name, phone, is_active, created_at
             FROM patients WHERE 1=1 {}
             ORDER BY last_name, first_name LIMIT ?1 OFFSET ?2",
            active_filter
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let patients = if has_query {
        let like = format!("%{}%", req.query.as_ref().unwrap().trim());
        stmt.query_map(params![like, limit, offset], |row| {
            Ok(row_to_summary(row))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map(params![limit, offset], |row| {
            Ok(row_to_summary(row))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };

    Ok(patients)
}

/// Update a patient's fields.
pub fn update(conn: &Connection, req: &UpdatePatientRequest) -> Result<Patient, String> {
    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    macro_rules! push_field {
        ($field:expr, $col:expr) => {
            if let Some(ref val) = $field {
                sets.push(format!("{} = ?", $col));
                values.push(Box::new(val.clone()));
            }
        };
    }

    push_field!(req.document_type, "document_type");
    push_field!(req.document_number, "document_number");
    push_field!(req.first_name, "first_name");
    push_field!(req.last_name, "last_name");
    push_field!(req.birth_date, "birth_date");
    push_field!(req.gender, "gender");
    push_field!(req.marital_status, "marital_status");
    push_field!(req.phone, "phone");
    push_field!(req.phone_secondary, "phone_secondary");
    push_field!(req.email, "email");
    push_field!(req.address, "address");
    push_field!(req.eps, "eps");
    push_field!(req.blood_type, "blood_type");
    push_field!(req.allergies, "allergies");
    push_field!(req.current_medications, "current_medications");
    push_field!(req.medical_history, "medical_history");
    push_field!(req.guardian_name, "guardian_name");
    push_field!(req.guardian_relationship, "guardian_relationship");
    push_field!(req.guardian_phone, "guardian_phone");

    if let Some(consent) = req.data_consent {
        sets.push("data_consent = ?".to_string());
        values.push(Box::new(consent as i32));
        if consent {
            sets.push("data_consent_date = datetime('now')".to_string());
        }
    }

    if sets.is_empty() {
        return get_by_id(conn, req.id);
    }

    sets.push("updated_at = datetime('now')".to_string());

    let sql = format!("UPDATE patients SET {} WHERE id = ?", sets.join(", "));
    values.push(Box::new(req.id));

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "Ya existe un paciente con ese número de documento.".to_string()
            } else {
                format!("Error al actualizar paciente: {}", e)
            }
        })?;

    get_by_id(conn, req.id)
}

/// Soft-delete: deactivate a patient.
pub fn deactivate(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE patients SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Error al desactivar paciente: {}", e))?;
    Ok(())
}

/// Count total patients (for pagination info).
pub fn count(conn: &Connection, active_only: bool) -> Result<u32, String> {
    let sql = if active_only {
        "SELECT COUNT(*) FROM patients WHERE is_active = 1"
    } else {
        "SELECT COUNT(*) FROM patients"
    };
    conn.query_row(sql, [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

// --- Helpers ---

fn row_to_summary(row: &rusqlite::Row) -> PatientSummary {
    PatientSummary {
        id: row.get(0).unwrap_or_default(),
        document_type: row.get(1).unwrap_or_default(),
        document_number: row.get(2).unwrap_or_default(),
        first_name: row.get(3).unwrap_or_default(),
        last_name: row.get(4).unwrap_or_default(),
        phone: row.get(5).unwrap_or_default(),
        is_active: row.get::<_, i32>(6).unwrap_or_default() != 0,
        created_at: row.get(7).unwrap_or_default(),
    }
}

fn row_to_patient(row: &rusqlite::Row) -> Patient {
    Patient {
        id: row.get(0).unwrap_or_default(),
        document_type: row.get(1).unwrap_or_default(),
        document_number: row.get(2).unwrap_or_default(),
        first_name: row.get(3).unwrap_or_default(),
        last_name: row.get(4).unwrap_or_default(),
        birth_date: row.get(5).unwrap_or_default(),
        gender: row.get(6).unwrap_or_default(),
        marital_status: row.get(7).unwrap_or_default(),
        phone: row.get(8).unwrap_or_default(),
        phone_secondary: row.get(9).unwrap_or_default(),
        email: row.get(10).unwrap_or_default(),
        address: row.get(11).unwrap_or_default(),
        eps: row.get(12).unwrap_or_default(),
        blood_type: row.get(13).unwrap_or_default(),
        allergies: row.get(14).unwrap_or_default(),
        current_medications: row.get(15).unwrap_or_default(),
        medical_history: row.get(16).unwrap_or_default(),
        guardian_name: row.get(17).unwrap_or_default(),
        guardian_relationship: row.get(18).unwrap_or_default(),
        guardian_phone: row.get(19).unwrap_or_default(),
        photo_path: row.get(20).unwrap_or_default(),
        data_consent: row.get::<_, i32>(21).unwrap_or_default() != 0,
        data_consent_date: row.get(22).unwrap_or_default(),
        is_active: row.get::<_, i32>(23).unwrap_or_default() != 0,
        created_at: row.get(24).unwrap_or_default(),
        updated_at: row.get(25).unwrap_or_default(),
    }
}
