use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use zip::write::SimpleFileOptions;
use zip::ZipArchive;

/// Creates a backup ZIP containing the SQLite database and documents folder.
/// Returns the path to the created ZIP file.
pub fn create_backup(db_path: &Path, documents_path: &Path, dest_dir: &Path) -> Result<String, String> {
    fs::create_dir_all(dest_dir)
        .map_err(|e| format!("Error al crear directorio de backup: {}", e))?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let zip_name = format!("backup_dental_{}.zip", timestamp);
    let zip_path = dest_dir.join(&zip_name);

    let file = File::create(&zip_path)
        .map_err(|e| format!("Error al crear archivo ZIP: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add database file
    if db_path.exists() {
        let mut db_file = File::open(db_path)
            .map_err(|e| format!("Error al leer base de datos: {}", e))?;
        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer)
            .map_err(|e| format!("Error al leer base de datos: {}", e))?;

        zip.start_file("dental_system.db", options)
            .map_err(|e| format!("Error ZIP: {}", e))?;
        zip.write_all(&buffer)
            .map_err(|e| format!("Error ZIP: {}", e))?;
    }

    // Add documents folder recursively
    if documents_path.exists() && documents_path.is_dir() {
        add_directory_to_zip(&mut zip, documents_path, "documents", options)?;
    }

    zip.finish()
        .map_err(|e| format!("Error al finalizar ZIP: {}", e))?;

    Ok(zip_path.to_string_lossy().to_string())
}

/// Restores a backup ZIP, replacing the database and documents.
pub fn restore_backup(zip_path: &Path, db_path: &Path, documents_path: &Path) -> Result<(), String> {
    let file = File::open(zip_path)
        .map_err(|e| format!("Error al abrir backup: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Archivo de backup inválido: {}", e))?;

    // Verify the ZIP contains at least the database
    let has_db = (0..archive.len()).any(|i| {
        archive.by_index(i).map(|f| f.name() == "dental_system.db").unwrap_or(false)
    });

    if !has_db {
        return Err("El archivo de backup no contiene la base de datos.".to_string());
    }

    // Extract database
    {
        let mut db_entry = archive.by_name("dental_system.db")
            .map_err(|e| format!("Error al leer BD del backup: {}", e))?;
        let mut buffer = Vec::new();
        db_entry.read_to_end(&mut buffer)
            .map_err(|e| format!("Error al leer BD: {}", e))?;

        // Write to db path
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(db_path, &buffer)
            .map_err(|e| format!("Error al restaurar BD: {}", e))?;
    }

    // Extract documents
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("Error al leer entrada del ZIP: {}", e))?;

        let entry_name = entry.name().to_string();

        if entry_name.starts_with("documents/") {
            let relative_path = entry_name.strip_prefix("documents/").unwrap_or(&entry_name);
            if relative_path.is_empty() { continue; }

            let dest = documents_path.join(relative_path);

            if entry.is_dir() {
                fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut buffer = Vec::new();
                entry.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                fs::write(&dest, &buffer).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

/// Lists existing backups in a directory, sorted by date (newest first).
pub fn list_backups(backup_dir: &Path) -> Result<Vec<BackupInfo>, String> {
    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut backups: Vec<BackupInfo> = fs::read_dir(backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_name().to_string_lossy().starts_with("backup_dental_")
                && entry.file_name().to_string_lossy().ends_with(".zip")
        })
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let size = metadata.len();
            let modified = metadata.modified().ok()?;
            Some(BackupInfo {
                file_name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                size,
                created_at: system_time_to_string(modified),
            })
        })
        .collect();

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct BackupInfo {
    pub file_name: String,
    pub path: String,
    pub size: u64,
    pub created_at: String,
}

fn system_time_to_string(time: std::time::SystemTime) -> String {
    let datetime: chrono::DateTime<chrono::Local> = time.into();
    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Recursively adds a directory to a ZIP archive.
fn add_directory_to_zip(
    zip: &mut zip::ZipWriter<File>,
    dir: &Path,
    prefix: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = format!("{}/{}", prefix, entry.file_name().to_string_lossy());

        if path.is_dir() {
            zip.add_directory(&name, options).map_err(|e| e.to_string())?;
            add_directory_to_zip(zip, &path, &name, options)?;
        } else {
            let mut file = File::open(&path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

            zip.start_file(&name, options).map_err(|e| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
