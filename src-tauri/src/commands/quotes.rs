use tauri::State;

use crate::db::repositories::{billing_repo, quote_repo};
use crate::db::Database;
use crate::models::billing::Invoice;
use crate::models::quote::{CreateQuoteRequest, Quote, QuoteDetail, UpdateQuoteStatusRequest};
use crate::services::pdf_generator::{self, ClinicInfo, QuotePdfData, QuotePdfItem};
use crate::services::session::SessionState;

#[tauri::command]
pub fn create_quote(
    request: CreateQuoteRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Quote, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if request.items.is_empty() {
        return Err("La cotización debe tener al menos un ítem.".to_string());
    }

    let items: Vec<(Option<i64>, String, Option<String>, i64, f64, f64)> = request
        .items
        .iter()
        .map(|i| {
            (
                i.procedure_id,
                i.description.clone(),
                i.tooth_number.clone(),
                i.quantity,
                i.unit_price,
                i.discount.unwrap_or(0.0),
            )
        })
        .collect();

    let quote = quote_repo::create_quote(
        &conn,
        request.patient_id,
        request.odontogram_id,
        &items,
        request.discount.unwrap_or(0.0),
        request.valid_until.as_deref(),
        request.notes.as_deref(),
        user.id,
    )?;

    log_audit(&conn, user.id, "create_quote", quote.id);
    Ok(quote)
}

#[tauri::command]
pub fn get_quote(
    id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<QuoteDetail, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    quote_repo::get_quote_detail(&conn, id)
}

#[tauri::command]
pub fn list_quotes_by_patient(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Quote>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    quote_repo::list_by_patient(&conn, patient_id)
}

#[tauri::command]
pub fn update_quote_status(
    request: UpdateQuoteStatusRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Quote, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let quote = quote_repo::update_status(&conn, request.quote_id, &request.status)?;
    log_audit(&conn, user.id, "update_quote_status", quote.id);
    Ok(quote)
}

/// Convert a quote into an invoice, reusing the quote's items. The quote is
/// then marked as `converted` and linked to the new invoice.
#[tauri::command]
pub fn convert_quote_to_invoice(
    quote_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Invoice, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let detail = quote_repo::get_quote_detail(&conn, quote_id)?;

    if detail.quote.status == "converted" {
        return Err("Esta cotización ya fue facturada.".to_string());
    }
    if detail.items.is_empty() {
        return Err("La cotización no tiene ítems para facturar.".to_string());
    }

    // Map quote items -> invoice items (Option<i64>, &str, i64, f64, f64).
    let items: Vec<(Option<i64>, &str, i64, f64, f64)> = detail
        .items
        .iter()
        .map(|it| {
            (
                it.procedure_id,
                it.description.as_str(),
                it.quantity,
                it.unit_price,
                it.discount,
            )
        })
        .collect();

    let invoice = billing_repo::create_invoice(
        &conn,
        detail.quote.patient_id,
        None,
        &items,
        detail.quote.discount,
        detail.quote.notes.as_deref(),
        user.id,
    )?;

    quote_repo::mark_converted(&conn, quote_id, invoice.id)?;

    log_audit(&conn, user.id, "convert_quote_to_invoice", quote_id);
    Ok(invoice)
}

/// Generate the quote PDF (optionally embedding the odontogram image), save it
/// to Downloads and open it. Returns the file path.
#[tauri::command]
pub fn export_quote_pdf(
    quote_id: i64,
    odontogram_png: Option<Vec<u8>>,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    use tauri::Manager;
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let detail = quote_repo::get_quote_detail(&conn, quote_id)?;
    let quote = &detail.quote;

    // Resolve the odontogram image bytes: prefer the freshly-provided PNG (and
    // persist it for later re-downloads); otherwise load the stored image.
    let odontogram_bytes: Option<Vec<u8>> = if let Some(png) = odontogram_png {
        // Persist alongside app data so the PDF can be regenerated later.
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let dir = app_dir.join("quotes");
        if std::fs::create_dir_all(&dir).is_ok() {
            let img_path = dir.join(format!("odontograma_{}.png", quote.quote_number));
            if std::fs::write(&img_path, &png).is_ok() {
                let _ = quote_repo::set_odontogram_image_path(
                    &conn,
                    quote_id,
                    &img_path.to_string_lossy(),
                );
            }
        }
        Some(png)
    } else {
        quote
            .odontogram_image_path
            .as_ref()
            .and_then(|p| std::fs::read(p).ok())
    };

    // Clinic info from settings.
    let clinic = ClinicInfo {
        name: get_setting(&conn, "clinic_name").unwrap_or_else(|| "Consultorio Odontológico".to_string()),
        nit: get_setting(&conn, "clinic_nit").unwrap_or_default(),
        address: get_setting(&conn, "clinic_address").unwrap_or_default(),
        phone: get_setting(&conn, "clinic_phone").unwrap_or_default(),
    };

    // Patient info.
    let (patient_name, patient_doc, patient_phone): (String, String, String) = conn
        .query_row(
            "SELECT (first_name || ' ' || last_name), (document_type || ' ' || document_number), phone
             FROM patients WHERE id = ?1",
            rusqlite::params![quote.patient_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap_or_else(|_| ("Paciente".to_string(), String::new(), String::new()));

    let items: Vec<QuotePdfItem> = detail
        .items
        .iter()
        .map(|it| QuotePdfItem {
            description: it.description.clone(),
            tooth_number: it.tooth_number.clone(),
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount: it.discount,
            total: it.total,
        })
        .collect();

    let data = QuotePdfData {
        quote_number: quote.quote_number.clone(),
        created_at: quote.created_at.clone(),
        valid_until: quote.valid_until.clone(),
        patient_name,
        patient_doc,
        patient_phone,
        items,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        notes: quote.notes.clone(),
        odontogram_png: odontogram_bytes,
        logo_path: get_setting(&conn, "clinic_logo_path"),
    };

    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("No se pudo determinar carpeta de Descargas.")?;

    let path = pdf_generator::generate_quote_pdf(&clinic, &data, &downloads_dir)?;

    // Open the generated PDF with the OS default viewer.
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", &path]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&path).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&path).spawn();
    }

    Ok(path)
}

/// Build a WhatsApp link to send the quote to the patient.
#[tauri::command]
pub fn quote_whatsapp_link(
    quote_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let quote = quote_repo::get_quote(&conn, quote_id)?;

    let (phone, patient_name): (String, String) = conn
        .query_row(
            "SELECT phone, (first_name || ' ' || last_name) FROM patients WHERE id = ?1",
            rusqlite::params![quote.patient_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Paciente no encontrado.".to_string())?;

    let clean_phone: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let phone_number = if clean_phone.starts_with("57") {
        clean_phone
    } else {
        format!("57{}", clean_phone)
    };

    let message = format!(
        "Estimado/a {}, adjunto su plan de tratamiento {} por un total de ${:.0}. Quedamos atentos para agendar. Gracias.",
        patient_name, quote.quote_number, quote.total
    );
    let encoded = urlencoding::encode(&message);
    let link = format!("https://wa.me/{}?text={}", phone_number, encoded);

    // Mark as sent (best-effort).
    let _ = quote_repo::update_status(&conn, quote_id, "sent");

    Ok(link)
}

fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .filter(|v: &String| !v.is_empty())
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'quotes', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
