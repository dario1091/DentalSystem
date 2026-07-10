-- Migration v007: Odontograms and findings

CREATE TABLE IF NOT EXISTS odontograms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    appointment_id INTEGER,
    dentition_type TEXT NOT NULL DEFAULT 'permanent' CHECK(dentition_type IN ('permanent','deciduous')),
    is_initial INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS odontogram_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    odontogram_id INTEGER NOT NULL,
    tooth_number TEXT NOT NULL,
    face TEXT CHECK(face IN ('vestibular','lingual','mesial','distal','oclusal','incisal','full')),
    finding_type TEXT NOT NULL,
    color TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (odontogram_id) REFERENCES odontograms(id) ON DELETE CASCADE
);

CREATE INDEX idx_odontograms_patient ON odontograms(patient_id);
CREATE INDEX idx_odontograms_appointment ON odontograms(appointment_id);
CREATE INDEX idx_findings_odontogram ON odontogram_findings(odontogram_id);
CREATE INDEX idx_findings_tooth ON odontogram_findings(odontogram_id, tooth_number);
