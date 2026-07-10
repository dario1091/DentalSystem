use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Procedure {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub category: String,
    pub description: Option<String>,
    pub base_price: f64,
    pub duration_minutes: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcedureSummary {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub category: String,
    pub base_price: f64,
    pub duration_minutes: i32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceHistoryEntry {
    pub id: i64,
    pub procedure_id: i64,
    pub old_price: f64,
    pub new_price: f64,
    pub changed_by: i64,
    pub changed_by_name: Option<String>,
    pub reason: Option<String>,
    pub changed_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProcedureRequest {
    pub code: String,
    pub name: String,
    pub category: String,
    pub description: Option<String>,
    pub base_price: f64,
    pub duration_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProcedureRequest {
    pub id: i64,
    pub code: Option<String>,
    pub name: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub duration_minutes: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePriceRequest {
    pub procedure_id: i64,
    pub new_price: f64,
    pub reason: Option<String>,
}

/// Discount applied to a procedure in a specific context (appointment).
/// This struct is used in the appointment/billing context, not stored in procedures table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcedureDiscount {
    pub procedure_id: i64,
    pub discount_type: DiscountType,
    pub discount_value: f64,
    pub final_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiscountType {
    Percentage,
    Fixed,
}

impl ProcedureDiscount {
    /// Calculate the final price after applying the discount.
    pub fn calculate(base_price: f64, discount_type: &DiscountType, discount_value: f64) -> f64 {
        let final_price = match discount_type {
            DiscountType::Percentage => {
                let clamped = discount_value.clamp(0.0, 100.0);
                base_price * (1.0 - clamped / 100.0)
            }
            DiscountType::Fixed => {
                let clamped = discount_value.clamp(0.0, base_price);
                base_price - clamped
            }
        };
        // Round to 2 decimal places
        (final_price * 100.0).round() / 100.0
    }
}

pub const PROCEDURE_CATEGORIES: &[&str] = &[
    "Consulta",
    "Prevención",
    "Periodoncia",
    "Operatoria",
    "Endodoncia",
    "Cirugía",
    "Prótesis Fija",
    "Prótesis Removible",
    "Estética",
    "Implantología",
    "Diagnóstico",
    "Ortodoncia",
];
