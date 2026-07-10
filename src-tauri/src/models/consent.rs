use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consent {
    pub id: i64,
    pub patient_id: i64,
    pub appointment_id: Option<i64>,
    pub procedure_id: Option<i64>,
    pub template_name: String,
    pub status: String,
    pub pdf_path: Option<String>,
    pub signature_path: Option<String>,
    pub signed_pdf_path: Option<String>,
    pub notes: Option<String>,
    pub sent_at: Option<String>,
    pub signed_at: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub created_at: String,
    // Joined fields
    pub patient_name: Option<String>,
    pub procedure_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConsentRequest {
    pub patient_id: i64,
    pub appointment_id: Option<i64>,
    pub procedure_id: Option<i64>,
    pub template_name: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConsentStatusRequest {
    pub id: i64,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveSignatureRequest {
    pub consent_id: i64,
    pub signature_data: Vec<u8>,
}

/// Available consent templates
pub const CONSENT_TEMPLATES: &[(&str, &str)] = &[
    ("general", "Consentimiento General de Tratamiento"),
    ("endodoncia", "Consentimiento para Endodoncia"),
    ("exodoncia", "Consentimiento para Exodoncia"),
    ("cirugia_oral", "Consentimiento para Cirugía Oral"),
    ("implantes", "Consentimiento para Implantes Dentales"),
    ("ortodoncia", "Consentimiento para Ortodoncia"),
    ("blanqueamiento", "Consentimiento para Blanqueamiento"),
    ("protesis", "Consentimiento para Prótesis Dental"),
    ("periodoncia", "Consentimiento para Tratamiento Periodontal"),
    ("radiografia", "Consentimiento para Toma de Radiografías"),
];
