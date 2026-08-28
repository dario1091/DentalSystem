use rusqlite::{params, Connection};

use crate::models::billing::{
    CreditMovement, PatientCredit, RefundResult, REFUND_PENALTY_RATE,
};

/// Método de pago sintético usado cuando una factura se paga con saldo a favor.
const CREDIT_PAYMENT_METHOD: &str = "saldo_a_favor";

/// Lee el saldo a favor actual del paciente (0 si no tiene fila).
pub fn get_credit_balance(conn: &Connection, patient_id: i64) -> Result<f64, String> {
    let balance: f64 = conn
        .query_row(
            "SELECT balance FROM patient_credits WHERE patient_id = ?1",
            params![patient_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);
    Ok(balance)
}

/// Suma `delta` (puede ser negativo) al saldo del paciente, creando la fila si no existe.
/// Devuelve el nuevo saldo. NO abre transacción propia (se llama dentro de una).
fn adjust_balance(conn: &Connection, patient_id: i64, delta: f64) -> Result<f64, String> {
    conn.execute(
        "INSERT INTO patient_credits (patient_id, balance, updated_at)
         VALUES (?1, ?2, datetime('now', 'localtime'))
         ON CONFLICT(patient_id) DO UPDATE SET
            balance = balance + ?2,
            updated_at = datetime('now', 'localtime')",
        params![patient_id, delta],
    )
    .map_err(|e| format!("Error al actualizar saldo: {}", e))?;

    get_credit_balance(conn, patient_id)
}

/// Registra un movimiento en el historial. NO abre transacción propia.
fn insert_movement(
    conn: &Connection,
    patient_id: i64,
    movement_type: &str,
    amount: f64,
    invoice_id: Option<i64>,
    payment_method: Option<&str>,
    reference: Option<&str>,
    notes: Option<&str>,
    created_by: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO credit_movements
            (patient_id, movement_type, amount, invoice_id, payment_method, reference, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            patient_id,
            movement_type,
            amount,
            invoice_id,
            payment_method,
            reference,
            notes,
            created_by
        ],
    )
    .map_err(|e| format!("Error al registrar movimiento: {}", e))?;
    Ok(())
}

/// Registra un abono/anticipo: entra dinero al saldo a favor (bolsa general).
pub fn add_credit(
    conn: &Connection,
    patient_id: i64,
    amount: f64,
    payment_method: &str,
    reference: Option<&str>,
    notes: Option<&str>,
    created_by: i64,
) -> Result<PatientCredit, String> {
    if amount <= 0.0 {
        return Err("El monto del abono debe ser mayor a 0.".to_string());
    }

    conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        adjust_balance(conn, patient_id, amount)?;
        insert_movement(
            conn,
            patient_id,
            "deposit",
            amount,
            None,
            Some(payment_method),
            reference,
            notes,
            created_by,
        )
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            get_credit(conn, patient_id)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

/// Aplica saldo a favor a una factura existente. Consume el saldo y registra un
/// pago real sobre la factura, todo en la misma transacción.
pub fn apply_credit_to_invoice(
    conn: &Connection,
    patient_id: i64,
    invoice_id: i64,
    amount: f64,
    notes: Option<&str>,
    created_by: i64,
) -> Result<PatientCredit, String> {
    if amount <= 0.0 {
        return Err("El monto a aplicar debe ser mayor a 0.".to_string());
    }

    // Validaciones previas (fuera de transacción para fallar rápido).
    let balance = get_credit_balance(conn, patient_id)?;
    if amount > balance + f64::EPSILON {
        return Err(format!(
            "Saldo insuficiente. Disponible: {:.2}, solicitado: {:.2}.",
            balance, amount
        ));
    }

    // La factura debe existir, ser del paciente y no estar cancelada.
    let (inv_patient, inv_total, inv_paid, inv_status): (i64, f64, f64, String) = conn
        .query_row(
            "SELECT patient_id, total, amount_paid, status FROM invoices WHERE id = ?1",
            params![invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Factura no encontrada.".to_string())?;

    if inv_patient != patient_id {
        return Err("La factura no pertenece a este paciente.".to_string());
    }
    if inv_status == "cancelled" {
        return Err("No se puede aplicar saldo a una factura anulada.".to_string());
    }

    let pending = inv_total - inv_paid;
    if amount > pending + f64::EPSILON {
        return Err(format!(
            "El monto excede el saldo pendiente de la factura ({:.2}).",
            pending
        ));
    }

    conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        // 1. Registrar el pago sobre la factura.
        conn.execute(
            "INSERT INTO payments (invoice_id, amount, payment_method, reference, notes, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                invoice_id,
                amount,
                CREDIT_PAYMENT_METHOD,
                Option::<String>::None,
                notes,
                created_by
            ],
        )
        .map_err(|e| format!("Error al registrar pago: {}", e))?;

        // 2. Actualizar amount_paid y estado de la factura.
        let new_paid = inv_paid + amount;
        let new_status = if new_paid >= inv_total - f64::EPSILON {
            "paid"
        } else {
            "partial"
        };
        conn.execute(
            "UPDATE invoices SET amount_paid = ?1, status = ?2, updated_at = datetime('now', 'localtime') WHERE id = ?3",
            params![new_paid, new_status, invoice_id],
        )
        .map_err(|e| e.to_string())?;

        // 3. Descontar del saldo a favor.
        adjust_balance(conn, patient_id, -amount)?;

        // 4. Registrar el movimiento de crédito.
        insert_movement(
            conn,
            patient_id,
            "apply",
            amount,
            Some(invoice_id),
            None,
            None,
            notes,
            created_by,
        )
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            get_credit(conn, patient_id)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

/// Devuelve TODO el saldo a favor al paciente aplicando la penalización del 20%.
/// Se retira el 100% del saldo: se entrega el 80% (refund) y se retiene el 20% (penalty).
pub fn refund_credit(
    conn: &Connection,
    patient_id: i64,
    payment_method: &str,
    reference: Option<&str>,
    notes: Option<&str>,
    created_by: i64,
) -> Result<RefundResult, String> {
    let balance = get_credit_balance(conn, patient_id)?;
    if balance <= 0.0 {
        return Err("El paciente no tiene saldo a favor para devolver.".to_string());
    }

    // Redondeo a 2 decimales para evitar arrastre de flotantes en dinero.
    let round2 = |v: f64| (v * 100.0).round() / 100.0;
    let total_withdrawn = round2(balance);
    let penalty_amount = round2(total_withdrawn * REFUND_PENALTY_RATE);
    let refunded_amount = round2(total_withdrawn - penalty_amount);

    conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        // Vaciar el saldo (se retira el 100%).
        adjust_balance(conn, patient_id, -total_withdrawn)?;

        // Movimiento de devolución (lo que se entrega en mano al paciente).
        insert_movement(
            conn,
            patient_id,
            "refund",
            refunded_amount,
            None,
            Some(payment_method),
            reference,
            notes,
            created_by,
        )?;

        // Movimiento de penalización (ingreso de la clínica).
        insert_movement(
            conn,
            patient_id,
            "penalty",
            penalty_amount,
            None,
            None,
            None,
            Some("Retención 20% por devolución de saldo"),
            created_by,
        )
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(RefundResult {
                total_withdrawn,
                refunded_amount,
                penalty_amount,
            })
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

/// Devuelve el saldo actual del paciente como struct.
pub fn get_credit(conn: &Connection, patient_id: i64) -> Result<PatientCredit, String> {
    let balance = get_credit_balance(conn, patient_id)?;
    let updated_at: String = conn
        .query_row(
            "SELECT updated_at FROM patient_credits WHERE patient_id = ?1",
            params![patient_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| String::new());
    Ok(PatientCredit {
        patient_id,
        balance,
        updated_at,
    })
}

/// Lista los movimientos de saldo a favor de un paciente (más recientes primero).
pub fn list_movements(
    conn: &Connection,
    patient_id: i64,
) -> Result<Vec<CreditMovement>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.patient_id, m.movement_type, m.amount, m.invoice_id,
                    i.invoice_number, m.payment_method, m.reference, m.notes,
                    m.created_by, u.display_name, m.created_at
             FROM credit_movements m
             LEFT JOIN invoices i ON i.id = m.invoice_id
             LEFT JOIN users u ON u.id = m.created_by
             WHERE m.patient_id = ?1
             ORDER BY m.created_at DESC, m.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![patient_id], |row| {
            Ok(CreditMovement {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                movement_type: row.get(2)?,
                amount: row.get(3)?,
                invoice_id: row.get(4)?,
                invoice_number: row.get(5)?,
                payment_method: row.get(6)?,
                reference: row.get(7)?,
                notes: row.get(8)?,
                created_by: row.get(9)?,
                created_by_name: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

/// Totales de movimientos de saldo a favor en un rango de fechas.
/// (deposits, applied, refunds, penalties).
pub fn credit_report(
    conn: &Connection,
    from_date: Option<&str>,
    to_date: Option<&str>,
) -> Result<(f64, f64, f64, f64), String> {
    let mut query = String::from(
        "SELECT
            COALESCE(SUM(CASE WHEN movement_type = 'deposit' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN movement_type = 'apply'   THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN movement_type = 'refund'  THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN movement_type = 'penalty' THEN amount ELSE 0 END), 0)
         FROM credit_movements
         WHERE 1 = 1",
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(from) = from_date {
        param_values.push(Box::new(from.to_string()));
        query.push_str(&format!(
            " AND date(created_at) >= date(?{})",
            param_values.len()
        ));
    }
    if let Some(to) = to_date {
        param_values.push(Box::new(to.to_string()));
        query.push_str(&format!(
            " AND date(created_at) <= date(?{})",
            param_values.len()
        ));
    }

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let result = conn
        .query_row(&query, params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, f64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    Ok(result)
}
