use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub id: i64,
    pub quote_number: String,
    pub patient_id: i64,
    pub odontogram_id: Option<i64>,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub status: String, // draft, sent, accepted, converted, expired
    pub valid_until: Option<String>,
    pub notes: Option<String>,
    pub invoice_id: Option<i64>,
    pub odontogram_image_path: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub patient_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteItem {
    pub id: i64,
    pub quote_id: i64,
    pub procedure_id: Option<i64>,
    pub description: String,
    pub tooth_number: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
    pub discount: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteDetail {
    pub quote: Quote,
    pub items: Vec<QuoteItem>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuoteRequest {
    pub patient_id: i64,
    pub odontogram_id: Option<i64>,
    pub items: Vec<CreateQuoteItemRequest>,
    pub discount: Option<f64>,
    pub valid_until: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuoteItemRequest {
    pub procedure_id: Option<i64>,
    pub description: String,
    pub tooth_number: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
    pub discount: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateQuoteStatusRequest {
    pub quote_id: i64,
    pub status: String,
}

/// Valid quote statuses.
pub const QUOTE_STATUSES: &[(&str, &str)] = &[
    ("draft", "Borrador"),
    ("sent", "Enviada"),
    ("accepted", "Aceptada"),
    ("converted", "Facturada"),
    ("expired", "Vencida"),
];
