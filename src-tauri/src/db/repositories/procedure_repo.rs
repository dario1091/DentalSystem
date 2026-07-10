use rusqlite::{params, Connection};

use crate::models::procedure::{
    CreateProcedureRequest, PriceHistoryEntry, Procedure, ProcedureSummary, UpdatePriceRequest,
    UpdateProcedureRequest,
};

pub fn create(conn: &Connection, req: &CreateProcedureRequest) -> Result<Procedure, String> {
    let duration = req.duration_minutes.unwrap_or(30);

    conn.execute(
        "INSERT INTO procedures (code, name, category, description, base_price, duration_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![req.code, req.name, req.category, req.description, req.base_price, duration],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: procedures.code") {
            "Ya existe un procedimiento con ese código.".to_string()
        } else {
            format!("Error al crear procedimiento: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Procedure, String> {
    conn.query_row(
        "SELECT id, code, name, category, description, base_price, duration_minutes, is_active, created_at, updated_at
         FROM procedures WHERE id = ?1",
        params![id],
        |row| {
            Ok(Procedure {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                description: row.get(4)?,
                base_price: row.get(5)?,
                duration_minutes: row.get(6)?,
                is_active: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|_| "Procedimiento no encontrado.".to_string())
}

pub fn list(
    conn: &Connection,
    active_only: bool,
    category: Option<&str>,
) -> Result<Vec<ProcedureSummary>, String> {
    let mut sql = String::from(
        "SELECT id, code, name, category, base_price, duration_minutes, is_active FROM procedures",
    );
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if active_only {
        conditions.push("is_active = 1".to_string());
    }

    if let Some(cat) = category {
        conditions.push(format!("category = ?{}", param_values.len() + 1));
        param_values.push(Box::new(cat.to_string()));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    sql.push_str(" ORDER BY category, name");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|v| v.as_ref()).collect();

    let procedures = stmt
        .query_map(params.as_slice(), |row| {
            Ok(ProcedureSummary {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                base_price: row.get(4)?,
                duration_minutes: row.get(5)?,
                is_active: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(procedures)
}

pub fn search(conn: &Connection, query: &str) -> Result<Vec<ProcedureSummary>, String> {
    let search_term = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT id, code, name, category, base_price, duration_minutes, is_active
             FROM procedures
             WHERE is_active = 1 AND (name LIKE ?1 OR code LIKE ?1 OR category LIKE ?1)
             ORDER BY name
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let procedures = stmt
        .query_map(params![search_term], |row| {
            Ok(ProcedureSummary {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                base_price: row.get(4)?,
                duration_minutes: row.get(5)?,
                is_active: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(procedures)
}

pub fn update(conn: &Connection, req: &UpdateProcedureRequest) -> Result<Procedure, String> {
    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    macro_rules! push_field {
        ($field:expr, $col:expr) => {
            if let Some(ref val) = $field {
                sets.push(format!("{} = ?", $col));
                values.push(Box::new(val.clone()));
            }
        };
    }

    push_field!(req.code, "code");
    push_field!(req.name, "name");
    push_field!(req.category, "category");
    push_field!(req.description, "description");
    push_field!(req.duration_minutes, "duration_minutes");

    if let Some(active) = req.is_active {
        sets.push("is_active = ?".to_string());
        values.push(Box::new(active as i32));
    }

    if sets.is_empty() {
        return get_by_id(conn, req.id);
    }

    sets.push("updated_at = datetime('now')".to_string());

    let sql = format!("UPDATE procedures SET {} WHERE id = ?", sets.join(", "));
    values.push(Box::new(req.id));

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: procedures.code") {
            "Ya existe un procedimiento con ese código.".to_string()
        } else {
            format!("Error al actualizar procedimiento: {}", e)
        }
    })?;

    get_by_id(conn, req.id)
}

pub fn update_price(
    conn: &Connection,
    req: &UpdatePriceRequest,
    user_id: i64,
) -> Result<Procedure, String> {
    // Get current price
    let current_price: f64 = conn
        .query_row(
            "SELECT base_price FROM procedures WHERE id = ?1",
            params![req.procedure_id],
            |row| row.get(0),
        )
        .map_err(|_| "Procedimiento no encontrado.".to_string())?;

    if (current_price - req.new_price).abs() < 0.01 {
        return get_by_id(conn, req.procedure_id);
    }

    // Record price change in history
    conn.execute(
        "INSERT INTO procedure_price_history (procedure_id, old_price, new_price, changed_by, reason)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![req.procedure_id, current_price, req.new_price, user_id, req.reason],
    )
    .map_err(|e| format!("Error al registrar historial de precios: {}", e))?;

    // Update the base price
    conn.execute(
        "UPDATE procedures SET base_price = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![req.new_price, req.procedure_id],
    )
    .map_err(|e| format!("Error al actualizar precio: {}", e))?;

    get_by_id(conn, req.procedure_id)
}

pub fn get_price_history(
    conn: &Connection,
    procedure_id: i64,
) -> Result<Vec<PriceHistoryEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT ph.id, ph.procedure_id, ph.old_price, ph.new_price, ph.changed_by, u.display_name, ph.reason, ph.changed_at
             FROM procedure_price_history ph
             LEFT JOIN users u ON u.id = ph.changed_by
             WHERE ph.procedure_id = ?1
             ORDER BY ph.changed_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let history = stmt
        .query_map(params![procedure_id], |row| {
            Ok(PriceHistoryEntry {
                id: row.get(0)?,
                procedure_id: row.get(1)?,
                old_price: row.get(2)?,
                new_price: row.get(3)?,
                changed_by: row.get(4)?,
                changed_by_name: row.get(5)?,
                reason: row.get(6)?,
                changed_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(history)
}

pub fn deactivate(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE procedures SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Error al desactivar procedimiento: {}", e))?;
    Ok(())
}
