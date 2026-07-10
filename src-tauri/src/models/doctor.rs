use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Doctor {
    pub id: i64,
    pub document_type: String,
    pub document_number: String,
    pub first_name: String,
    pub last_name: String,
    pub professional_license: String,
    pub specialty: String,
    pub university: Option<String>,
    pub phone: String,
    pub email: Option<String>,
    pub signature_path: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorSummary {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub professional_license: String,
    pub specialty: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateDoctorRequest {
    pub document_type: String,
    pub document_number: String,
    pub first_name: String,
    pub last_name: String,
    pub professional_license: String,
    pub specialty: String,
    pub university: Option<String>,
    pub phone: String,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDoctorRequest {
    pub id: i64,
    pub document_type: Option<String>,
    pub document_number: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub professional_license: Option<String>,
    pub specialty: Option<String>,
    pub university: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub is_active: Option<bool>,
}

#[allow(dead_code)]
pub const SPECIALTIES: &[&str] = &[
    "Odontología General",
    "Ortodoncia",
    "Endodoncia",
    "Periodoncia",
    "Cirugía Oral",
    "Prostodoncia",
    "Odontopediatría",
    "Implantología",
    "Estética Dental",
    "Radiología Oral",
];
