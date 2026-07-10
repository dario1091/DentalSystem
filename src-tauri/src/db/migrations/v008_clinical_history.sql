-- Clinical histories: one per patient
CREATE TABLE IF NOT EXISTS clinical_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL UNIQUE,
    chief_complaint TEXT NOT NULL,          -- Motivo de consulta
    present_illness TEXT,                    -- Enfermedad actual
    medical_history TEXT,                    -- Antecedentes médicos
    surgical_history TEXT,                   -- Antecedentes quirúrgicos
    family_history TEXT,                     -- Antecedentes familiares
    allergies TEXT,                          -- Alergias
    medications TEXT,                        -- Medicamentos actuales
    clinical_exam TEXT,                      -- Examen clínico
    diagnosis TEXT,                          -- Diagnóstico (CIE-10)
    treatment_plan TEXT,                     -- Plan de tratamiento
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Evolutions: SOAP format entries linked to a clinical history
CREATE TABLE IF NOT EXISTS evolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinical_history_id INTEGER NOT NULL,
    appointment_id INTEGER,
    sequence_number INTEGER NOT NULL,        -- Numeración secuencial
    subjective TEXT NOT NULL,                -- S: Lo que el paciente refiere
    objective TEXT NOT NULL,                 -- O: Hallazgos del examen
    analysis TEXT NOT NULL,                  -- A: Diagnóstico/análisis
    plan TEXT NOT NULL,                      -- P: Plan de tratamiento
    is_locked INTEGER NOT NULL DEFAULT 0,    -- Auto-lock después de 24h
    is_addendum INTEGER NOT NULL DEFAULT 0,  -- Es una adenda
    parent_evolution_id INTEGER,             -- Referencia a evolución original (para adendas)
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (clinical_history_id) REFERENCES clinical_histories(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (parent_evolution_id) REFERENCES evolutions(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_evolutions_clinical_history ON evolutions(clinical_history_id);
CREATE INDEX IF NOT EXISTS idx_evolutions_appointment ON evolutions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_clinical_histories_patient ON clinical_histories(patient_id);
