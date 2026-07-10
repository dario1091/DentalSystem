use rusqlite::{params, Connection};

use crate::models::doctor::{CreateDoctorRequest, Doctor, DoctorSummary, UpdateDoctorRequest};

pub fn create(conn: &Connection, req: &CreateDoctorRequest) -> Result<Doctor, String> {
    conn.execute(
        "INSERT INTO doctors (document_type, document_number, first_name, last_name, professional_license, specialty, university, phone, email)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            req.document_type,
            req.document_number,
            req.first_name,
            req.last_name,
            req.professional_license,
            req.specialty,
            req.university,
            req.phone,
            req.email,
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: doctors.document_number") {
            "Ya existe un doctor con ese número de documento.".to_string()
        } else if e.to_string().contains("UNIQUE constraint failed: doctors.professional_license") {
            "Ya existe un doctor con ese registro profesional.".to_string()
        } else {
            format!("Error al crear doctor: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Doctor, String> {
    conn.query_row(
        "SELECT id, document_type, document_number, first_name, last_name, professional_license, specialty, university, phone, email, signature_path, is_active, created_at, updated_at
         FROM doctors WHERE id = ?1",
        params![id],
        |row| {
            Ok(Doctor {
                id: row.get(0)?,
                document_type: row.get(1)?,
                document_number: row.get(2)?,
                first_name: row.get(3)?,
                last_name: row.get(4)?,
                professional_license: row.get(5)?,
                specialty: row.get(6)?,
                university: row.get(7)?,
                phone: row.get(8)?,
                email: row.get(9)?,
                signature_path: row.get(10)?,
                is_active: row.get::<_, i32>(11)? != 0,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        },
    )
    .map_err(|_| "Doctor no encontrado.".to_string())
}

pub fn list(conn: &Connection, active_only: bool) -> Result<Vec<DoctorSummary>, String> {
    let sql = if active_only {
        "SELECT id, first_name, last_name, professional_license, specialty, is_active FROM doctors WHERE is_active = 1 ORDER BY last_name, first_name"
    } else {
        "SELECT id, first_name, last_name, professional_license, specialty, is_active FROM doctors ORDER BY last_name, first_name"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let doctors = stmt
        .query_map([], |row| {
            Ok(DoctorSummary {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                professional_license: row.get(3)?,
                specialty: row.get(4)?,
                is_active: row.get::<_, i32>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(doctors)
}

pub fn update(conn: &Connection, req: &UpdateDoctorRequest) -> Result<Doctor, String> {
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
    push_field!(req.professional_license, "professional_license");
    push_field!(req.specialty, "specialty");
    push_field!(req.university, "university");
    push_field!(req.phone, "phone");
    push_field!(req.email, "email");

    if let Some(active) = req.is_active {
        sets.push("is_active = ?".to_string());
        values.push(Box::new(active as i32));
    }

    if sets.is_empty() {
        return get_by_id(conn, req.id);
    }

    sets.push("updated_at = datetime('now')".to_string());

    let sql = format!("UPDATE doctors SET {} WHERE id = ?", sets.join(", "));
    values.push(Box::new(req.id));

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "Documento o registro profesional duplicado.".to_string()
            } else {
                format!("Error al actualizar doctor: {}", e)
            }
        })?;

    get_by_id(conn, req.id)
}

pub fn deactivate(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE doctors SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Error al desactivar doctor: {}", e))?;
    Ok(())
}
