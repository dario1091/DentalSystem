use serde::{Deserialize, Serialize};

/// Premio del catálogo (editable) que entra en la ruleta.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prize {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub weight: f64,
    pub validity_days: i64,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Premio ganado por un paciente.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientPrize {
    pub id: i64,
    pub patient_id: i64,
    pub patient_name: Option<String>,
    pub prize_id: Option<i64>,
    pub prize_name: String,
    pub status: String, // pending, redeemed, expired
    pub won_at: String,
    pub expires_at: Option<String>,
    pub redeemed_at: Option<String>,
    pub notes: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrizeRequest {
    pub name: String,
    pub color: Option<String>,
    pub weight: Option<f64>,
    pub validity_days: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrizeRequest {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub weight: f64,
    pub validity_days: i64,
    pub active: bool,
}

/// Solicitud para girar la ruleta: se elige el paciente.
#[derive(Debug, Deserialize)]
pub struct SpinRequest {
    pub patient_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct RedeemPrizeRequest {
    pub patient_prize_id: i64,
    pub notes: Option<String>,
}

pub const PRIZE_STATUSES: &[(&str, &str)] = &[
    ("pending", "Pendiente"),
    ("redeemed", "Canjeado"),
    ("expired", "Vencido"),
];
