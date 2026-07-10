use std::sync::Mutex;

use crate::models::user::{UserInfo, UserRole};

/// In-memory session state. Lives for the lifetime of the Tauri process.
pub struct SessionState {
    pub current_user: Mutex<Option<UserInfo>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            current_user: Mutex::new(None),
        }
    }

    pub fn set_user(&self, user: UserInfo) -> Result<(), String> {
        let mut lock = self.current_user.lock().map_err(|e| e.to_string())?;
        *lock = Some(user);
        Ok(())
    }

    pub fn clear(&self) -> Result<(), String> {
        let mut lock = self.current_user.lock().map_err(|e| e.to_string())?;
        *lock = None;
        Ok(())
    }

    pub fn get(&self) -> Result<Option<UserInfo>, String> {
        let lock = self.current_user.lock().map_err(|e| e.to_string())?;
        Ok(lock.clone())
    }

    /// Returns the current user or an Unauthorized error.
    pub fn require_user(&self) -> Result<UserInfo, String> {
        self.get()?
            .ok_or_else(|| "No hay sesión activa. Inicie sesión.".to_string())
    }

    /// Returns the current user only if they have the required role.
    pub fn require_role(&self, required: &UserRole) -> Result<UserInfo, String> {
        let user = self.require_user()?;
        if &user.role == required || user.role == UserRole::Master {
            Ok(user)
        } else {
            Err("No autorizado. Permisos insuficientes.".to_string())
        }
    }
}
