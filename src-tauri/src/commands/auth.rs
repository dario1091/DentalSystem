use tauri::State;

use crate::db::Database;
use crate::models::user::{UserInfo, UserRole, CreateUserRequest, UpdateUserRequest};
use crate::services::auth_service;
use crate::services::session::SessionState;

#[tauri::command]
pub fn login(
    username: String,
    password: String,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<UserInfo, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let user = auth_service::login(&conn, &username, &password).map_err(|e| e.to_string())?;
    let user_info: UserInfo = user.into();
    session.set_user(user_info.clone())?;
    Ok(user_info)
}

#[tauri::command]
pub fn logout(session: State<'_, SessionState>) -> Result<(), String> {
    session.clear()
}

#[tauri::command]
pub fn get_current_user(session: State<'_, SessionState>) -> Result<Option<UserInfo>, String> {
    session.get()
}

#[tauri::command]
pub fn change_password(
    current_password: String,
    new_password: String,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    auth_service::change_password(&conn, user.id, &current_password, &new_password)
        .map_err(|e| e.to_string())?;

    // Update session to reflect must_change_password = false
    let updated_user = auth_service::get_user_by_id(&conn, user.id).map_err(|e| e.to_string())?;
    session.set_user(updated_user.into())?;
    Ok(())
}

#[tauri::command]
pub fn create_user(
    request: CreateUserRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<UserInfo, String> {
    // Only master can create users
    session.require_role(&UserRole::Master)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Check username uniqueness
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM users WHERE username = ?1",
            rusqlite::params![request.username],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if exists {
        return Err("El nombre de usuario ya existe.".to_string());
    }

    let password_hash =
        auth_service::hash_password(&request.password).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO users (username, password_hash, role, doctor_id, display_name, must_change_password) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        rusqlite::params![
            request.username,
            password_hash,
            request.role.as_str(),
            request.doctor_id,
            request.display_name,
        ],
    )
    .map_err(|e| format!("Error al crear usuario: {}", e))?;

    let id = conn.last_insert_rowid();
    let user = auth_service::get_user_by_id(&conn, id).map_err(|e| e.to_string())?;

    // Audit log
    log_audit(&conn, session.require_user()?.id, "create_user", "users", Some(id));

    Ok(user.into())
}

#[tauri::command]
pub fn update_user(
    request: UpdateUserRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<UserInfo, String> {
    session.require_role(&UserRole::Master)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Build dynamic update
    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref username) = request.username {
        updates.push("username = ?");
        values.push(Box::new(username.clone()));
    }
    if let Some(ref role) = request.role {
        updates.push("role = ?");
        values.push(Box::new(role.as_str().to_string()));
    }
    if let Some(ref display_name) = request.display_name {
        updates.push("display_name = ?");
        values.push(Box::new(display_name.clone()));
    }
    if let Some(is_active) = request.is_active {
        updates.push("is_active = ?");
        values.push(Box::new(is_active as i32));
    }
    if let Some(doctor_id) = request.doctor_id {
        updates.push("doctor_id = ?");
        values.push(Box::new(doctor_id));
    }

    if updates.is_empty() {
        return Err("No hay campos para actualizar.".to_string());
    }

    updates.push("updated_at = datetime('now')");

    let sql = format!("UPDATE users SET {} WHERE id = ?", updates.join(", "));
    values.push(Box::new(request.id));

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())
        .map_err(|e| format!("Error al actualizar usuario: {}", e))?;

    let user = auth_service::get_user_by_id(&conn, request.id).map_err(|e| e.to_string())?;

    log_audit(&conn, session.require_user()?.id, "update_user", "users", Some(request.id));

    Ok(user.into())
}

#[tauri::command]
pub fn list_users(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<UserInfo>, String> {
    session.require_role(&UserRole::Master)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, username, role, doctor_id, display_name, is_active, must_change_password, failed_login_attempts, locked_until, last_login, created_at, updated_at FROM users ORDER BY id")
        .map_err(|e| e.to_string())?;

    let users = stmt
        .query_map([], |row| {
            Ok(UserInfo {
                id: row.get(0)?,
                username: row.get(1)?,
                role: UserRole::from_str(&row.get::<_, String>(2)?).unwrap_or(UserRole::Auxiliary),
                display_name: row.get(4)?,
                must_change_password: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(users)
}

#[tauri::command]
pub fn reset_user_password(
    user_id: i64,
    new_password: String,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    session.require_role(&UserRole::Master)?;

    if new_password.len() < 6 {
        return Err("La contraseña debe tener al menos 6 caracteres.".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let hash = auth_service::hash_password(&new_password)?;

    conn.execute(
        "UPDATE users SET password_hash = ?1, must_change_password = 1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![hash, user_id],
    )
    .map_err(|e| format!("Error al resetear contraseña: {}", e))?;

    log_audit(&conn, session.require_user()?.id, "reset_password", "users", Some(user_id));

    Ok(())
}

/// Log an action to the audit table.
fn log_audit(conn: &Connection, user_id: i64, action: &str, entity_type: &str, entity_id: Option<i64>) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![user_id, action, entity_type, entity_id],
    );
}

use rusqlite::Connection;
