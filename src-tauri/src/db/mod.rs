pub mod migrations;
pub mod repositories;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use migrations::MigrationRunner;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Initialize the database connection and run pending migrations.
    pub fn init(app_handle: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = Self::get_db_path(app_handle)?;

        log::info!("Database path: {:?}", db_path);

        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        // Run pending migrations
        db.run_migrations()?;

        Ok(db)
    }

    /// Get the database file path (in app data directory).
    fn get_db_path(app_handle: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        fs::create_dir_all(&app_dir)?;

        Ok(app_dir.join("dental_system.db"))
    }

    /// Run all pending migrations.
    fn run_migrations(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let runner = MigrationRunner::new();
        runner.run(&conn)?;
        Ok(())
    }
}
