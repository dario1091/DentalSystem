use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rusqlite::{params, Connection};

use crate::models::user::{User, UserRole};

/// Hash a password using Argon2id.
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;
    Ok(hash.to_string())
}

/// Verify a password against a stored hash.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| format!("Invalid password hash: {}", e))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Attempt login. Returns the user if credentials are valid.
pub fn login(conn: &Connection, username: &str, password: &str) -> Result<User, AuthError> {
    let user = get_user_by_username(conn, username)?;

    // Check if account is locked
    if let Some(ref locked_until) = user.locked_until {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        if locked_until > &now {
            return Err(AuthError::AccountLocked);
        } else {
            // Lock expired, reset attempts
            reset_failed_attempts(conn, user.id)?;
        }
    }

    // Check if active
    if !user.is_active {
        return Err(AuthError::AccountInactive);
    }

    // Verify password
    let password_hash = get_password_hash(conn, user.id)?;
    let is_valid = verify_password(password, &password_hash).unwrap_or(false);

    if !is_valid {
        increment_failed_attempts(conn, user.id)?;
        let attempts = user.failed_login_attempts + 1;
        let max_attempts = get_max_attempts(conn);
        if attempts >= max_attempts {
            lock_account(conn, user.id)?;
            return Err(AuthError::AccountLocked);
        }
        return Err(AuthError::InvalidCredentials);
    }

    // Successful login: reset attempts and update last_login
    reset_failed_attempts(conn, user.id)?;
    update_last_login(conn, user.id)?;

    // Return fresh user data
    get_user_by_id(conn, user.id).map_err(|_| AuthError::InternalError)
}

/// Change a user's password.
pub fn change_password(
    conn: &Connection,
    user_id: i64,
    current_password: &str,
    new_password: &str,
) -> Result<(), AuthError> {
    let password_hash = get_password_hash(conn, user_id)?;

    // Verify current password (skip if it's the pending hash from seed)
    if password_hash != "__PENDING_HASH__" {
        let is_valid = verify_password(current_password, &password_hash).unwrap_or(false);
        if !is_valid {
            return Err(AuthError::InvalidCredentials);
        }
    }

    // Validate new password
    if new_password.len() < 6 {
        return Err(AuthError::WeakPassword);
    }

    let new_hash = hash_password(new_password).map_err(|_| AuthError::InternalError)?;

    conn.execute(
        "UPDATE users SET password_hash = ?1, must_change_password = 0, updated_at = datetime('now') WHERE id = ?2",
        params![new_hash, user_id],
    )
    .map_err(|_| AuthError::InternalError)?;

    Ok(())
}

/// Ensure the admin seed has a proper hash (called on startup).
pub fn ensure_admin_hash(conn: &Connection) -> Result<(), String> {
    let result: Result<(i64, String), _> = conn.query_row(
        "SELECT id, password_hash FROM users WHERE username = 'admin'",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    if let Ok((id, hash)) = result {
        if hash == "__PENDING_HASH__" {
            let hashed = hash_password("admin123")?;
            conn.execute(
                "UPDATE users SET password_hash = ?1 WHERE id = ?2",
                params![hashed, id],
            )
            .map_err(|e| format!("Failed to update admin hash: {}", e))?;
            log::info!("Admin user password hash initialized.");
        }
    }

    Ok(())
}

// --- Helper functions ---

fn get_user_by_username(conn: &Connection, username: &str) -> Result<User, AuthError> {
    conn.query_row(
        "SELECT id, username, role, doctor_id, display_name, is_active, must_change_password, failed_login_attempts, locked_until, last_login, created_at, updated_at FROM users WHERE username = ?1",
        params![username],
        |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: UserRole::from_str(&row.get::<_, String>(2)?).unwrap_or(UserRole::Auxiliary),
                doctor_id: row.get(3)?,
                display_name: row.get(4)?,
                is_active: row.get::<_, i32>(5)? != 0,
                must_change_password: row.get::<_, i32>(6)? != 0,
                failed_login_attempts: row.get(7)?,
                locked_until: row.get(8)?,
                last_login: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        },
    )
    .map_err(|_| AuthError::UserNotFound)
}

pub fn get_user_by_id(conn: &Connection, id: i64) -> Result<User, AuthError> {
    conn.query_row(
        "SELECT id, username, role, doctor_id, display_name, is_active, must_change_password, failed_login_attempts, locked_until, last_login, created_at, updated_at FROM users WHERE id = ?1",
        params![id],
        |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: UserRole::from_str(&row.get::<_, String>(2)?).unwrap_or(UserRole::Auxiliary),
                doctor_id: row.get(3)?,
                display_name: row.get(4)?,
                is_active: row.get::<_, i32>(5)? != 0,
                must_change_password: row.get::<_, i32>(6)? != 0,
                failed_login_attempts: row.get(7)?,
                locked_until: row.get(8)?,
                last_login: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        },
    )
    .map_err(|_| AuthError::UserNotFound)
}

fn get_password_hash(conn: &Connection, user_id: i64) -> Result<String, AuthError> {
    conn.query_row(
        "SELECT password_hash FROM users WHERE id = ?1",
        params![user_id],
        |row| row.get(0),
    )
    .map_err(|_| AuthError::UserNotFound)
}

fn increment_failed_attempts(conn: &Connection, user_id: i64) -> Result<(), AuthError> {
    conn.execute(
        "UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = datetime('now') WHERE id = ?1",
        params![user_id],
    )
    .map_err(|_| AuthError::InternalError)?;
    Ok(())
}

fn reset_failed_attempts(conn: &Connection, user_id: i64) -> Result<(), AuthError> {
    conn.execute(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?1",
        params![user_id],
    )
    .map_err(|_| AuthError::InternalError)?;
    Ok(())
}

fn lock_account(conn: &Connection, user_id: i64) -> Result<(), AuthError> {
    // Lock for 15 minutes
    conn.execute(
        "UPDATE users SET locked_until = datetime('now', '+15 minutes'), updated_at = datetime('now') WHERE id = ?1",
        params![user_id],
    )
    .map_err(|_| AuthError::InternalError)?;
    Ok(())
}

fn update_last_login(conn: &Connection, user_id: i64) -> Result<(), AuthError> {
    conn.execute(
        "UPDATE users SET last_login = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
        params![user_id],
    )
    .map_err(|_| AuthError::InternalError)?;
    Ok(())
}

fn get_max_attempts(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'max_login_attempts'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|v| v.parse::<i32>().ok())
    .unwrap_or(5)
}

// --- Errors ---

#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum AuthError {
    #[error("Credenciales inválidas")]
    InvalidCredentials,
    #[error("Usuario no encontrado")]
    UserNotFound,
    #[error("Cuenta bloqueada. Intente en 15 minutos.")]
    AccountLocked,
    #[error("Cuenta inactiva. Contacte al administrador.")]
    AccountInactive,
    #[error("La contraseña debe tener al menos 6 caracteres")]
    WeakPassword,
    #[error("Error interno del sistema")]
    InternalError,
    #[error("No autorizado. Permisos insuficientes.")]
    Unauthorized,
}

impl Serialize for AuthError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

use serde::Serialize;
