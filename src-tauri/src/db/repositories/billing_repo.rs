use rusqlite::{params, Connection};

use crate::models::billing::{Invoice, InvoiceDetail, InvoiceItem, PatientBalance, Payment};

/// Get next invoice number from settings and increment
fn next_invoice_number(conn: &Connection) -> Result<String, String> {
    let num: i64 = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'invoice_next_number'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);

    conn.execute(
        "UPDATE settings SET value = ?1 WHERE key = 'invoice_next_number'",
        params![(num + 1).to_string()],
    )
    .map_err(|e| e.to_string())?;

    Ok(format!("REC-{:06}", num))
}

pub fn create_invoice(
    conn: &Connection,
    patient_id: i64,
    appointment_id: Option<i64>,
    items: &[(Option<i64>, &str, i64, f64, f64)], // (procedure_id, description, qty, unit_price, discount)
    global_discount: f64,
    notes: Option<&str>,
    created_by: i64,
) -> Result<Invoice, String> {
    let invoice_number = next_invoice_number(conn)?;

    // Calculate totals
    let subtotal: f64 = items.iter().map(|(_, _, qty, price, disc)| {
        let line_total = (*qty as f64) * price;
        line_total - disc
    }).sum();
    let total = subtotal - global_discount;

    conn.execute(
        "INSERT INTO invoices (invoice_number, patient_id, appointment_id, subtotal, discount, total, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![invoice_number, patient_id, appointment_id, subtotal, global_discount, total, notes, created_by],
    )
    .map_err(|e| format!("Error al crear factura: {}", e))?;

    let invoice_id = conn.last_insert_rowid();

    // Insert items
    for (proc_id, desc, qty, unit_price, discount) in items {
        let item_total = (*qty as f64) * unit_price - discount;
        conn.execute(
            "INSERT INTO invoice_items (invoice_id, procedure_id, description, quantity, unit_price, discount, total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![invoice_id, proc_id, desc, qty, unit_price, discount, item_total],
        )
        .map_err(|e| format!("Error al agregar item: {}", e))?;
    }

    get_invoice(conn, invoice_id)
}

pub fn get_invoice(conn: &Connection, id: i64) -> Result<Invoice, String> {
    conn.query_row(
        "SELECT i.id, i.invoice_number, i.patient_id, i.appointment_id,
                i.subtotal, i.discount, i.total, i.amount_paid, i.status,
                i.notes, i.created_by, u.display_name,
                (p.first_name || ' ' || p.last_name), i.created_at, i.updated_at
         FROM invoices i
         LEFT JOIN users u ON u.id = i.created_by
         LEFT JOIN patients p ON p.id = i.patient_id
         WHERE i.id = ?1",
        params![id],
        |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                patient_id: row.get(2)?,
                appointment_id: row.get(3)?,
                subtotal: row.get(4)?,
                discount: row.get(5)?,
                total: row.get(6)?,
                amount_paid: row.get(7)?,
                status: row.get(8)?,
                notes: row.get(9)?,
                created_by: row.get(10)?,
                created_by_name: row.get(11)?,
                patient_name: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        },
    )
    .map_err(|_| "Factura no encontrada.".to_string())
}

pub fn get_invoice_detail(conn: &Connection, id: i64) -> Result<InvoiceDetail, String> {
    let invoice = get_invoice(conn, id)?;
    let items = get_items(conn, id)?;
    let payments = get_payments(conn, id)?;
    Ok(InvoiceDetail { invoice, items, payments })
}

pub fn get_items(conn: &Connection, invoice_id: i64) -> Result<Vec<InvoiceItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, procedure_id, description, quantity, unit_price, discount, total
             FROM invoice_items WHERE invoice_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoiceItem {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                procedure_id: row.get(2)?,
                description: row.get(3)?,
                quantity: row.get(4)?,
                unit_price: row.get(5)?,
                discount: row.get(6)?,
                total: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn get_payments(conn: &Connection, invoice_id: i64) -> Result<Vec<Payment>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.invoice_id, p.amount, p.payment_method, p.reference, p.notes,
                    p.created_by, u.display_name, p.created_at
             FROM payments p
             LEFT JOIN users u ON u.id = p.created_by
             WHERE p.invoice_id = ?1
             ORDER BY p.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![invoice_id], |row| {
            Ok(Payment {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                amount: row.get(2)?,
                payment_method: row.get(3)?,
                reference: row.get(4)?,
                notes: row.get(5)?,
                created_by: row.get(6)?,
                created_by_name: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn add_payment(conn: &Connection, invoice_id: i64, amount: f64, method: &str, reference: Option<&str>, notes: Option<&str>, created_by: i64) -> Result<Payment, String> {
    let invoice = get_invoice(conn, invoice_id)?;
    let new_paid = invoice.amount_paid + amount;

    if new_paid > invoice.total {
        return Err("El pago excede el saldo pendiente.".to_string());
    }

    conn.execute(
        "INSERT INTO payments (invoice_id, amount, payment_method, reference, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![invoice_id, amount, method, reference, notes, created_by],
    )
    .map_err(|e| format!("Error al registrar pago: {}", e))?;

    let payment_id = conn.last_insert_rowid();

    // Update invoice amount_paid and status
    let new_status = if new_paid >= invoice.total { "paid" } else { "partial" };
    conn.execute(
        "UPDATE invoices SET amount_paid = ?1, status = ?2, updated_at = datetime('now', 'localtime') WHERE id = ?3",
        params![new_paid, new_status, invoice_id],
    )
    .map_err(|e| e.to_string())?;

    // Return payment
    conn.query_row(
        "SELECT p.id, p.invoice_id, p.amount, p.payment_method, p.reference, p.notes,
                p.created_by, u.display_name, p.created_at
         FROM payments p
         LEFT JOIN users u ON u.id = p.created_by
         WHERE p.id = ?1",
        params![payment_id],
        |row| {
            Ok(Payment {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                amount: row.get(2)?,
                payment_method: row.get(3)?,
                reference: row.get(4)?,
                notes: row.get(5)?,
                created_by: row.get(6)?,
                created_by_name: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|_| "Error al obtener pago.".to_string())
}

pub fn list_by_patient(conn: &Connection, patient_id: i64) -> Result<Vec<Invoice>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.patient_id, i.appointment_id,
                    i.subtotal, i.discount, i.total, i.amount_paid, i.status,
                    i.notes, i.created_by, u.display_name,
                    (p.first_name || ' ' || p.last_name), i.created_at, i.updated_at
             FROM invoices i
             LEFT JOIN users u ON u.id = i.created_by
             LEFT JOIN patients p ON p.id = i.patient_id
             WHERE i.patient_id = ?1
             ORDER BY i.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![patient_id], |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                patient_id: row.get(2)?,
                appointment_id: row.get(3)?,
                subtotal: row.get(4)?,
                discount: row.get(5)?,
                total: row.get(6)?,
                amount_paid: row.get(7)?,
                status: row.get(8)?,
                notes: row.get(9)?,
                created_by: row.get(10)?,
                created_by_name: row.get(11)?,
                patient_name: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn get_patient_balance(conn: &Connection, patient_id: i64) -> Result<PatientBalance, String> {
    let result = conn.query_row(
        "SELECT COALESCE(SUM(total), 0), COALESCE(SUM(amount_paid), 0), COUNT(*)
         FROM invoices WHERE patient_id = ?1 AND status != 'cancelled'",
        params![patient_id],
        |row| {
            let total_invoiced: f64 = row.get(0)?;
            let total_paid: f64 = row.get(1)?;
            let count: i64 = row.get(2)?;
            Ok(PatientBalance {
                patient_id,
                total_invoiced,
                total_paid,
                balance_due: total_invoiced - total_paid,
                invoice_count: count,
            })
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Revenue report: total invoiced, paid, pending in a date range
pub fn revenue_report(conn: &Connection, from_date: Option<&str>, to_date: Option<&str>) -> Result<(f64, f64, f64, Vec<Invoice>), String> {
    let mut query = String::from(
        "SELECT i.id, i.invoice_number, i.patient_id, i.appointment_id,
                i.subtotal, i.discount, i.total, i.amount_paid, i.status,
                i.notes, i.created_by, u.display_name,
                (p.first_name || ' ' || p.last_name), i.created_at, i.updated_at
         FROM invoices i
         LEFT JOIN users u ON u.id = i.created_by
         LEFT JOIN patients p ON p.id = i.patient_id
         WHERE i.status != 'cancelled'",
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(from) = from_date {
        param_values.push(Box::new(from.to_string()));
        query.push_str(&format!(" AND date(i.created_at) >= date(?{})", param_values.len()));
    }
    if let Some(to) = to_date {
        param_values.push(Box::new(to.to_string()));
        query.push_str(&format!(" AND date(i.created_at) <= date(?{})", param_values.len()));
    }

    query.push_str(" ORDER BY i.created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let invoices: Vec<Invoice> = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                patient_id: row.get(2)?,
                appointment_id: row.get(3)?,
                subtotal: row.get(4)?,
                discount: row.get(5)?,
                total: row.get(6)?,
                amount_paid: row.get(7)?,
                status: row.get(8)?,
                notes: row.get(9)?,
                created_by: row.get(10)?,
                created_by_name: row.get(11)?,
                patient_name: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let total_invoiced: f64 = invoices.iter().map(|i| i.total).sum();
    let total_paid: f64 = invoices.iter().map(|i| i.amount_paid).sum();
    let pending: f64 = total_invoiced - total_paid;

    Ok((total_invoiced, total_paid, pending, invoices))
}
