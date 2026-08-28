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
    /// Saldo a favor disponible (anticipos no aplicados).
    pub available_credit: f64,
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

// ===== Patient credits (saldo a favor / anticipos) =====

/// Saldo a favor disponible de un paciente (bolsa general).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientCredit {
    pub patient_id: i64,
    pub balance: f64,
    pub updated_at: String,
}

/// Un movimiento del saldo a favor (historial inmutable).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditMovement {
    pub id: i64,
    pub patient_id: i64,
    pub movement_type: String, // deposit, apply, refund, penalty
    pub amount: f64,
    pub invoice_id: Option<i64>,
    pub invoice_number: Option<String>,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub created_at: String,
}

/// Registrar un abono/anticipo del paciente (entra dinero, sin factura).
#[derive(Debug, Deserialize)]
pub struct AddCreditRequest {
    pub patient_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

/// Aplicar saldo a favor a una factura existente.
#[derive(Debug, Deserialize)]
pub struct ApplyCreditRequest {
    pub patient_id: i64,
    pub invoice_id: i64,
    pub amount: f64,
    pub notes: Option<String>,
}

/// Devolver el saldo a favor al paciente (se retira el 100%, se entrega el 80%).
#[derive(Debug, Deserialize)]
pub struct RefundCreditRequest {
    pub patient_id: i64,
    pub payment_method: String,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

/// Resultado de una devolución: cuánto se retiró, se entregó y se retuvo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefundResult {
    pub total_withdrawn: f64,
    pub refunded_amount: f64,
    pub penalty_amount: f64,
}

/// Porcentaje que se retiene al devolver un saldo a favor.
pub const REFUND_PENALTY_RATE: f64 = 0.20;

pub const CREDIT_MOVEMENT_TYPES: &[(&str, &str)] = &[
    ("deposit", "Abono"),
    ("apply", "Aplicado a factura"),
    ("refund", "Devolución"),
    ("penalty", "Penalización (20%)"),
];
