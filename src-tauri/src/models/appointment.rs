use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AppointmentStatus {
    Scheduled,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
    NoShow,
}

impl AppointmentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Scheduled => "scheduled",
            Self::Confirmed => "confirmed",
            Self::InProgress => "in_progress",
            Self::Completed => "completed",
            Self::Cancelled => "cancelled",
            Self::NoShow => "no_show",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "scheduled" => Ok(Self::Scheduled),
            "confirmed" => Ok(Self::Confirmed),
            "in_progress" => Ok(Self::InProgress),
            "completed" => Ok(Self::Completed),
            "cancelled" => Ok(Self::Cancelled),
            "no_show" => Ok(Self::NoShow),
            _ => Err(format!("Estado de cita inválido: {}", s)),
        }
    }

    /// Returns valid transitions from the current state.
    pub fn valid_transitions(&self) -> Vec<AppointmentStatus> {
        match self {
            Self::Scheduled => vec![Self::Confirmed, Self::Cancelled, Self::NoShow],
            Self::Confirmed => vec![Self::InProgress, Self::Cancelled, Self::NoShow],
            Self::InProgress => vec![Self::Completed],
            Self::Completed => vec![],
            Self::Cancelled => vec![],
            Self::NoShow => vec![],
        }
    }

    pub fn can_transition_to(&self, target: &AppointmentStatus) -> bool {
        self.valid_transitions().contains(target)
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled | Self::NoShow)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appointment {
    pub id: i64,
    pub patient_id: i64,
    pub patient_name: Option<String>,
    pub doctor_id: i64,
    pub doctor_name: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub status: String,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub total_amount: f64,
    pub status_changed_at: Option<String>,
    pub created_by: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppointmentSummary {
    pub id: i64,
    pub patient_name: String,
    pub doctor_name: String,
    pub start_time: String,
    pub end_time: String,
    pub status: String,
    pub reason: Option<String>,
    pub total_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppointmentProcedure {
    pub id: i64,
    pub appointment_id: i64,
    pub procedure_id: i64,
    pub procedure_name: Option<String>,
    pub procedure_code: Option<String>,
    pub quantity: i32,
    pub unit_price: f64,
    pub discount_type: Option<String>,
    pub discount_value: f64,
    pub final_price: f64,
    pub tooth_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppointmentRequest {
    pub patient_id: i64,
    pub doctor_id: i64,
    pub start_time: String,
    pub end_time: String,
    pub reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppointmentRequest {
    pub id: i64,
    pub patient_id: Option<i64>,
    pub doctor_id: Option<i64>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangeStatusRequest {
    pub appointment_id: i64,
    pub new_status: String,
}

#[derive(Debug, Deserialize)]
pub struct AddProcedureRequest {
    pub appointment_id: i64,
    pub procedure_id: i64,
    pub quantity: Option<i32>,
    pub unit_price: f64,
    pub discount_type: Option<String>,
    pub discount_value: Option<f64>,
    pub tooth_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemoveProcedureRequest {
    pub appointment_procedure_id: i64,
    pub appointment_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct ListAppointmentsFilter {
    pub doctor_id: Option<i64>,
    pub patient_id: Option<i64>,
    pub status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}
