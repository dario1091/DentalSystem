use tauri::State;

use crate::db::repositories::billing_repo;
use crate::db::Database;
use crate::models::billing::{
    AddPaymentRequest, CreateInvoiceRequest, Invoice, InvoiceDetail, PatientBalance, Payment,
};
use crate::models::user::UserRole;
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

    Ok(RevenueReport { total_invoiced, total_paid, pending, invoices })
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

    // Generate PDF
    use printpdf::*;
    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Recibo {}", invoice.invoice_number),
        Mm(210.0), Mm(297.0), "Layer 1",
    );
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).unwrap();
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).unwrap();

    let mut y = 275.0;
    let left = 15.0;
    let lh = 6.0;

    // Header - Clinic
    layer.use_text(&clinic_name, 14.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    if !clinic_nit.is_empty() {
        layer.use_text(&format!("NIT: {}", clinic_nit), 9.0, Mm(left), Mm(y), &font);
        y -= 5.0;
    }
    if !clinic_address.is_empty() {
        layer.use_text(&clinic_address, 9.0, Mm(left), Mm(y), &font);
        y -= 5.0;
    }
    if !clinic_phone.is_empty() {
        layer.use_text(&format!("Tel: {}", clinic_phone), 9.0, Mm(left), Mm(y), &font);
        y -= 5.0;
    }

    // Invoice number (right aligned conceptually)
    y -= 4.0;
    layer.use_text(&format!("RECIBO No. {}", invoice.invoice_number), 12.0, Mm(120.0), Mm(y + 20.0), &font_bold);
    layer.use_text(&format!("Fecha: {}", &invoice.created_at[..10]), 9.0, Mm(120.0), Mm(y + 14.0), &font);
    let status_label = match invoice.status.as_str() {
        "paid" => "PAGADO",
        "partial" => "ABONO PARCIAL",
        "cancelled" => "ANULADO",
        _ => "PENDIENTE",
    };
    layer.use_text(&format!("Estado: {}", status_label), 9.0, Mm(120.0), Mm(y + 8.0), &font_bold);

    // Separator
    y -= 2.0;
    layer.use_text(&"─".repeat(90), 7.0, Mm(left), Mm(y), &font);
    y -= 8.0;

    // Patient data
    layer.use_text(&format!("Paciente: {}", patient_name), 10.0, Mm(left), Mm(y), &font);
    y -= lh;
    layer.use_text(&format!("Documento: {}  |  Tel: {}", patient_doc, patient_phone), 9.0, Mm(left), Mm(y), &font);
    y -= 10.0;

    // Items header
    layer.use_text("Descripción", 9.0, Mm(left), Mm(y), &font_bold);
    layer.use_text("Cant.", 9.0, Mm(110.0), Mm(y), &font_bold);
    layer.use_text("Precio", 9.0, Mm(125.0), Mm(y), &font_bold);
    layer.use_text("Desc.", 9.0, Mm(150.0), Mm(y), &font_bold);
    layer.use_text("Total", 9.0, Mm(170.0), Mm(y), &font_bold);
    y -= 3.0;
    layer.use_text(&"─".repeat(90), 7.0, Mm(left), Mm(y), &font);
    y -= 5.0;

    // Items
    for item in &detail.items {
        if y < 50.0 { break; }
        let desc = if item.description.len() > 45 { &item.description[..45] } else { &item.description };
        layer.use_text(desc, 9.0, Mm(left), Mm(y), &font);
        layer.use_text(&item.quantity.to_string(), 9.0, Mm(113.0), Mm(y), &font);
        layer.use_text(&format!("${:.0}", item.unit_price), 9.0, Mm(125.0), Mm(y), &font);
        if item.discount > 0.0 {
            layer.use_text(&format!("-${:.0}", item.discount), 9.0, Mm(150.0), Mm(y), &font);
        }
        layer.use_text(&format!("${:.0}", item.total), 9.0, Mm(170.0), Mm(y), &font);
        y -= lh;
    }

    // Totals
    y -= 4.0;
    layer.use_text(&"─".repeat(90), 7.0, Mm(left), Mm(y), &font);
    y -= 7.0;
    layer.use_text(&format!("Subtotal: ${:.0}", invoice.subtotal), 10.0, Mm(140.0), Mm(y), &font);
    y -= lh;
    if invoice.discount > 0.0 {
        layer.use_text(&format!("Descuento: -${:.0}", invoice.discount), 10.0, Mm(140.0), Mm(y), &font);
        y -= lh;
    }
    layer.use_text(&format!("TOTAL: ${:.0}", invoice.total), 11.0, Mm(140.0), Mm(y), &font_bold);
    y -= lh;
    layer.use_text(&format!("Pagado: ${:.0}", invoice.amount_paid), 10.0, Mm(140.0), Mm(y), &font);
    y -= lh;
    let balance = invoice.total - invoice.amount_paid;
    if balance > 0.0 {
        layer.use_text(&format!("Saldo: ${:.0}", balance), 10.0, Mm(140.0), Mm(y), &font_bold);
    }

    // Payments section
    if !detail.payments.is_empty() {
        y -= 12.0;
        layer.use_text("Historial de pagos:", 9.0, Mm(left), Mm(y), &font_bold);
        y -= lh;
        for p in &detail.payments {
            if y < 30.0 { break; }
            let method_label = match p.payment_method.as_str() {
                "efectivo" => "Efectivo",
                "transferencia" => "Transferencia",
                "tarjeta" => "Tarjeta",
                _ => &p.payment_method,
            };
            layer.use_text(
                &format!("  {} - ${:.0} ({}) - {}", &p.created_at[..10], p.amount, method_label, p.created_by_name.as_deref().unwrap_or("")),
                8.0, Mm(left), Mm(y), &font,
            );
            y -= 5.0;
        }
    }

    // Save to Downloads
    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("No se pudo determinar carpeta de Descargas.")?;
    std::fs::create_dir_all(&downloads_dir).map_err(|e| e.to_string())?;

    let filename = format!("recibo_{}.pdf", invoice.invoice_number);
    let dest = downloads_dir.join(&filename);

    let pdf_bytes = doc.save_to_bytes().map_err(|e| format!("Error PDF: {}", e))?;
    std::fs::write(&dest, &pdf_bytes).map_err(|e| e.to_string())?;

    // Open
    let dest_str = dest.to_string_lossy().to_string();
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
