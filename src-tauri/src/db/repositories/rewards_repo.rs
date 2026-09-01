use rusqlite::{params, Connection};

use crate::models::rewards::{PatientPrize, Prize};

// ===== Catálogo de premios =====

pub fn create_prize(
    conn: &Connection,
    name: &str,
    color: &str,
    weight: f64,
    validity_days: i64,
) -> Result<Prize, String> {
    if name.trim().is_empty() {
        return Err("El nombre del premio es obligatorio.".to_string());
    }
    if weight < 0.0 {
        return Err("El peso no puede ser negativo.".to_string());
    }
    conn.execute(
        "INSERT INTO prizes (name, color, weight, validity_days) VALUES (?1, ?2, ?3, ?4)",
        params![name, color, weight, validity_days],
    )
    .map_err(|e| format!("Error al crear premio: {}", e))?;
    get_prize(conn, conn.last_insert_rowid())
}

pub fn update_prize(
    conn: &Connection,
    id: i64,
    name: &str,
    color: &str,
    weight: f64,
    validity_days: i64,
    active: bool,
) -> Result<Prize, String> {
    if name.trim().is_empty() {
        return Err("El nombre del premio es obligatorio.".to_string());
    }
    if weight < 0.0 {
        return Err("El peso no puede ser negativo.".to_string());
    }
    conn.execute(
        "UPDATE prizes SET name = ?1, color = ?2, weight = ?3, validity_days = ?4, active = ?5,
            updated_at = datetime('now', 'localtime') WHERE id = ?6",
        params![name, color, weight, validity_days, active as i64, id],
    )
    .map_err(|e| format!("Error al actualizar premio: {}", e))?;
    get_prize(conn, id)
}

/// Elimina un premio del catálogo. Los premios ya ganados conservan su snapshot.
pub fn delete_prize(conn: &Connection, id: i64) -> Result<(), String> {
    // Desligar los premios ganados para no violar la FK, conservando prize_name.
    conn.execute(
        "UPDATE patient_prizes SET prize_id = NULL WHERE prize_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM prizes WHERE id = ?1", params![id])
        .map_err(|e| format!("Error al eliminar premio: {}", e))?;
    Ok(())
}

pub fn get_prize(conn: &Connection, id: i64) -> Result<Prize, String> {
    conn.query_row(
        "SELECT id, name, color, weight, validity_days, active, created_at, updated_at
         FROM prizes WHERE id = ?1",
        params![id],
        map_prize,
    )
    .map_err(|_| "Premio no encontrado.".to_string())
}

/// Lista premios. Si `only_active` es true, solo los activos (para la ruleta).
pub fn list_prizes(conn: &Connection, only_active: bool) -> Result<Vec<Prize>, String> {
    let sql = if only_active {
        "SELECT id, name, color, weight, validity_days, active, created_at, updated_at
         FROM prizes WHERE active = 1 ORDER BY id"
    } else {
        "SELECT id, name, color, weight, validity_days, active, created_at, updated_at
         FROM prizes ORDER BY id"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_prize)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

fn map_prize(row: &rusqlite::Row) -> rusqlite::Result<Prize> {
    Ok(Prize {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        weight: row.get(3)?,
        validity_days: row.get(4)?,
        active: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

// ===== Girar la ruleta =====

/// Gira la ruleta: elige un premio activo por peso, lo asigna al paciente y devuelve el registro.
pub fn spin(
    conn: &Connection,
    patient_id: i64,
    created_by: i64,
) -> Result<PatientPrize, String> {
    let prizes = list_prizes(conn, true)?;
    if prizes.is_empty() {
        return Err("No hay premios activos en la ruleta.".to_string());
    }

    let total_weight: f64 = prizes.iter().map(|p| p.weight.max(0.0)).sum();
    if total_weight <= 0.0 {
        return Err("Los premios no tienen peso válido para el sorteo.".to_string());
    }

    // Selección ponderada.
    let mut roll = rand::random::<f64>() * total_weight;
    let chosen = prizes
        .iter()
        .find(|p| {
            roll -= p.weight.max(0.0);
            roll < 0.0
        })
        .unwrap_or_else(|| prizes.last().unwrap());

    // Calcular vencimiento (null si validity_days <= 0).
    let expires_at: Option<String> = if chosen.validity_days > 0 {
        Some(format!("+{} days", chosen.validity_days))
    } else {
        None
    };

    if let Some(offset) = &expires_at {
        conn.execute(
            "INSERT INTO patient_prizes (patient_id, prize_id, prize_name, status, expires_at, created_by)
             VALUES (?1, ?2, ?3, 'pending', datetime('now', 'localtime', ?4), ?5)",
            params![patient_id, chosen.id, chosen.name, offset, created_by],
        )
        .map_err(|e| format!("Error al registrar premio: {}", e))?;
    } else {
        conn.execute(
            "INSERT INTO patient_prizes (patient_id, prize_id, prize_name, status, expires_at, created_by)
             VALUES (?1, ?2, ?3, 'pending', NULL, ?4)",
            params![patient_id, chosen.id, chosen.name, created_by],
        )
        .map_err(|e| format!("Error al registrar premio: {}", e))?;
    }

    get_patient_prize(conn, conn.last_insert_rowid())
}

// ===== Premios ganados =====

/// Marca como vencidos los premios pendientes cuya fecha de expiración ya pasó.
fn expire_stale(conn: &Connection) {
    let _ = conn.execute(
        "UPDATE patient_prizes SET status = 'expired'
         WHERE status = 'pending' AND expires_at IS NOT NULL
           AND datetime(expires_at) < datetime('now', 'localtime')",
        [],
    );
}

pub fn get_patient_prize(conn: &Connection, id: i64) -> Result<PatientPrize, String> {
    conn.query_row(
        "SELECT pp.id, pp.patient_id, (p.first_name || ' ' || p.last_name),
                pp.prize_id, pp.prize_name, pp.status, pp.won_at, pp.expires_at,
                pp.redeemed_at, pp.notes, pp.created_by, u.display_name
         FROM patient_prizes pp
         LEFT JOIN patients p ON p.id = pp.patient_id
         LEFT JOIN users u ON u.id = pp.created_by
         WHERE pp.id = ?1",
        params![id],
        map_patient_prize,
    )
    .map_err(|_| "Premio no encontrado.".to_string())
}

pub fn list_by_patient(conn: &Connection, patient_id: i64) -> Result<Vec<PatientPrize>, String> {
    expire_stale(conn);
    let mut stmt = conn
        .prepare(
            "SELECT pp.id, pp.patient_id, (p.first_name || ' ' || p.last_name),
                    pp.prize_id, pp.prize_name, pp.status, pp.won_at, pp.expires_at,
                    pp.redeemed_at, pp.notes, pp.created_by, u.display_name
             FROM patient_prizes pp
             LEFT JOIN patients p ON p.id = pp.patient_id
             LEFT JOIN users u ON u.id = pp.created_by
             WHERE pp.patient_id = ?1
             ORDER BY pp.won_at DESC, pp.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![patient_id], map_patient_prize)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

/// Lista todos los premios pendientes (vista global de "quién tiene qué sin reclamar").
pub fn list_pending(conn: &Connection) -> Result<Vec<PatientPrize>, String> {
    expire_stale(conn);
    let mut stmt = conn
        .prepare(
            "SELECT pp.id, pp.patient_id, (p.first_name || ' ' || p.last_name),
                    pp.prize_id, pp.prize_name, pp.status, pp.won_at, pp.expires_at,
                    pp.redeemed_at, pp.notes, pp.created_by, u.display_name
             FROM patient_prizes pp
             LEFT JOIN patients p ON p.id = pp.patient_id
             LEFT JOIN users u ON u.id = pp.created_by
             WHERE pp.status = 'pending'
             ORDER BY pp.expires_at IS NULL, datetime(pp.expires_at) ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_patient_prize)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

/// Marca un premio como canjeado.
pub fn redeem(conn: &Connection, id: i64, notes: Option<&str>) -> Result<PatientPrize, String> {
    let status: String = conn
        .query_row(
            "SELECT status FROM patient_prizes WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Premio no encontrado.".to_string())?;

    if status == "redeemed" {
        return Err("Este premio ya fue canjeado.".to_string());
    }
    if status == "expired" {
        return Err("Este premio está vencido y no puede canjearse.".to_string());
    }

    conn.execute(
        "UPDATE patient_prizes SET status = 'redeemed',
            redeemed_at = datetime('now', 'localtime'),
            notes = COALESCE(?2, notes)
         WHERE id = ?1",
        params![id, notes],
    )
    .map_err(|e| format!("Error al canjear premio: {}", e))?;

    get_patient_prize(conn, id)
}

fn map_patient_prize(row: &rusqlite::Row) -> rusqlite::Result<PatientPrize> {
    Ok(PatientPrize {
        id: row.get(0)?,
        patient_id: row.get(1)?,
        patient_name: row.get(2)?,
        prize_id: row.get(3)?,
        prize_name: row.get(4)?,
        status: row.get(5)?,
        won_at: row.get(6)?,
        expires_at: row.get(7)?,
        redeemed_at: row.get(8)?,
        notes: row.get(9)?,
        created_by: row.get(10)?,
        created_by_name: row.get(11)?,
    })
}
