use std::path::PathBuf;
use tauri::State;

use crate::db::repositories::consent_repo;
use crate::db::Database;
use crate::models::consent::{Consent, CreateConsentRequest, SaveSignatureRequest, UpdateConsentStatusRequest, CONSENT_TEMPLATES};
use crate::services::file_manager;
use crate::services::pdf_generator::{self, ClinicInfo, ConsentPdfData};
use crate::services::session::SessionState;

/// Read clinic header info + logo path from settings for branded PDFs.
fn clinic_info_and_logo(conn: &rusqlite::Connection) -> (ClinicInfo, Option<String>) {
    let get = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![key],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .filter(|v: &String| !v.is_empty())
    };
    let clinic = ClinicInfo {
        name: get("clinic_name").unwrap_or_else(|| "Consultorio Odontológico".to_string()),
        nit: get("clinic_nit").unwrap_or_default(),
        address: get("clinic_address").unwrap_or_default(),
        phone: get("clinic_phone").unwrap_or_default(),
    };
    (clinic, get("clinic_logo_path"))
}

fn get_base_path(conn: &rusqlite::Connection, app_handle: &tauri::AppHandle) -> PathBuf {
    use tauri::Manager;
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let custom_path: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'documents_base_path'",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(path) = custom_path {
        if !path.is_empty() {
            let p = PathBuf::from(&path);
            // Only use custom path if it's absolute and not the default placeholder
            if p.is_absolute() {
                return p;
            }
        }
    }

    // Default: app data dir / documents
    app_dir.join("documents")
}

#[tauri::command]
pub fn create_consent(
    request: CreateConsentRequest,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Consent, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate template
    if !CONSENT_TEMPLATES.iter().any(|(k, _)| *k == request.template_name) {
        return Err("Plantilla de consentimiento no válida.".to_string());
    }

    // Generate PDF
    let pdf_path = generate_consent_pdf(&conn, &app_handle, &request)?;

    let consent = consent_repo::create(
        &conn,
        request.patient_id,
        request.appointment_id,
        request.procedure_id,
        &request.template_name,
        request.notes.as_deref(),
        Some(&pdf_path),
        user.id,
    )?;

    log_audit(&conn, user.id, "create_consent", consent.id);
    Ok(consent)
}

#[tauri::command]
pub fn list_consents(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Consent>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    consent_repo::list_by_patient(&conn, patient_id)
}

#[tauri::command]
pub fn update_consent_status(
    request: UpdateConsentStatusRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Consent, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let valid_statuses = ["pending", "sent", "signed", "expired"];
    if !valid_statuses.contains(&request.status.as_str()) {
        return Err("Estado no válido.".to_string());
    }

    let consent = consent_repo::update_status(&conn, request.id, &request.status)?;
    log_audit(&conn, user.id, "update_consent_status", consent.id);
    Ok(consent)
}

#[tauri::command]
pub fn save_consent_signature(
    request: SaveSignatureRequest,
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Consent, String> {
    let user = session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let consent = consent_repo::get_by_id(&conn, request.consent_id)?;
    let base_path = get_base_path(&conn, &app_handle);

    // Save signature PNG
    let sig_dir = base_path
        .join("pacientes")
        .join(consent.patient_id.to_string())
        .join("firmas");
    std::fs::create_dir_all(&sig_dir)
        .map_err(|e| format!("Error al crear directorio de firmas: {}", e))?;

    let sig_filename = format!("firma_consent_{}_{}.png", consent.id, chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let sig_path = sig_dir.join(&sig_filename);

    std::fs::write(&sig_path, &request.signature_data)
        .map_err(|e| format!("Error al guardar firma: {}", e))?;

    let sig_path_str = sig_path.to_string_lossy().to_string();
    consent_repo::set_signature_path(&conn, request.consent_id, &sig_path_str)?;

    // Regenerate PDF with signature embedded
    regenerate_pdf_with_signature(&conn, &app_handle, &consent, &request.signature_data)?;

    log_audit(&conn, user.id, "save_consent_signature", request.consent_id);
    consent_repo::get_by_id(&conn, request.consent_id)
}

/// Regenerates the consent PDF including the signature image
fn regenerate_pdf_with_signature(
    conn: &rusqlite::Connection,
    app_handle: &tauri::AppHandle,
    consent: &Consent,
    signature_png: &[u8],
) -> Result<(), String> {
    let _ = app_handle; // path comes from the stored consent

    // Get patient data
    let (patient_name, patient_doc, patient_phone): (String, String, String) = conn
        .query_row(
            "SELECT (first_name || ' ' || last_name), (document_type || ' ' || document_number), phone
             FROM patients WHERE id = ?1",
            rusqlite::params![consent.patient_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Paciente no encontrado.".to_string())?;

    // Get template from DB
    let (template_label, template_content): (String, String) = conn
        .query_row(
            "SELECT name, content FROM consent_templates WHERE key = ?1",
            rusqlite::params![consent.template_name],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or_else(|_| ("Consentimiento Informado".to_string(), "".to_string()));

    // Get procedure name
    let procedure_name: String = if let Some(proc_id) = consent.procedure_id {
        conn.query_row(
            "SELECT name FROM procedures WHERE id = ?1",
            rusqlite::params![proc_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Procedimiento general".to_string())
    } else {
        "Procedimiento general".to_string()
    };

    let date = chrono::Local::now().format("%d/%m/%Y").to_string();
    let pdf_path = consent.pdf_path.as_deref().ok_or("No hay ruta de PDF.")?;

    let (clinic, logo_path) = clinic_info_and_logo(conn);
    let data = ConsentPdfData {
        title: template_label,
        content: template_content,
        patient_name,
        patient_doc,
        patient_phone,
        procedure_name,
        date,
        signature_png: Some(signature_png.to_vec()),
        logo_path,
    };
    pdf_generator::generate_consent_pdf(&clinic, &data, std::path::Path::new(pdf_path))?;

    Ok(())
}

#[tauri::command]
pub fn generate_whatsapp_link(
    patient_id: i64,
    consent_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get patient phone
    let (phone, patient_name): (String, String) = conn
        .query_row(
            "SELECT phone, (first_name || ' ' || last_name) FROM patients WHERE id = ?1",
            rusqlite::params![patient_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Paciente no encontrado.".to_string())?;

    let consent = consent_repo::get_by_id(&conn, consent_id)?;
    let template_label = CONSENT_TEMPLATES
        .iter()
        .find(|(k, _)| *k == consent.template_name)
        .map(|(_, v)| *v)
        .unwrap_or("procedimiento");

    // Clean phone number (remove spaces, dashes, country code prefix)
    let clean_phone: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let phone_number = if clean_phone.starts_with("57") {
        clean_phone
    } else {
        format!("57{}", clean_phone)
    };

    let message = format!(
        "Estimado/a {}, adjunto encontrará su consentimiento informado para {}. Por favor revíselo, fírmelo y envíe la foto de vuelta. Gracias.",
        patient_name, template_label
    );

    let encoded_message = urlencoding::encode(&message);
    let link = format!("https://wa.me/{}?text={}", phone_number, encoded_message);

    // Update status to sent
    let _ = consent_repo::update_status(&conn, consent_id, "sent");

    Ok(link)
}

#[tauri::command]
pub fn get_consent_templates(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<(String, String)>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT key, name FROM consent_templates WHERE is_active = 1 ORDER BY name")
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ConsentTemplate {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub content: String,
    pub is_active: bool,
    pub updated_at: String,
}

#[tauri::command]
pub fn list_consent_templates_full(
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<ConsentTemplate>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, key, name, content, is_active, updated_at FROM consent_templates ORDER BY name")
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| {
            Ok(ConsentTemplate {
                id: row.get(0)?,
                key: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateTemplateRequest {
    pub id: i64,
    pub name: Option<String>,
    pub content: Option<String>,
    pub is_active: Option<bool>,
}

#[tauri::command]
pub fn update_consent_template(
    request: UpdateTemplateRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    use crate::models::user::UserRole;
    session.require_role(&UserRole::Master)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if let Some(name) = &request.name {
        conn.execute(
            "UPDATE consent_templates SET name = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            rusqlite::params![name, request.id],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(content) = &request.content {
        conn.execute(
            "UPDATE consent_templates SET content = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            rusqlite::params![content, request.id],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(is_active) = request.is_active {
        conn.execute(
            "UPDATE consent_templates SET is_active = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            rusqlite::params![is_active as i32, request.id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_consent_pdf_data(
    consent_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<u8>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let consent = consent_repo::get_by_id(&conn, consent_id)?;
    let pdf_path = consent.pdf_path.ok_or("Este consentimiento no tiene PDF generado.")?;
    file_manager::read_file(&pdf_path)
}

/// Copies the consent PDF to the user's Downloads folder and opens it with the system viewer.
/// Returns the path where the PDF was saved.
#[tauri::command]
pub fn export_consent_pdf(
    consent_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let consent = consent_repo::get_by_id(&conn, consent_id)?;
    let pdf_path = consent.pdf_path.ok_or("Este consentimiento no tiene PDF generado.")?;

    // Verify source file exists
    let source = std::path::Path::new(&pdf_path);
    if !source.exists() {
        return Err(format!("El archivo PDF no se encuentra en: {}", pdf_path));
    }

    // Get Downloads directory
    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("No se pudo determinar la carpeta de Descargas.")?;

    // Ensure downloads dir exists
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("Error al crear carpeta de Descargas: {}", e))?;

    // Copy PDF to Downloads with a friendly name
    let filename = source.file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("consentimiento_{}.pdf", consent_id));

    let dest = downloads_dir.join(&filename);
    std::fs::copy(source, &dest)
        .map_err(|e| format!("Error al copiar PDF a Descargas: {} (origen: {})", e, pdf_path))?;

    // Open the PDF with the system default app
    let dest_str = dest.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &dest_str])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&dest_str)
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&dest_str)
            .spawn();
    }

    Ok(dest_str)
}

/// Generate a consent PDF from template data (reads template from DB)
fn generate_consent_pdf(
    conn: &rusqlite::Connection,
    app_handle: &tauri::AppHandle,
    request: &CreateConsentRequest,
) -> Result<String, String> {
    // Get patient data
    let (patient_name, patient_doc, patient_phone): (String, String, String) = conn
        .query_row(
            "SELECT (first_name || ' ' || last_name), (document_type || ' ' || document_number), phone
             FROM patients WHERE id = ?1",
            rusqlite::params![request.patient_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Paciente no encontrado.".to_string())?;

    // Get procedure name if applicable
    let procedure_name: String = if let Some(proc_id) = request.procedure_id {
        conn.query_row(
            "SELECT name FROM procedures WHERE id = ?1",
            rusqlite::params![proc_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Procedimiento general".to_string())
    } else {
        "Procedimiento general".to_string()
    };

    // Get template from DB
    let (template_label, template_content): (String, String) = conn
        .query_row(
            "SELECT name, content FROM consent_templates WHERE key = ?1 AND is_active = 1",
            rusqlite::params![request.template_name],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or_else(|_| ("Consentimiento Informado".to_string(), "Contenido del consentimiento no disponible.".to_string()));

    let date = chrono::Local::now().format("%d/%m/%Y").to_string();

    // Destination path (per-patient consents folder).
    let base_path = get_base_path(conn, app_handle);
    let consent_dir = base_path
        .join("pacientes")
        .join(request.patient_id.to_string())
        .join("consentimientos");
    let filename = format!(
        "consentimiento_{}_{}.pdf",
        request.template_name,
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let pdf_path = consent_dir.join(&filename);

    let (clinic, logo_path) = clinic_info_and_logo(conn);
    let data = ConsentPdfData {
        title: template_label,
        content: template_content,
        patient_name,
        patient_doc,
        patient_phone,
        procedure_name,
        date,
        signature_png: None,
        logo_path,
    };
    pdf_generator::generate_consent_pdf(&clinic, &data, &pdf_path)?;

    Ok(pdf_path.to_string_lossy().to_string())
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'consents', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
