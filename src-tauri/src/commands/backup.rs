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
) -> Result<String, String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (db_path, docs_path, _) = get_paths(&conn, &app_handle);
    let zip = PathBuf::from(&zip_path);

    if !zip.exists() {
        return Err("Archivo de backup no encontrado.".to_string());
    }

    // Release the DB lock before restore
    drop(conn);

    backup_service::restore_backup(&zip, &db_path, &docs_path)?;

    // Return message - frontend must trigger app restart
    Ok("Backup restaurado exitosamente. La aplicación se reiniciará.".to_string())
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

/// Save clinic logo image. Returns the path where it was saved.
#[tauri::command]
pub fn save_clinic_logo(
    data: Vec<u8>,
    file_name: String,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let logo_dir = app_dir.join("clinic");
    std::fs::create_dir_all(&logo_dir).map_err(|e| e.to_string())?;

    // Determine extension
    let ext = file_name.rsplit('.').next().unwrap_or("png");
    let logo_path = logo_dir.join(format!("logo.{}", ext));

    std::fs::write(&logo_path, &data)
        .map_err(|e| format!("Error al guardar logo: {}", e))?;

    let path_str = logo_path.to_string_lossy().to_string();

    // Save path in settings
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('clinic_logo_path', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
        rusqlite::params![path_str],
    )
    .map_err(|e| e.to_string())?;

    Ok(path_str)
}

/// Initial setup: save clinic info (used on first run). Rejects if already completed.
#[tauri::command]
pub fn initial_setup(
    clinic_name: String,
    clinic_address: String,
    clinic_phone: String,
    logo_data: Option<Vec<u8>>,
    logo_file_name: Option<String>,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Prevent re-invocation
    let already_done: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = 'setup_completed'", [], |row| row.get(0))
        .ok();
    if already_done.as_deref() == Some("true") {
        return Err("La configuración inicial ya fue completada. Use la pantalla de Configuración para modificar datos.".to_string());
    }

    // Save clinic info
    let settings = vec![
        ("clinic_name", clinic_name.as_str()),
        ("clinic_address", clinic_address.as_str()),
        ("clinic_phone", clinic_phone.as_str()),
        ("setup_completed", "true"),
    ];

    for (key, value) in settings {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            rusqlite::params![key, value],
        )
        .map_err(|e| format!("Error al guardar {}: {}", key, e))?;
    }

    // Save logo if provided
    if let (Some(data), Some(file_name)) = (logo_data, logo_file_name) {
        use tauri::Manager;
        let app_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
        let logo_dir = app_dir.join("clinic");
        std::fs::create_dir_all(&logo_dir).map_err(|e| e.to_string())?;

        let ext = file_name.rsplit('.').next().unwrap_or("png");
        let logo_path = logo_dir.join(format!("logo.{}", ext));
        std::fs::write(&logo_path, &data)
            .map_err(|e| format!("Error al guardar logo: {}", e))?;

        let path_str = logo_path.to_string_lossy().to_string();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('clinic_logo_path', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
            rusqlite::params![path_str],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Check if initial setup has been completed
#[tauri::command]
pub fn is_setup_completed(
    db: State<'_, Database>,
) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let result: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'setup_completed'",
            [],
            |row| row.get(0),
        )
        .ok();
    Ok(result.as_deref() == Some("true"))
}
