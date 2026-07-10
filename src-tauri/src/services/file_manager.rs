use std::fs;
use std::path::{Path, PathBuf};

use crate::models::document::ALLOWED_MIME_TYPES;

/// Determines the MIME type from the file extension.
pub fn detect_mime_type(file_name: &str) -> Option<&'static str> {
    let ext = file_name.rsplit('.').next()?.to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "pdf" => Some("application/pdf"),
        _ => None,
    }
}

/// Validates that the MIME type is allowed.
pub fn is_allowed_mime(mime_type: &str) -> bool {
    ALLOWED_MIME_TYPES.iter().any(|(m, _)| *m == mime_type)
}

/// Gets the file extension for a MIME type.
pub fn extension_for_mime(mime_type: &str) -> Option<&'static str> {
    ALLOWED_MIME_TYPES
        .iter()
        .find(|(m, _)| *m == mime_type)
        .map(|(_, ext)| *ext)
}

/// Creates the directory structure for a patient's documents.
/// Returns the base path for the patient.
pub fn ensure_patient_dir(base_path: &Path, patient_id: i64, doc_type: &str) -> Result<PathBuf, String> {
    let patient_dir = base_path
        .join("pacientes")
        .join(patient_id.to_string())
        .join("documentos")
        .join(doc_type);

    fs::create_dir_all(&patient_dir)
        .map_err(|e| format!("Error al crear directorio de documentos: {}", e))?;

    Ok(patient_dir)
}

/// Saves file data to the filesystem.
/// Returns (file_name, full_path).
pub fn save_file(
    base_path: &Path,
    patient_id: i64,
    doc_type: &str,
    original_name: &str,
    data: &[u8],
) -> Result<(String, PathBuf), String> {
    let dir = ensure_patient_dir(base_path, patient_id, doc_type)?;

    // Generate unique filename: timestamp_originalname
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let sanitized_name = sanitize_filename(original_name);
    let file_name = format!("{}_{}", timestamp, sanitized_name);
    let full_path = dir.join(&file_name);

    fs::write(&full_path, data)
        .map_err(|e| format!("Error al guardar archivo: {}", e))?;

    Ok((file_name, full_path))
}

/// Deletes a file from the filesystem.
pub fn delete_file(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Error al eliminar archivo: {}", e))?;
    }
    Ok(())
}

/// Reads a file and returns its bytes.
pub fn read_file(file_path: &str) -> Result<Vec<u8>, String> {
    fs::read(file_path)
        .map_err(|e| format!("Error al leer archivo: {}", e))
}

/// Gets available disk space for a given path (in bytes).
pub fn get_available_space(path: &Path) -> Result<u64, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        // Fallback: use a rough estimate via metadata
        // For proper impl, would need winapi
        Ok(0)
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let output = Command::new("df")
            .args(["-k", &path.to_string_lossy()])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let line = stdout.lines().nth(1).ok_or("No disk info")?;
        let available_kb: u64 = line
            .split_whitespace()
            .nth(3)
            .ok_or("Parse error")?
            .parse()
            .map_err(|_| "Parse error".to_string())?;
        Ok(available_kb * 1024)
    }
}

/// Sanitizes a filename for safe filesystem storage.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}
