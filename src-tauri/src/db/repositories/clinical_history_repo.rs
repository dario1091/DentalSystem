use rusqlite::{params, Connection};

use crate::models::clinical_history::{
    AddAddendumRequest, AddEvolutionRequest, ClinicalHistory, ClinicalHistoryDetail,
    CreateClinicalHistoryRequest, Evolution, UpdateClinicalHistoryRequest, UpdateEvolutionRequest,
};

pub fn create(
    conn: &Connection,
    req: &CreateClinicalHistoryRequest,
    user_id: i64,
) -> Result<ClinicalHistory, String> {
    // Check uniqueness: one history per patient
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM clinical_histories WHERE patient_id = ?1",
            params![req.patient_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists {
        return Err("El paciente ya tiene una historia clínica registrada.".to_string());
    }

    conn.execute(
        "INSERT INTO clinical_histories (patient_id, chief_complaint, present_illness, medical_history,
         surgical_history, family_history, allergies, medications, clinical_exam, diagnosis, treatment_plan, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            req.patient_id,
            req.chief_complaint,
            req.present_illness,
            req.medical_history,
            req.surgical_history,
            req.family_history,
            req.allergies,
            req.medications,
            req.clinical_exam,
            req.diagnosis,
            req.treatment_plan,
            user_id,
        ],
    )
    .map_err(|e| format!("Error al crear historia clínica: {}", e))?;

    let id = conn.last_insert_rowid();
    get_by_id(conn, id)
}

pub fn update(
    conn: &Connection,
    req: &UpdateClinicalHistoryRequest,
) -> Result<ClinicalHistory, String> {
    let current = get_by_id(conn, req.id)?;

    let chief_complaint = req.chief_complaint.as_deref().unwrap_or(&current.chief_complaint);
    let present_illness = req.present_illness.as_ref().or(current.present_illness.as_ref());
    let medical_history = req.medical_history.as_ref().or(current.medical_history.as_ref());
    let surgical_history = req.surgical_history.as_ref().or(current.surgical_history.as_ref());
    let family_history = req.family_history.as_ref().or(current.family_history.as_ref());
    let allergies = req.allergies.as_ref().or(current.allergies.as_ref());
    let medications = req.medications.as_ref().or(current.medications.as_ref());
    let clinical_exam = req.clinical_exam.as_ref().or(current.clinical_exam.as_ref());
    let diagnosis = req.diagnosis.as_ref().or(current.diagnosis.as_ref());
    let treatment_plan = req.treatment_plan.as_ref().or(current.treatment_plan.as_ref());

    conn.execute(
        "UPDATE clinical_histories SET
         chief_complaint = ?1, present_illness = ?2, medical_history = ?3,
         surgical_history = ?4, family_history = ?5, allergies = ?6,
         medications = ?7, clinical_exam = ?8, diagnosis = ?9,
         treatment_plan = ?10, updated_at = datetime('now', 'localtime')
         WHERE id = ?11",
        params![
            chief_complaint,
            present_illness,
            medical_history,
            surgical_history,
            family_history,
            allergies,
            medications,
            clinical_exam,
            diagnosis,
            treatment_plan,
            req.id,
        ],
    )
    .map_err(|e| format!("Error al actualizar historia clínica: {}", e))?;

    get_by_id(conn, req.id)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<ClinicalHistory, String> {
    conn.query_row(
        "SELECT ch.id, ch.patient_id, ch.chief_complaint, ch.present_illness,
                ch.medical_history, ch.surgical_history, ch.family_history,
                ch.allergies, ch.medications, ch.clinical_exam, ch.diagnosis,
                ch.treatment_plan, ch.created_by, u.display_name, ch.created_at, ch.updated_at,
                (SELECT COUNT(*) FROM evolutions WHERE clinical_history_id = ch.id) as evolutions_count
         FROM clinical_histories ch
         LEFT JOIN users u ON u.id = ch.created_by
         WHERE ch.id = ?1",
        params![id],
        |row| {
            Ok(ClinicalHistory {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                chief_complaint: row.get(2)?,
                present_illness: row.get(3)?,
                medical_history: row.get(4)?,
                surgical_history: row.get(5)?,
                family_history: row.get(6)?,
                allergies: row.get(7)?,
                medications: row.get(8)?,
                clinical_exam: row.get(9)?,
                diagnosis: row.get(10)?,
                treatment_plan: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
                evolutions_count: row.get(16)?,
            })
        },
    )
    .map_err(|_| "Historia clínica no encontrada.".to_string())
}

pub fn get_by_patient(conn: &Connection, patient_id: i64) -> Result<Option<ClinicalHistory>, String> {
    let result = conn.query_row(
        "SELECT ch.id, ch.patient_id, ch.chief_complaint, ch.present_illness,
                ch.medical_history, ch.surgical_history, ch.family_history,
                ch.allergies, ch.medications, ch.clinical_exam, ch.diagnosis,
                ch.treatment_plan, ch.created_by, u.display_name, ch.created_at, ch.updated_at,
                (SELECT COUNT(*) FROM evolutions WHERE clinical_history_id = ch.id) as evolutions_count
         FROM clinical_histories ch
         LEFT JOIN users u ON u.id = ch.created_by
         WHERE ch.patient_id = ?1",
        params![patient_id],
        |row| {
            Ok(ClinicalHistory {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                chief_complaint: row.get(2)?,
                present_illness: row.get(3)?,
                medical_history: row.get(4)?,
                surgical_history: row.get(5)?,
                family_history: row.get(6)?,
                allergies: row.get(7)?,
                medications: row.get(8)?,
                clinical_exam: row.get(9)?,
                diagnosis: row.get(10)?,
                treatment_plan: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
                evolutions_count: row.get(16)?,
            })
        },
    );

    match result {
        Ok(history) => Ok(Some(history)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Error al buscar historia clínica: {}", e)),
    }
}

pub fn get_detail(conn: &Connection, history_id: i64) -> Result<ClinicalHistoryDetail, String> {
    let history = get_by_id(conn, history_id)?;
    let evolutions = get_evolutions(conn, history_id, None, None)?;
    Ok(ClinicalHistoryDetail {
        history,
        evolutions,
    })
}

// --- Evolutions ---

pub fn add_evolution(
    conn: &Connection,
    req: &AddEvolutionRequest,
    user_id: i64,
) -> Result<Evolution, String> {
    // Auto-lock evolutions older than 24 hours
    lock_expired_evolutions(conn, req.clinical_history_id)?;

    // Calculate next sequence number
    let next_seq: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM evolutions WHERE clinical_history_id = ?1",
            params![req.clinical_history_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO evolutions (clinical_history_id, appointment_id, sequence_number, subjective, objective, analysis, plan, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            req.clinical_history_id,
            req.appointment_id,
            next_seq,
            req.subjective,
            req.objective,
            req.analysis,
            req.plan,
            user_id,
        ],
    )
    .map_err(|e| format!("Error al agregar evolución: {}", e))?;

    let id = conn.last_insert_rowid();
    get_evolution_by_id(conn, id)
}

pub fn add_addendum(
    conn: &Connection,
    req: &AddAddendumRequest,
    user_id: i64,
) -> Result<Evolution, String> {
    // Verify parent evolution exists and is locked
    let parent = get_evolution_by_id(conn, req.parent_evolution_id)?;
    if !parent.is_locked {
        return Err("Solo se pueden agregar adendas a evoluciones bloqueadas.".to_string());
    }

    // Calculate next sequence number
    let next_seq: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM evolutions WHERE clinical_history_id = ?1",
            params![req.clinical_history_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO evolutions (clinical_history_id, appointment_id, sequence_number, subjective, objective, analysis, plan, is_addendum, parent_evolution_id, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)",
        params![
            req.clinical_history_id,
            parent.appointment_id,
            next_seq,
            req.subjective,
            req.objective,
            req.analysis,
            req.plan,
            req.parent_evolution_id,
            user_id,
        ],
    )
    .map_err(|e| format!("Error al agregar adenda: {}", e))?;

    let id = conn.last_insert_rowid();
    get_evolution_by_id(conn, id)
}

pub fn update_evolution(
    conn: &Connection,
    req: &UpdateEvolutionRequest,
    user_id: i64,
) -> Result<Evolution, String> {
    let current = get_evolution_by_id(conn, req.id)?;

    if current.is_locked {
        return Err("Esta evolución está bloqueada. Use adenda para agregar información.".to_string());
    }

    // Only the author can edit
    if current.created_by != user_id {
        return Err("Solo el autor puede editar esta evolución.".to_string());
    }

    let subjective = req.subjective.as_deref().unwrap_or(&current.subjective);
    let objective = req.objective.as_deref().unwrap_or(&current.objective);
    let analysis = req.analysis.as_deref().unwrap_or(&current.analysis);
    let plan = req.plan.as_deref().unwrap_or(&current.plan);

    conn.execute(
        "UPDATE evolutions SET subjective = ?1, objective = ?2, analysis = ?3, plan = ?4
         WHERE id = ?5",
        params![subjective, objective, analysis, plan, req.id],
    )
    .map_err(|e| format!("Error al actualizar evolución: {}", e))?;

    get_evolution_by_id(conn, req.id)
}

pub fn get_evolution_by_id(conn: &Connection, id: i64) -> Result<Evolution, String> {
    // First auto-lock if needed
    let _ = conn.execute(
        "UPDATE evolutions SET is_locked = 1
         WHERE id = ?1 AND is_locked = 0
         AND datetime(created_at, '+24 hours') <= datetime('now', 'localtime')",
        params![id],
    );

    conn.query_row(
        "SELECT e.id, e.clinical_history_id, e.appointment_id, e.sequence_number,
                e.subjective, e.objective, e.analysis, e.plan,
                e.is_locked, e.is_addendum, e.parent_evolution_id,
                e.created_by, u.display_name, e.created_at
         FROM evolutions e
         LEFT JOIN users u ON u.id = e.created_by
         WHERE e.id = ?1",
        params![id],
        |row| {
            Ok(Evolution {
                id: row.get(0)?,
                clinical_history_id: row.get(1)?,
                appointment_id: row.get(2)?,
                sequence_number: row.get(3)?,
                subjective: row.get(4)?,
                objective: row.get(5)?,
                analysis: row.get(6)?,
                plan: row.get(7)?,
                is_locked: row.get::<_, i32>(8)? != 0,
                is_addendum: row.get::<_, i32>(9)? != 0,
                parent_evolution_id: row.get(10)?,
                created_by: row.get(11)?,
                created_by_name: row.get(12)?,
                created_at: row.get(13)?,
            })
        },
    )
    .map_err(|_| "Evolución no encontrada.".to_string())
}

pub fn get_evolutions(
    conn: &Connection,
    clinical_history_id: i64,
    from_date: Option<&str>,
    to_date: Option<&str>,
) -> Result<Vec<Evolution>, String> {
    // Auto-lock expired evolutions first
    lock_expired_evolutions(conn, clinical_history_id)?;

    let mut query = String::from(
        "SELECT e.id, e.clinical_history_id, e.appointment_id, e.sequence_number,
                e.subjective, e.objective, e.analysis, e.plan,
                e.is_locked, e.is_addendum, e.parent_evolution_id,
                e.created_by, u.display_name, e.created_at
         FROM evolutions e
         LEFT JOIN users u ON u.id = e.created_by
         WHERE e.clinical_history_id = ?1"
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(clinical_history_id)];

    if let Some(from) = from_date {
        query.push_str(" AND date(e.created_at) >= date(?2)");
        param_values.push(Box::new(from.to_string()));
    }

    if let Some(to) = to_date {
        let idx = param_values.len() + 1;
        query.push_str(&format!(" AND date(e.created_at) <= date(?{})", idx));
        param_values.push(Box::new(to.to_string()));
    }

    query.push_str(" ORDER BY e.sequence_number DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let results = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Evolution {
                id: row.get(0)?,
                clinical_history_id: row.get(1)?,
                appointment_id: row.get(2)?,
                sequence_number: row.get(3)?,
                subjective: row.get(4)?,
                objective: row.get(5)?,
                analysis: row.get(6)?,
                plan: row.get(7)?,
                is_locked: row.get::<_, i32>(8)? != 0,
                is_addendum: row.get::<_, i32>(9)? != 0,
                parent_evolution_id: row.get(10)?,
                created_by: row.get(11)?,
                created_by_name: row.get(12)?,
                created_at: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

/// Lock all evolutions older than 24 hours for a given clinical history.
fn lock_expired_evolutions(conn: &Connection, clinical_history_id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE evolutions SET is_locked = 1
         WHERE clinical_history_id = ?1 AND is_locked = 0
         AND datetime(created_at, '+24 hours') <= datetime('now', 'localtime')",
        params![clinical_history_id],
    )
    .map_err(|e| format!("Error al bloquear evoluciones expiradas: {}", e))?;

    Ok(())
}
