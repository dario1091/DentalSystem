use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: i64,
    pub invoice_number: String,
    pub patient_id: i64,
    pub appointment_id: Option<i64>,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub amount_paid: f64,
    pub status: String,
    pub notes: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub patient_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub id: i64,
    pub invoice_id: i64,
    pub procedure_id: Option<i64>,
    pub description: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub discount: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: i64,
    pub invoice_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDetail {
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
    pub payments: Vec<Payment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientBalance {
    pub patient_id: i64,
    pub total_invoiced: f64,
    pub total_paid: f64,
    pub balance_due: f64,
    pub invoice_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub patient_id: i64,
    pub appointment_id: Option<i64>,
    pub items: Vec<CreateInvoiceItemRequest>,
    pub discount: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvoiceItemRequest {
    pub procedure_id: Option<i64>,
    pub description: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub discount: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AddPaymentRequest {
    pub invoice_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

pub const PAYMENT_METHODS: &[(&str, &str)] = &[
    ("efectivo", "Efectivo"),
    ("transferencia", "Transferencia"),
    ("tarjeta", "Tarjeta"),
    ("otro", "Otro"),
];
