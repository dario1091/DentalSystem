mod commands;
mod db;
mod models;
mod services;

use db::Database;
use services::auth_service;
use services::session::SessionState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let db = Database::init(app.handle())?;

            // Ensure admin seed has a proper hash
            {
                let conn = db.conn.lock().map_err(|e| e.to_string())?;
                auth_service::ensure_admin_hash(&conn)
                    .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            }

            app.manage(db);
            app.manage(SessionState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_current_user,
            commands::auth::change_password,
            commands::auth::create_user,
            commands::auth::update_user,
            commands::auth::list_users,
            commands::auth::reset_user_password,
            commands::patients::create_patient,
            commands::patients::update_patient,
            commands::patients::get_patient,
            commands::patients::search_patients,
            commands::patients::deactivate_patient,
            commands::patients::count_patients,
            commands::patients::export_patient_pdf,
            commands::doctors::create_doctor,
            commands::doctors::update_doctor,
            commands::doctors::get_doctor,
            commands::doctors::list_doctors,
            commands::doctors::deactivate_doctor,
            commands::procedures::create_procedure,
            commands::procedures::update_procedure,
            commands::procedures::list_procedures,
            commands::procedures::search_procedures,
            commands::procedures::get_procedure,
            commands::procedures::update_procedure_price,
            commands::procedures::get_procedure_price_history,
            commands::procedures::deactivate_procedure,
            commands::appointments::create_appointment,
            commands::appointments::update_appointment,
            commands::appointments::get_appointment,
            commands::appointments::list_appointments,
            commands::appointments::change_appointment_status,
            commands::appointments::add_procedure_to_appointment,
            commands::appointments::remove_procedure_from_appointment,
            commands::appointments::get_appointment_procedures,
            commands::odontogram::create_odontogram,
            commands::odontogram::add_finding,
            commands::odontogram::remove_finding,
            commands::odontogram::get_odontograms_by_patient,
            commands::odontogram::get_odontogram_detail,
            commands::clinical_history::create_clinical_history,
            commands::clinical_history::update_clinical_history,
            commands::clinical_history::get_clinical_history,
            commands::clinical_history::add_evolution,
            commands::clinical_history::add_addendum,
            commands::clinical_history::update_evolution,
            commands::clinical_history::get_evolutions,
            commands::documents::upload_document,
            commands::documents::list_documents,
            commands::documents::get_document_data,
            commands::documents::delete_document,
            commands::documents::set_documents_path,
            commands::documents::get_documents_path,
            commands::documents::get_disk_space,
            commands::consents::create_consent,
            commands::consents::list_consents,
            commands::consents::update_consent_status,
            commands::consents::save_consent_signature,
            commands::consents::generate_whatsapp_link,
            commands::consents::get_consent_templates,
            commands::consents::get_consent_pdf_data,
            commands::consents::export_consent_pdf,
            commands::consents::list_consent_templates_full,
            commands::consents::update_consent_template,
            commands::billing::create_invoice,
            commands::billing::get_invoice,
            commands::billing::list_invoices_by_patient,
            commands::billing::add_payment,
            commands::billing::get_patient_balance,
            commands::billing::get_revenue_report,
            commands::billing::export_invoice_pdf,
            commands::backup::create_backup,
            commands::backup::restore_backup,
            commands::backup::list_backups,
            commands::backup::get_last_backup_date,
            commands::backup::get_settings,
            commands::backup::update_settings,
            commands::backup::save_clinic_logo,
            commands::backup::initial_setup,
            commands::backup::is_setup_completed,
            commands::trial::check_trial,
            commands::trial::activate_license,
            commands::trial::is_licensed,
            commands::trial::dev_generate_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
