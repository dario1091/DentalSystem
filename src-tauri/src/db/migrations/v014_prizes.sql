-- Catálogo de premios editables para la ruleta de sorteos.
CREATE TABLE IF NOT EXISTS prizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',  -- color del segmento en la ruleta
    weight REAL NOT NULL DEFAULT 1,          -- peso/probabilidad relativa (>= 0)
    validity_days INTEGER NOT NULL DEFAULT 30, -- días de validez del premio al ganarlo
    active INTEGER NOT NULL DEFAULT 1,        -- 1 = entra en la ruleta, 0 = archivado
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Premios ganados por pacientes (con estado y vencimiento).
-- status: pending (ganado, sin canjear), redeemed (canjeado), expired (vencido).
-- prize_name es un snapshot para que el historial sobreviva si el premio del catálogo cambia o se borra.
CREATE TABLE IF NOT EXISTS patient_prizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    prize_id INTEGER,                 -- referencia al catálogo (puede quedar null si se borra)
    prize_name TEXT NOT NULL,         -- snapshot del nombre del premio ganado
    status TEXT NOT NULL DEFAULT 'pending', -- pending, redeemed, expired
    won_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    expires_at TEXT,                  -- fecha de vencimiento (null = no vence)
    redeemed_at TEXT,                 -- fecha en que se canjeó
    notes TEXT,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (prize_id) REFERENCES prizes(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_patient_prizes_patient ON patient_prizes(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_prizes_status ON patient_prizes(status);

-- Algunos premios de ejemplo para arrancar (se pueden editar/borrar desde la UI).
INSERT INTO prizes (name, color, weight, validity_days) VALUES
    ('10% descuento en calzas', '#3b82f6', 1, 30),
    ('10% descuento en blanqueamiento', '#8b5cf6', 1, 30),
    ('Cepillo de bambú', '#10b981', 2, 60),
    ('Sigue participando', '#6b7280', 3, 30);
