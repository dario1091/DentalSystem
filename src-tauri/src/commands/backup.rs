use std::path::PathBuf;
use tauri::State;

use crate::db::Database;
use crate::models::user::UserRole;
use crate::services::backup_service::{self, BackupInfo};
use crate::services::session::SessionState;

fn get_paths(conn: &rusqlite::Connection, app_handle: &tauri::AppHandle) -> (PathBuf, PathBuf, PathBuf) {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));

    let db_path = app_dir.join("dental_system.db");

    let docs_path = conn
        .query_row("SELECT value FROM settings WHERE key = 'documents_base_path'", [], |r| r.get::<_, String>(0))
        .ok()
        .filter(|p| !p.is_empty() && PathBuf::from(p).is_absolute())
        .map(PathBuf::from)
        .unwrap_or_else(|| app_dir.join("documents"));

    let backup_path = conn
        .query_row("SELECT value FROM settings WHERE key = 'backup_path'", [], |r| r.get::<_, String>(0))
        .ok()
        .filter(|p| !p.is_empty() && PathBuf::from(p).is_absolute())
        .map(PathBuf::from)
        .unwrap_or_else(|| app_dir.join("backups"));

    (db_path, docs_path, backup_path)
}

#[tauri::command]
pub fn create_backup(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (db_path, docs_path, backup_dir) = get_paths(&conn, &app_handle);
    backup_service::create_backup(&db_path, &docs_path, &backup_dir)
}

#[tauri::command]
pub fn restore_backup(
    zip_path: String,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (db_path, docs_path, _) = get_paths(&conn, &app_handle);
    let zip = PathBuf::from(&zip_path);

    if !zip.exists() {
        return Err("Archivo de backup no encontrado.".to_string());
    }

    // Drop connection before restore (we'll need app restart)
    drop(conn);

    backup_service::restore_backup(&zip, &db_path, &docs_path)?;

    Ok(())
}

#[tauri::command]
pub fn list_backups(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<BackupInfo>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (_, _, backup_dir) = get_paths(&conn, &app_handle);
    backup_service::list_backups(&backup_dir)
}

#[tauri::command]
pub fn get_last_backup_date(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Option<String>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (_, _, backup_dir) = get_paths(&conn, &app_handle);
    let backups = backup_service::list_backups(&backup_dir)?;
    Ok(backups.first().map(|b| b.created_at.clone()))
}

/// Get and update settings
#[tauri::command]
pub fn get_settings(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<(String, String)>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[tauri::command]
pub fn update_settings(
    settings: Vec<(String, String)>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    for (key, value) in &settings {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            rusqlite::params![key, value],
        )
        .map_err(|e| format!("Error al guardar {}: {}", key, e))?;
    }

    Ok(())
}
