-- Migration v016: Quotes (cotizaciones / presupuestos)
-- Mirrors invoices/invoice_items but without payment fields. A quote can later
-- be converted into an invoice (invoice_id points to the generated invoice).

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL,
    odontogram_id INTEGER,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',  -- draft, sent, accepted, converted, expired
    valid_until TEXT,
    notes TEXT,
    invoice_id INTEGER,                     -- set when converted to an invoice
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (odontogram_id) REFERENCES odontograms(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    procedure_id INTEGER,
    description TEXT NOT NULL,
    tooth_number TEXT,                      -- optional: which tooth this line refers to
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (procedure_id) REFERENCES procedures(id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_patient ON quotes(patient_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- Sequential number counter for quotes (COT-000001, ...)
INSERT INTO settings (key, value) VALUES ('quote_next_number', '1')
    ON CONFLICT(key) DO NOTHING;
