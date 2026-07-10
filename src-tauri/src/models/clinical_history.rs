use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClinicalHistory {
    pub id: i64,
    pub patient_id: i64,
    pub chief_complaint: String,
    pub present_illness: Option<String>,
    pub medical_history: Option<String>,
    pub surgical_history: Option<String>,
    pub family_history: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub clinical_exam: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub evolutions_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evolution {
    pub id: i64,
    pub clinical_history_id: i64,
    pub appointment_id: Option<i64>,
    pub sequence_number: i64,
    pub subjective: String,
    pub objective: String,
    pub analysis: String,
    pub plan: String,
    pub is_locked: bool,
    pub is_addendum: bool,
    pub parent_evolution_id: Option<i64>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClinicalHistoryDetail {
    pub history: ClinicalHistory,
    pub evolutions: Vec<Evolution>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClinicalHistoryRequest {
    pub patient_id: i64,
    pub chief_complaint: String,
    pub present_illness: Option<String>,
    pub medical_history: Option<String>,
    pub surgical_history: Option<String>,
    pub family_history: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub clinical_exam: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClinicalHistoryRequest {
    pub id: i64,
    pub chief_complaint: Option<String>,
    pub present_illness: Option<String>,
    pub medical_history: Option<String>,
    pub surgical_history: Option<String>,
    pub family_history: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub clinical_exam: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddEvolutionRequest {
    pub clinical_history_id: i64,
    pub appointment_id: Option<i64>,
    pub subjective: String,
    pub objective: String,
    pub analysis: String,
    pub plan: String,
}

#[derive(Debug, Deserialize)]
pub struct AddAddendumRequest {
    pub clinical_history_id: i64,
    pub parent_evolution_id: i64,
    pub subjective: String,
    pub objective: String,
    pub analysis: String,
    pub plan: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEvolutionRequest {
    pub id: i64,
    pub subjective: Option<String>,
    pub objective: Option<String>,
    pub analysis: Option<String>,
    pub plan: Option<String>,
}
