-- Migration v005: Procedures catalog and price history

CREATE TABLE IF NOT EXISTS procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL CHECK(base_price >= 0),
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS procedure_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    procedure_id INTEGER NOT NULL,
    old_price REAL NOT NULL,
    new_price REAL NOT NULL,
    changed_by INTEGER NOT NULL,
    reason TEXT,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (procedure_id) REFERENCES procedures(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX idx_procedures_code ON procedures(code);
CREATE INDEX idx_procedures_category ON procedures(category);
CREATE INDEX idx_procedures_active ON procedures(is_active);
CREATE INDEX idx_price_history_procedure ON procedure_price_history(procedure_id);

-- Seed: Common dental procedures (codes based on CUPS Colombia)
INSERT OR IGNORE INTO procedures (code, name, category, base_price, duration_minutes) VALUES
    ('232101', 'Consulta odontológica de primera vez', 'Consulta', 50000, 30),
    ('232102', 'Consulta odontológica de control', 'Consulta', 35000, 20),
    ('232201', 'Profilaxis dental', 'Prevención', 80000, 45),
    ('232202', 'Aplicación de flúor', 'Prevención', 40000, 20),
    ('232203', 'Sellante de fosetas y fisuras (por diente)', 'Prevención', 45000, 15),
    ('232301', 'Detartraje supragingival', 'Periodoncia', 100000, 60),
    ('232302', 'Detartraje subgingival (por cuadrante)', 'Periodoncia', 150000, 45),
    ('232303', 'Raspado y alisado radicular (por cuadrante)', 'Periodoncia', 200000, 60),
    ('232401', 'Obturación con resina 1 superficie', 'Operatoria', 120000, 30),
    ('232402', 'Obturación con resina 2 superficies', 'Operatoria', 150000, 40),
    ('232403', 'Obturación con resina 3 o más superficies', 'Operatoria', 180000, 50),
    ('232404', 'Obturación con ionómero de vidrio', 'Operatoria', 90000, 30),
    ('232501', 'Tratamiento de conducto unirradicular', 'Endodoncia', 350000, 90),
    ('232502', 'Tratamiento de conducto birradicular', 'Endodoncia', 450000, 120),
    ('232503', 'Tratamiento de conducto multirradicular', 'Endodoncia', 550000, 150),
    ('232601', 'Exodoncia simple', 'Cirugía', 120000, 30),
    ('232602', 'Exodoncia de diente incluido', 'Cirugía', 350000, 60),
    ('232603', 'Exodoncia de tercer molar', 'Cirugía', 400000, 90),
    ('232701', 'Corona en porcelana', 'Prótesis Fija', 800000, 60),
    ('232702', 'Corona metal-cerámica', 'Prótesis Fija', 650000, 60),
    ('232703', 'Puente fijo (por unidad)', 'Prótesis Fija', 750000, 60),
    ('232801', 'Prótesis total superior', 'Prótesis Removible', 1200000, 60),
    ('232802', 'Prótesis total inferior', 'Prótesis Removible', 1200000, 60),
    ('232803', 'Prótesis parcial removible', 'Prótesis Removible', 800000, 60),
    ('232901', 'Blanqueamiento dental (ambas arcadas)', 'Estética', 500000, 90),
    ('232902', 'Carilla en resina (por diente)', 'Estética', 350000, 60),
    ('232903', 'Carilla en porcelana (por diente)', 'Estética', 900000, 60),
    ('233001', 'Implante dental (incluye corona)', 'Implantología', 3500000, 120),
    ('233002', 'Injerto óseo', 'Implantología', 1500000, 90),
    ('233101', 'Radiografía periapical', 'Diagnóstico', 25000, 10),
    ('233102', 'Radiografía panorámica', 'Diagnóstico', 60000, 15),
    ('233201', 'Ortodoncia - instalación de brackets', 'Ortodoncia', 2500000, 120),
    ('233202', 'Control de ortodoncia mensual', 'Ortodoncia', 120000, 30);
