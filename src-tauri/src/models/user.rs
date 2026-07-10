use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub role: UserRole,
    pub doctor_id: Option<i64>,
    pub display_name: String,
    pub is_active: bool,
    pub must_change_password: bool,
    pub failed_login_attempts: i32,
    pub locked_until: Option<String>,
    pub last_login: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Safe version without sensitive data, sent to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: i64,
    pub username: String,
    pub role: UserRole,
    pub display_name: String,
    pub must_change_password: bool,
}

impl From<User> for UserInfo {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            role: user.role,
            display_name: user.display_name,
            must_change_password: user.must_change_password,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Master,
    Doctor,
    Auxiliary,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Master => "master",
            UserRole::Doctor => "doctor",
            UserRole::Auxiliary => "auxiliary",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "master" => Ok(UserRole::Master),
            "doctor" => Ok(UserRole::Doctor),
            "auxiliary" => Ok(UserRole::Auxiliary),
            _ => Err(format!("Invalid role: {}", s)),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: UserRole,
    pub doctor_id: Option<i64>,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub id: i64,
    pub username: Option<String>,
    pub role: Option<UserRole>,
    pub doctor_id: Option<i64>,
    pub display_name: Option<String>,
    pub is_active: Option<bool>,
}
