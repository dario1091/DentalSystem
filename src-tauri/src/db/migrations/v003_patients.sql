-- Migration v003: Patients table

CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL CHECK(document_type IN ('CC','TI','CE','PP','RC')),
    document_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('M','F','O')),
    marital_status TEXT,
    phone TEXT NOT NULL,
    phone_secondary TEXT,
    email TEXT,
    address TEXT,
    eps TEXT,
    blood_type TEXT CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-',NULL)),
    allergies TEXT,
    current_medications TEXT,
    medical_history TEXT,
    guardian_name TEXT,
    guardian_relationship TEXT,
    guardian_phone TEXT,
    photo_path TEXT,
    data_consent INTEGER NOT NULL DEFAULT 0,
    data_consent_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_patients_document ON patients(document_type, document_number);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_active ON patients(is_active);
