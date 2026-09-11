use tauri::State;

use crate::db::repositories::clinical_history_repo;
use crate::db::Database;
use crate::models::clinical_history::{
    AddAddendumRequest, AddEvolutionRequest, Cie10Code, ClinicalHistory, ClinicalHistoryDetail,
    CreateClinicalHistoryRequest, Evolution, UpdateClinicalHistoryRequest, UpdateEvolutionRequest,
};
use crate::models::user::UserRole;
use crate::services::pdf_generator::{
    self, ClinicInfo, ClinicalHistoryPdfData, EvolutionPdfEntry,
};
use crate::services::session::SessionState;

/// Search the dental CIE-10 catalog by code or description.
#[tauri::command]
pub fn search_cie10(
    query: String,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Cie10Code>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    clinical_history_repo::search_cie10(&conn, &query)
}

/// Export a patient's full clinical history (with SOAP evolutions) as a branded PDF.
#[tauri::command]
pub fn export_clinical_history_pdf(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::get_by_patient(&conn, patient_id)?
        .ok_or_else(|| "Este paciente no tiene historia clínica.".to_string())?;
    let detail = clinical_history_repo::get_detail(&conn, history.id)?;

    let (patient_name, patient_doc): (String, String) = conn
        .query_row(
            "SELECT (first_name || ' ' || last_name), (document_type || ' ' || document_number)
             FROM patients WHERE id = ?1",
            rusqlite::params![patient_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or_else(|_| ("Paciente".to_string(), String::new()));

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

    let evolutions = detail
        .evolutions
        .iter()
        .map(|e| EvolutionPdfEntry {
            sequence_number: e.sequence_number,
            date: e.created_at.clone(),
            is_addendum: e.is_addendum,
            subjective: e.subjective.clone(),
            objective: e.objective.clone(),
            analysis: e.analysis.clone(),
            plan: e.plan.clone(),
            author: e.created_by_name.clone().unwrap_or_default(),
        })
        .collect();

    let h = &detail.history;
    let data = ClinicalHistoryPdfData {
        patient_name,
        patient_doc,
        created_at: h.created_at.clone(),
        chief_complaint: h.chief_complaint.clone(),
        present_illness: h.present_illness.clone(),
        medical_history: h.medical_history.clone(),
        surgical_history: h.surgical_history.clone(),
        family_history: h.family_history.clone(),
        allergies: h.allergies.clone(),
        medications: h.medications.clone(),
        clinical_exam: h.clinical_exam.clone(),
        diagnosis: match (&h.cie10_code, &h.diagnosis) {
            (Some(c), Some(d)) if !c.is_empty() => Some(format!("[{}] {}", c, d)),
            (Some(c), None) if !c.is_empty() => Some(c.clone()),
            (_, d) => d.clone(),
        },
        treatment_plan: h.treatment_plan.clone(),
        evolutions,
        logo_path: get("clinic_logo_path"),
    };

    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("No se pudo determinar carpeta de Descargas.")?;

    let path = pdf_generator::generate_clinical_history_pdf(&clinic, &data, &downloads_dir)?;

    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("cmd").args(["/C", "start", "", &path]).spawn(); }
    #[cfg(target_os = "macos")]
    { let _ = std::process::Command::new("open").arg(&path).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("xdg-open").arg(&path).spawn(); }

    Ok(path)
}

#[tauri::command]
pub fn create_clinical_history(
    request: CreateClinicalHistoryRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<ClinicalHistory, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::create(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "create_clinical_history", history.id);
    Ok(history)
}

#[tauri::command]
pub fn update_clinical_history(
    request: UpdateClinicalHistoryRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<ClinicalHistory, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::update(&conn, &request)?;

    log_audit(&conn, user.id, "update_clinical_history", history.id);
    Ok(history)
}

#[tauri::command]
pub fn get_clinical_history(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Option<ClinicalHistoryDetail>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let history = clinical_history_repo::get_by_patient(&conn, patient_id)?;

    match history {
        Some(h) => {
            let detail = clinical_history_repo::get_detail(&conn, h.id)?;
            Ok(Some(detail))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn add_evolution(
    request: AddEvolutionRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Evolution, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Verify clinical history exists
    let _ = clinical_history_repo::get_by_id(&conn, request.clinical_history_id)?;

    let evolution = clinical_history_repo::add_evolution(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "add_evolution", evolution.id);
    Ok(evolution)
}

#[tauri::command]
pub fn add_addendum(
    request: AddAddendumRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Evolution, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let evolution = clinical_history_repo::add_addendum(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "add_addendum", evolution.id);
    Ok(evolution)
}

#[tauri::command]
pub fn update_evolution(
    request: UpdateEvolutionRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Evolution, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let evolution = clinical_history_repo::update_evolution(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "update_evolution", evolution.id);
    Ok(evolution)
}

#[tauri::command]
pub fn get_evolutions(
    clinical_history_id: i64,
    from_date: Option<String>,
    to_date: Option<String>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<Evolution>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    clinical_history_repo::get_evolutions(
        &conn,
        clinical_history_id,
        from_date.as_deref(),
        to_date.as_deref(),
    )
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'clinical_histories', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
