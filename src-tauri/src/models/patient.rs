use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    pub id: i64,
    pub document_type: String,
    pub document_number: String,
    pub first_name: String,
    pub last_name: String,
    pub birth_date: String,
    pub gender: String,
    pub marital_status: Option<String>,
    pub phone: String,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub eps: Option<String>,
    pub blood_type: Option<String>,
    pub allergies: Option<String>,
    pub current_medications: Option<String>,
    pub medical_history: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_relationship: Option<String>,
    pub guardian_phone: Option<String>,
    pub photo_path: Option<String>,
    pub data_consent: bool,
    pub data_consent_date: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Summary for list views (lighter than full Patient).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientSummary {
    pub id: i64,
    pub document_type: String,
    pub document_number: String,
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePatientRequest {
    pub document_type: String,
    pub document_number: String,
    pub first_name: String,
    pub last_name: String,
    pub birth_date: String,
    pub gender: String,
    pub marital_status: Option<String>,
    pub phone: String,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub eps: Option<String>,
    pub blood_type: Option<String>,
    pub allergies: Option<String>,
    pub current_medications: Option<String>,
    pub medical_history: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_relationship: Option<String>,
    pub guardian_phone: Option<String>,
    pub data_consent: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePatientRequest {
    pub id: i64,
    pub document_type: Option<String>,
    pub document_number: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub birth_date: Option<String>,
    pub gender: Option<String>,
    pub marital_status: Option<String>,
    pub phone: Option<String>,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub eps: Option<String>,
    pub blood_type: Option<String>,
    pub allergies: Option<String>,
    pub current_medications: Option<String>,
    pub medical_history: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_relationship: Option<String>,
    pub guardian_phone: Option<String>,
    pub data_consent: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SearchPatientsRequest {
    pub query: Option<String>,
    pub active_only: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}
