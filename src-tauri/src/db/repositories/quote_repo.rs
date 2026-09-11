use rusqlite::{params, Connection};

use crate::models::quote::{Quote, QuoteDetail, QuoteItem};

/// Get the next sequential quote number ("COT-000001") and increment the counter.
fn next_quote_number(conn: &Connection) -> Result<String, String> {
    let num: i64 = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'quote_next_number'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);

    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('quote_next_number', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        params![(num + 1).to_string()],
    )
    .map_err(|e| e.to_string())?;

    Ok(format!("PT-{:06}", num))
}

/// Create a quote with its items in a single transaction.
/// `items`: (procedure_id, description, tooth_number, quantity, unit_price, discount)
pub fn create_quote(
    conn: &Connection,
    patient_id: i64,
    odontogram_id: Option<i64>,
    items: &[(Option<i64>, String, Option<String>, i64, f64, f64)],
    global_discount: f64,
    valid_until: Option<&str>,
    notes: Option<&str>,
    created_by: i64,
) -> Result<Quote, String> {
    conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| e.to_string())?;

    let result = (|| -> Result<i64, String> {
        let quote_number = next_quote_number(conn)?;

        let subtotal: f64 = items
            .iter()
            .map(|(_, _, _, qty, price, disc)| (*qty as f64) * price - disc)
            .sum();
        let total = subtotal - global_discount;

        conn.execute(
            "INSERT INTO quotes (quote_number, patient_id, odontogram_id, subtotal, discount, total, valid_until, notes, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                quote_number,
                patient_id,
                odontogram_id,
                subtotal,
                global_discount,
                total,
                valid_until,
                notes,
                created_by
            ],
        )
        .map_err(|e| format!("Error al crear cotización: {}", e))?;

        let quote_id = conn.last_insert_rowid();

        for (proc_id, desc, tooth, qty, unit_price, discount) in items {
            let item_total = (*qty as f64) * unit_price - discount;
            conn.execute(
                "INSERT INTO quote_items (quote_id, procedure_id, description, tooth_number, quantity, unit_price, discount, total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![quote_id, proc_id, desc, tooth, qty, unit_price, discount, item_total],
            )
            .map_err(|e| format!("Error al agregar ítem: {}", e))?;
        }

        Ok(quote_id)
    })();

    match result {
        Ok(quote_id) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            get_quote(conn, quote_id)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

pub fn get_quote(conn: &Connection, id: i64) -> Result<Quote, String> {
    conn.query_row(
        "SELECT q.id, q.quote_number, q.patient_id, q.odontogram_id,
                q.subtotal, q.discount, q.total, q.status, q.valid_until,
                q.notes, q.invoice_id, q.odontogram_image_path, q.created_by, u.display_name,
                (p.first_name || ' ' || p.last_name), q.created_at, q.updated_at
         FROM quotes q
         LEFT JOIN users u ON u.id = q.created_by
         LEFT JOIN patients p ON p.id = q.patient_id
         WHERE q.id = ?1",
        params![id],
        |row| {
            Ok(Quote {
                id: row.get(0)?,
                quote_number: row.get(1)?,
                patient_id: row.get(2)?,
                odontogram_id: row.get(3)?,
                subtotal: row.get(4)?,
                discount: row.get(5)?,
                total: row.get(6)?,
                status: row.get(7)?,
                valid_until: row.get(8)?,
                notes: row.get(9)?,
                invoice_id: row.get(10)?,
                odontogram_image_path: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                patient_name: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        },
    )
    .map_err(|_| "Cotización no encontrada.".to_string())
}

pub fn get_quote_detail(conn: &Connection, id: i64) -> Result<QuoteDetail, String> {
    let quote = get_quote(conn, id)?;
    let items = get_items(conn, id)?;
    Ok(QuoteDetail { quote, items })
}

pub fn get_items(conn: &Connection, quote_id: i64) -> Result<Vec<QuoteItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, quote_id, procedure_id, description, tooth_number, quantity, unit_price, discount, total
             FROM quote_items WHERE quote_id = ?1 ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![quote_id], |row| {
            Ok(QuoteItem {
                id: row.get(0)?,
                quote_id: row.get(1)?,
                procedure_id: row.get(2)?,
                description: row.get(3)?,
                tooth_number: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
                discount: row.get(7)?,
                total: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn list_by_patient(conn: &Connection, patient_id: i64) -> Result<Vec<Quote>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT q.id, q.quote_number, q.patient_id, q.odontogram_id,
                    q.subtotal, q.discount, q.total, q.status, q.valid_until,
                    q.notes, q.invoice_id, q.odontogram_image_path, q.created_by, u.display_name,
                    (p.first_name || ' ' || p.last_name), q.created_at, q.updated_at
             FROM quotes q
             LEFT JOIN users u ON u.id = q.created_by
             LEFT JOIN patients p ON p.id = q.patient_id
             WHERE q.patient_id = ?1
             ORDER BY q.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![patient_id], |row| {
            Ok(Quote {
                id: row.get(0)?,
                quote_number: row.get(1)?,
                patient_id: row.get(2)?,
                odontogram_id: row.get(3)?,
                subtotal: row.get(4)?,
                discount: row.get(5)?,
                total: row.get(6)?,
                status: row.get(7)?,
                valid_until: row.get(8)?,
                notes: row.get(9)?,
                invoice_id: row.get(10)?,
                odontogram_image_path: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                patient_name: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn set_odontogram_image_path(
    conn: &Connection,
    quote_id: i64,
    path: &str,
) -> Result<(), String> {
    conn.execute(
        "UPDATE quotes SET odontogram_image_path = ?1 WHERE id = ?2",
        params![path, quote_id],
    )
    .map_err(|e| format!("Error al guardar imagen del odontograma: {}", e))?;
    Ok(())
}

pub fn update_status(conn: &Connection, quote_id: i64, status: &str) -> Result<Quote, String> {
    conn.execute(
        "UPDATE quotes SET status = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![status, quote_id],
    )
    .map_err(|e| format!("Error al actualizar estado: {}", e))?;
    get_quote(conn, quote_id)
}

/// Mark a quote as converted and link it to the generated invoice.
pub fn mark_converted(conn: &Connection, quote_id: i64, invoice_id: i64) -> Result<Quote, String> {
    conn.execute(
        "UPDATE quotes SET status = 'converted', invoice_id = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
        params![invoice_id, quote_id],
    )
    .map_err(|e| format!("Error al marcar como facturada: {}", e))?;
    get_quote(conn, quote_id)
}
