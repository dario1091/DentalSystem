-- Migration v001: Initial Schema
-- Creates base tables: settings, users, audit_log

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('master', 'doctor', 'auxiliary')),
    doctor_id INTEGER,
    display_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed: default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_name', 'Mi Consultorio Odontológico');
INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_nit', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_address', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_phone', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('documents_base_path', './data');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_path', './backups');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_auto_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_auto_frequency', 'daily');
INSERT OR IGNORE INTO settings (key, value) VALUES ('session_timeout_minutes', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_login_attempts', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_next_number', '1');
