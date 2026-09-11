use tauri::State;

use crate::db::repositories::odontogram_repo;
use crate::db::Database;
use crate::models::odontogram::{
    AddFindingRequest, CreateOdontogramRequest, OdontogramDetail, OdontogramFinding,
    OdontogramSummary, RemoveFindingRequest, FINDING_TYPES,
};
use crate::models::user::UserRole;
use crate::services::pdf_generator::{self, ClinicInfo, OdontogramFindingLine, OdontogramPdfData};
use crate::services::session::SessionState;

/// Export an odontogram as a branded PDF. The frontend supplies the rendered
/// odontogram image (PNG bytes); patient, findings and clinic data are read here.
#[tauri::command]
pub fn export_odontogram_pdf(
    odontogram_id: i64,
    odontogram_png: Vec<u8>,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let detail = odontogram_repo::get_detail(&conn, odontogram_id)?;

    let (patient_name, patient_doc): (String, String) = conn
        .query_row(
            "SELECT (first_name || ' ' || last_name), (document_type || ' ' || document_number)
             FROM patients WHERE id = ?1",
            rusqlite::params![detail.odontogram.patient_id],
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

    let findings = detail
        .findings
        .iter()
        .map(|f| {
            let label = FINDING_TYPES
                .iter()
                .find(|(id, _, _)| *id == f.finding_type)
                .map(|(_, label, _)| label.to_string())
                .unwrap_or_else(|| f.finding_type.clone());
            OdontogramFindingLine {
                tooth: f.tooth_number.clone(),
                face: f.face.clone().unwrap_or_default(),
                label,
            }
        })
        .collect();

    let data = OdontogramPdfData {
        patient_name,
        patient_doc,
        kind: if detail.odontogram.is_initial { "Inicial".to_string() } else { "Evolución".to_string() },
        date: detail.odontogram.created_at.chars().take(10).collect(),
        odontogram_png,
        findings,
        logo_path: get("clinic_logo_path"),
    };

    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("No se pudo determinar carpeta de Descargas.")?;

    let path = pdf_generator::generate_odontogram_pdf(&clinic, &data, &downloads_dir)?;

    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("cmd").args(["/C", "start", "", &path]).spawn(); }
    #[cfg(target_os = "macos")]
    { let _ = std::process::Command::new("open").arg(&path).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("xdg-open").arg(&path).spawn(); }

    Ok(path)
}

#[tauri::command]
pub fn create_odontogram(
    request: CreateOdontogramRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<OdontogramDetail, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let odontogram = odontogram_repo::create(&conn, &request, user.id)?;

    log_audit(&conn, user.id, "create_odontogram", odontogram.id);

    odontogram_repo::get_detail(&conn, odontogram.id)
}

#[tauri::command]
pub fn add_finding(
    request: AddFindingRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<OdontogramFinding, String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate tooth number format (FDI: 11-48 for permanent, 51-85 for deciduous)
    let tooth_num: u32 = request
        .tooth_number
        .parse()
        .map_err(|_| "Número de diente inválido.".to_string())?;

    let valid_permanent = (11..=18).contains(&tooth_num)
        || (21..=28).contains(&tooth_num)
        || (31..=38).contains(&tooth_num)
        || (41..=48).contains(&tooth_num);
    let valid_deciduous = (51..=55).contains(&tooth_num)
        || (61..=65).contains(&tooth_num)
        || (71..=75).contains(&tooth_num)
        || (81..=85).contains(&tooth_num);

    if !valid_permanent && !valid_deciduous {
        return Err("Número de diente no válido según nomenclatura FDI.".to_string());
    }

    let finding = odontogram_repo::add_finding(&conn, &request)?;

    log_audit(&conn, user.id, "add_finding", finding.id);
    Ok(finding)
}

#[tauri::command]
pub fn remove_finding(
    request: RemoveFindingRequest,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let user = session.require_role(&UserRole::Doctor)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    odontogram_repo::remove_finding(&conn, request.finding_id, request.odontogram_id)?;

    log_audit(&conn, user.id, "remove_finding", request.finding_id);
    Ok(())
}

#[tauri::command]
pub fn get_odontograms_by_patient(
    patient_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<Vec<OdontogramSummary>, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    odontogram_repo::get_by_patient(&conn, patient_id)
}

#[tauri::command]
pub fn get_odontogram_detail(
    odontogram_id: i64,
    db: State<'_, Database>,
    session: State<'_, SessionState>,
) -> Result<OdontogramDetail, String> {
    session.require_user()?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    odontogram_repo::get_detail(&conn, odontogram_id)
}

fn log_audit(conn: &rusqlite::Connection, user_id: i64, action: &str, entity_id: i64) {
    let _ = conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES (?1, ?2, 'odontograms', ?3)",
        rusqlite::params![user_id, action, entity_id],
    );
}
