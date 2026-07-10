use std::sync::Mutex;
use std::time::{Instant, Duration};

use crate::models::user::{UserInfo, UserRole};

/// Default timeout: 30 minutes
const DEFAULT_TIMEOUT_MINUTES: u64 = 30;

/// In-memory session state. Lives for the lifetime of the Tauri process.
pub struct SessionState {
    pub current_user: Mutex<Option<UserInfo>>,
    pub last_activity: Mutex<Option<Instant>>,
    pub timeout_minutes: Mutex<u64>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            current_user: Mutex::new(None),
            last_activity: Mutex::new(None),
            timeout_minutes: Mutex::new(DEFAULT_TIMEOUT_MINUTES),
        }
    }

    pub fn set_user(&self, user: UserInfo) -> Result<(), String> {
        let mut lock = self.current_user.lock().map_err(|e| e.to_string())?;
        *lock = Some(user);
        // Reset activity
        let mut activity = self.last_activity.lock().map_err(|e| e.to_string())?;
        *activity = Some(Instant::now());
        Ok(())
    }

    pub fn set_timeout(&self, minutes: u64) {
        if let Ok(mut t) = self.timeout_minutes.lock() {
            *t = minutes;
        }
    }

    pub fn clear(&self) -> Result<(), String> {
        let mut lock = self.current_user.lock().map_err(|e| e.to_string())?;
        *lock = None;
        let mut activity = self.last_activity.lock().map_err(|e| e.to_string())?;
        *activity = None;
        Ok(())
    }

    pub fn touch(&self) {
        if let Ok(mut activity) = self.last_activity.lock() {
            if activity.is_some() {
                *activity = Some(Instant::now());
            }
        }
    }

    pub fn get(&self) -> Result<Option<UserInfo>, String> {
        // Check timeout first
        if self.is_timed_out() {
            self.clear()?;
            return Ok(None);
        }

        let lock = self.current_user.lock().map_err(|e| e.to_string())?;
        Ok(lock.clone())
    }

    /// Returns the current user or an Unauthorized error.
    pub fn require_user(&self) -> Result<UserInfo, String> {
        // Touch activity on every authenticated request
        self.touch();

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

    fn is_timed_out(&self) -> bool {
        let activity = self.last_activity.lock().ok();
        let timeout = self.timeout_minutes.lock().ok();

        match (activity, timeout) {
            (Some(activity_lock), Some(timeout_lock)) => {
                if let Some(last) = *activity_lock {
                    let timeout_duration = Duration::from_secs(*timeout_lock * 60);
                    last.elapsed() > timeout_duration
                } else {
                    false
                }
            }
            _ => false,
        }
    }
}
