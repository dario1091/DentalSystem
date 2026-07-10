use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Odontogram {
    pub id: i64,
    pub patient_id: i64,
    pub appointment_id: Option<i64>,
    pub dentition_type: String,
    pub is_initial: bool,
    pub notes: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub created_at: String,
    pub findings_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdontogramDetail {
    pub odontogram: Odontogram,
    pub findings: Vec<OdontogramFinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdontogramFinding {
    pub id: i64,
    pub odontogram_id: i64,
    pub tooth_number: String,
    pub face: Option<String>,
    pub finding_type: String,
    pub color: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdontogramSummary {
    pub id: i64,
    pub patient_id: i64,
    pub dentition_type: String,
    pub is_initial: bool,
    pub created_by_name: Option<String>,
    pub created_at: String,
    pub findings_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateOdontogramRequest {
    pub patient_id: i64,
    pub appointment_id: Option<i64>,
    pub dentition_type: Option<String>,
    pub is_initial: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddFindingRequest {
    pub odontogram_id: i64,
    pub tooth_number: String,
    pub face: Option<String>,
    pub finding_type: String,
    pub color: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemoveFindingRequest {
    pub finding_id: i64,
    pub odontogram_id: i64,
}

/// Standard dental finding types with their associated colors.
#[allow(dead_code)]
pub const FINDING_TYPES: &[(&str, &str, &str)] = &[
    ("caries", "Caries", "#EF4444"),
    ("obturacion_resina", "Obturación resina", "#3B82F6"),
    ("obturacion_amalgama", "Obturación amalgama", "#6B7280"),
    ("obturacion_temporal", "Obturación temporal", "#8B5CF6"),
    ("corona", "Corona", "#F59E0B"),
    ("ausente", "Ausente", "#111827"),
    ("endodoncia", "Endodoncia", "#EC4899"),
    ("fractura", "Fractura", "#DC2626"),
    ("implante", "Implante", "#14B8A6"),
    ("protesis_fija", "Prótesis fija", "#F97316"),
    ("protesis_removible", "Prótesis removible", "#A855F7"),
    ("sellante", "Sellante", "#22C55E"),
    ("movilidad", "Movilidad", "#EAB308"),
    ("retenido", "Retenido/Incluido", "#78716C"),
    ("supernumerario", "Supernumerario", "#06B6D4"),
    ("diastema", "Diastema", "#84CC16"),
    ("placa_bacteriana", "Placa bacteriana", "#FCA5A5"),
    ("calculo", "Cálculo dental", "#92400E"),
];
