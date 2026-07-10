use rusqlite::{Connection, params};

/// A single database migration.
struct Migration {
    version: u32,
    name: &'static str,
    sql: &'static str,
}

/// Manages and executes database migrations.
pub struct MigrationRunner {
    migrations: Vec<Migration>,
}

impl MigrationRunner {
    pub fn new() -> Self {
        Self {
            migrations: vec![
                Migration {
                    version: 1,
                    name: "initial_schema",
                    sql: include_str!("v001_initial_schema.sql"),
                },
                Migration {
                    version: 2,
                    name: "seed_admin",
                    sql: include_str!("v002_seed_admin.sql"),
                },
                Migration {
                    version: 3,
                    name: "patients",
                    sql: include_str!("v003_patients.sql"),
                },
                Migration {
                    version: 4,
                    name: "doctors",
                    sql: include_str!("v004_doctors.sql"),
                },
                Migration {
                    version: 5,
                    name: "procedures",
                    sql: include_str!("v005_procedures.sql"),
                },
                Migration {
                    version: 6,
                    name: "appointments",
                    sql: include_str!("v006_appointments.sql"),
                },
                Migration {
                    version: 7,
                    name: "odontograms",
                    sql: include_str!("v007_odontograms.sql"),
                },
                Migration {
                    version: 8,
                    name: "clinical_history",
                    sql: include_str!("v008_clinical_history.sql"),
                },
                Migration {
                    version: 9,
                    name: "documents",
                    sql: include_str!("v009_documents.sql"),
                },
                Migration {
                    version: 10,
                    name: "consents",
                    sql: include_str!("v010_consents.sql"),
                },
                Migration {
                    version: 11,
                    name: "consent_templates",
                    sql: include_str!("v011_consent_templates.sql"),
                },
            ],
        }
    }

    /// Run all pending migrations in order.
    pub fn run(&self, conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        // Create migrations tracking table if it doesn't exist
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        )?;

        let current_version = self.get_current_version(conn)?;
        log::info!("Current database version: {}", current_version);

        for migration in &self.migrations {
            if migration.version > current_version {
                log::info!(
                    "Applying migration v{:03}: {}",
                    migration.version,
                    migration.name
                );
                conn.execute_batch(migration.sql)?;
                conn.execute(
                    "INSERT INTO _migrations (version, name) VALUES (?1, ?2)",
                    params![migration.version, migration.name],
                )?;
                log::info!("Migration v{:03} applied successfully.", migration.version);
            }
        }

        Ok(())
    }

    /// Get the highest applied migration version.
    fn get_current_version(&self, conn: &Connection) -> Result<u32, Box<dyn std::error::Error>> {
        // Check if _migrations table exists
        let table_exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='_migrations'",
            [],
            |row| row.get(0),
        )?;

        if !table_exists {
            return Ok(0);
        }

        let version: u32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM _migrations",
                [],
                |row| row.get(0),
            )?;

        Ok(version)
    }
}
