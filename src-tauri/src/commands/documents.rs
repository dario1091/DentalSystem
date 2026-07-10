use std::path::PathBuf;
use tauri::State;

use crate::db::repositories::document_repo;
use crate::db::Database;
use crate::models::document::{Document, ListDocumentsRequest, UploadDocumentRequest, MAX_FILE_SIZE};
use crate::services::file_manager;
use crate::services::session::SessionState;

/// Get the documents base path from settings, falling back to app data dir.
fn get_base_path(conn: &rusqlite::Connection, app_handle: &tauri::AppHandle) -> PathBuf {
    use tauri::Manager;
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let custom_path: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'documents_base_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(path) = custom_path {
        if !path.is_empty() {
            let p = PathBuf::from(&path);
            if p.is_absolute() {
                return p;
            }
        }
    }

    // Default: app data directory / documents
    app_dir.join("documents")
}

#[tauri::command]
pub fn upload_document(
    request: UploadDocumentRequest,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Document, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate file size
    if request.data.len() > MAX_FILE_SIZE {
        return Err("El archivo excede el tamaño máximo permitido (50 MB).".to_string());
    }

    // Detect and validate MIME type
    let mime_type = file_manager::detect_mime_type(&request.original_name)
        .ok_or_else(|| "Tipo de archivo no soportado.".to_string())?;

    if !file_manager::is_allowed_mime(mime_type) {
        return Err("Tipo de archivo no permitido. Solo: JPG, PNG, WEBP, PDF.".to_string());
    }

    // Save to filesystem
    let base_path = get_base_path(&conn, &app_handle);
    let (file_name, full_path) = file_manager::save_file(
        &base_path,
        request.patient_id,
        &request.document_type,
        &request.original_name,
        &request.data,
    )?;

    let file_path_str = full_path.to_string_lossy().to_string();

    // Register in database
    let document = document_repo::create(
        &conn,
        request.patient_id,
        &file_name,
        &request.original_name,
        &file_path_str,
        request.data.len() as i64,
        mime_type,
        &request.document_type,
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "upload_document", document.id);
    Ok(document)
}

#[tauri::command]
pub fn list_documents(
    request: ListDocumentsRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Document>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    document_repo::list_by_patient(&conn, request.patient_id, request.document_type.as_deref())
}

#[tauri::command]
pub fn get_document_data(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<u8>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let doc = document_repo::get_by_id(&conn, id)?;
    file_manager::read_file(&doc.file_path)
}

#[tauri::command]
pub fn delete_document(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let file_path = document_repo::delete(&conn, id)?;

    // Delete from filesystem (best effort)
    let _ = file_manager::delete_file(&file_path);

    log_audit(&conn, user.id, "delete_document", id);
    Ok(())
}

#[tauri::command]
pub fn set_documents_path(
    path: String,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    use crate::models::user::UserRole;
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Upsert setting
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('documents_base_path', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        rusqlite::params![path],
    )
    .map_err(|e| format!("Error al guardar configuración: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_documents_path(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let path = get_base_path(&conn, &app_handle);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_disk_space(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<u64, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let path = get_base_path(&conn, &app_handle);
    file_manager::get_available_space(&path)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'documents', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
