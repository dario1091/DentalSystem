use rusqlite::{params, Connection};

use crate::models::document::Document;

pub fn create(
    conn: &Connection,
    patient_id: i64,
    file_name: &str,
    original_name: &str,
    file_path: &str,
    file_size: i64,
    mime_type: &str,
    document_type: &str,
    notes: Option<&str>,
    uploaded_by: i64,
) -> Result<Document, String> {
    conn.execute(
        "INSERT INTO documents (patient_id, file_name, original_name, file_path, file_size, mime_type, document_type, notes, uploaded_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            patient_id,
            file_name,
            original_name,
            file_path,
            file_size,
            mime_type,
            document_type,
            notes,
            uploaded_by,
        ],
    )
    .map_err(|e| format!("Error al registrar documento: {}", e))?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Document, String> {
    conn.query_row(
        "SELECT d.id, d.patient_id, d.file_name, d.original_name, d.file_path,
                d.file_size, d.mime_type, d.document_type, d.notes,
                d.uploaded_by, u.display_name, d.created_at
         FROM documents d
         LEFT JOIN users u ON u.id = d.uploaded_by
         WHERE d.id = ?1",
        params![id],
        |row| {
            Ok(Document {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                file_name: row.get(2)?,
                original_name: row.get(3)?,
                file_path: row.get(4)?,
                file_size: row.get(5)?,
                mime_type: row.get(6)?,
                document_type: row.get(7)?,
                notes: row.get(8)?,
                uploaded_by: row.get(9)?,
                uploaded_by_name: row.get(10)?,
                created_at: row.get(11)?,
            })
        },
    )
    .map_err(|_| "Documento no encontrado.".to_string())
}

pub fn list_by_patient(
    conn: &Connection,
    patient_id: i64,
    document_type: Option<&str>,
) -> Result<Vec<Document>, String> {
    let mut query = String::from(
        "SELECT d.id, d.patient_id, d.file_name, d.original_name, d.file_path,
                d.file_size, d.mime_type, d.document_type, d.notes,
                d.uploaded_by, u.display_name, d.created_at
         FROM documents d
         LEFT JOIN users u ON u.id = d.uploaded_by
         WHERE d.patient_id = ?1",
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(patient_id)];

    if let Some(doc_type) = document_type {
        query.push_str(" AND d.document_type = ?2");
        param_values.push(Box::new(doc_type.to_string()));
    }

    query.push_str(" ORDER BY d.created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let results = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Document {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                file_name: row.get(2)?,
                original_name: row.get(3)?,
                file_path: row.get(4)?,
                file_size: row.get(5)?,
                mime_type: row.get(6)?,
                document_type: row.get(7)?,
                notes: row.get(8)?,
                uploaded_by: row.get(9)?,
                uploaded_by_name: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn delete(conn: &Connection, id: i64) -> Result<String, String> {
    // Get file path before deleting record
    let file_path: String = conn
        .query_row(
            "SELECT file_path FROM documents WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Documento no encontrado.".to_string())?;

    let affected = conn
        .execute("DELETE FROM documents WHERE id = ?1", params![id])
        .map_err(|e| format!("Error al eliminar documento: {}", e))?;

    if affected == 0 {
        return Err("Documento no encontrado.".to_string());
    }

    Ok(file_path)
}
