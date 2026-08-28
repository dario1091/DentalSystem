-- Patient credits: saldo a favor / anticipos (bolsa general por paciente)
-- Cada paciente tiene UNA fila de saldo. El detalle vive en credit_movements.
CREATE TABLE IF NOT EXISTS patient_credits (
    patient_id INTEGER PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 0,  -- saldo disponible actual (nunca negativo)
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Historial inmutable de movimientos del saldo a favor.
-- movement_type:
--   'deposit'  -> el paciente abona dinero (entra plata, +balance)
--   'apply'    -> se usa saldo para pagar una factura (-balance)
--   'refund'   -> devolucion al paciente del 80% (-balance por el total, ver notes)
--   'penalty'  -> retencion del 20% por devolucion (registro contable, no mueve balance extra)
CREATE TABLE IF NOT EXISTS credit_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,  -- deposit, apply, refund, penalty
    amount REAL NOT NULL,          -- monto del movimiento (siempre positivo)
    invoice_id INTEGER,            -- solo para 'apply': factura a la que se aplico
    payment_method TEXT,           -- solo para 'deposit'/'refund': efectivo, transferencia, etc.
    reference TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_credit_movements_patient ON credit_movements(patient_id);
CREATE INDEX IF NOT EXISTS idx_credit_movements_type ON credit_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_credit_movements_created ON credit_movements(created_at);
