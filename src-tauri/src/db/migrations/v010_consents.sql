-- Informed consents
CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    appointment_id INTEGER,
    procedure_id INTEGER,
    template_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, signed, expired
    pdf_path TEXT,
    signature_path TEXT,
    signed_pdf_path TEXT,
    notes TEXT,
    sent_at TEXT,
    signed_at TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (procedure_id) REFERENCES procedures(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON consents(status);
