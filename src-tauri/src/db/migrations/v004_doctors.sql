-- Migration v004: Doctors table

CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL CHECK(document_type IN ('CC','CE','PP')),
    document_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    professional_license TEXT NOT NULL UNIQUE,
    specialty TEXT NOT NULL,
    university TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    signature_path TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_doctors_license ON doctors(professional_license);
CREATE INDEX idx_doctors_active ON doctors(is_active);
