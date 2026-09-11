use tauri::State;

use crate::db::repositories::billing_repo;
use crate::db::repositories::credits_repo;
use crate::db::Database;
use crate::models::billing::{
    AddPaymentRequest, CreateInvoiceRequest, Invoice, InvoiceDetail, PatientBalance, Payment,
};
use crate::models::user::UserRole;
use crate::services::pdf_generator;
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_invoice(
    request: CreateInvoiceRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Invoice, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if request.items.is_empty() {
        return Err("La factura debe tener al menos un ítem.".to_string());
    }

    let items: Vec<(Option<i64>, &str, i64, f64, f64)> = request
        .items
        .iter()
        .map(|i| (i.procedure_id, i.description.as_str(), i.quantity, i.unit_price, i.discount.unwrap_or(0.0)))
        .collect();

    let invoice = billing_repo::create_invoice(
        &conn,
        request.patient_id,
        request.appointment_id,
        &items,
        request.discount.unwrap_or(0.0),
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "create_invoice", invoice.id);
    Ok(invoice)
}

#[tauri::command]
pub fn get_invoice(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<InvoiceDetail, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    billing_repo::get_invoice_detail(&conn, id)
}

#[tauri::command]
pub fn list_invoices_by_patient(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Invoice>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    billing_repo::list_by_patient(&conn, patient_id)
}

#[tauri::command]
pub fn add_payment(
    request: AddPaymentRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Payment, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if request.amount <= 0.0 {
        return Err("El monto debe ser mayor a 0.".to_string());
    }

    let payment = billing_repo::add_payment(
        &conn,
        request.invoice_id,
        request.amount,
        &request.payment_method,
        request.reference.as_deref(),
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "add_payment", payment.id);
    Ok(payment)
}

#[tauri::command]
pub fn get_patient_balance(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<PatientBalance, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    billing_repo::get_patient_balance(&conn, patient_id)
}

#[derive(serde::Serialize)]
pub struct RevenueReport {
    pub total_invoiced: f64,
    pub total_paid: f64,
    pub pending: f64,
    pub invoices: Vec<Invoice>,
    // Movimientos de saldo a favor (anticipos) en el mismo rango.
    pub credit_deposits: f64,   // anticipos recibidos
    pub credit_applied: f64,    // saldo aplicado a facturas
    pub credit_refunds: f64,    // devoluciones entregadas (80%)
    pub credit_penalties: f64,  // penalizaciones retenidas (20%, ingreso)
}

#[tauri::command]
pub fn get_revenue_report(
    from_date: Option<String>,
    to_date: Option<String>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<RevenueReport, String> {
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (total_invoiced, total_paid, pending, invoices) =
        billing_repo::revenue_report(&conn, from_date.as_deref(), to_date.as_deref())?;

    let (credit_deposits, credit_applied, credit_refunds, credit_penalties) =
        credits_repo::credit_report(&conn, from_date.as_deref(), to_date.as_deref())?;

    Ok(RevenueReport {
        total_invoiced,
        total_paid,
        pending,
        invoices,
        credit_deposits,
        credit_applied,
        credit_refunds,
        credit_penalties,
    })
}

#[tauri::command]
pub fn export_invoice_pdf(
    invoice_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let detail = billing_repo::get_invoice_detail(&conn, invoice_id)?;
    let invoice = &detail.invoice;

    // Get clinic info
    let clinic_name: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'clinic_name'", [], |r| r.get(0))
        .unwrap_or_else(|_| "Consultorio Odontológico".to_string());
    let clinic_nit: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'clinic_nit'", [], |r| r.get(0))
        .unwrap_or_else(|_| "".to_string());
    let clinic_address: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'clinic_address'", [], |r| r.get(0))
        .unwrap_or_else(|_| "".to_string());
    let clinic_phone: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'clinic_phone'", [], |r| r.get(0))
        .unwrap_or_else(|_| "".to_string());

    // Get patient info
    let (patient_name, patient_doc, patient_phone): (String, String, String) = conn
        .query_row(
            "SELECT (first_name || ' ' || last_name), (document_type || ' ' || document_number), phone
             FROM patients WHERE id = ?1",
            rusqlite::params![invoice.patient_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap_or_else(|_| ("Paciente".to_string(), "".to_string(), "".to_string()));

    // Clinic logo path (optional).
    let logo_path: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = 'clinic_logo_path'", [], |r| r.get::<_, String>(0))
        .ok()
        .filter(|p| !p.is_empty());

    // Build shared PDF data using the same template as the treatment plan.
    let clinic = pdf_generator::ClinicInfo {
        name: clinic_name,
        nit: clinic_nit,
        address: clinic_address,
        phone: clinic_phone,
    };
    let items = detail
        .items
        .iter()
        .map(|it| pdf_generator::InvoicePdfItem {
            description: it.description.clone(),
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount: it.discount,
            total: it.total,
        })
        .collect();
    let payments = detail
        .payments
        .iter()
        .map(|p| pdf_generator::InvoicePdfPayment {
            date: p.created_at.clone(),
            amount: p.amount,
            method: p.payment_method.clone(),
            by: p.created_by_name.clone().unwrap_or_default(),
        })
        .collect();

    let data = pdf_generator::InvoicePdfData {
        invoice_number: invoice.invoice_number.clone(),
        created_at: invoice.created_at.clone(),
        status: invoice.status.clone(),
        patient_name,
        patient_doc,
        patient_phone,
        items,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        total: invoice.total,
        amount_paid: invoice.amount_paid,
        payments,
        notes: invoice.notes.clone(),
        logo_path,
    };

    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("No se pudo determinar carpeta de Descargas.")?;

    let dest_str = pdf_generator::generate_invoice_pdf(&clinic, &data, &downloads_dir)?;

    // Open the generated PDF with the OS default viewer.
    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("cmd").args(["/C", "start", "", &dest_str]).spawn(); }
    #[cfg(target_os = "macos")]
    { let _ = std::process::Command::new("open").arg(&dest_str).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("xdg-open").arg(&dest_str).spawn(); }

    Ok(dest_str)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'billing', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
