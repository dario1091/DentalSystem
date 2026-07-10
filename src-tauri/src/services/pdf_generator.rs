use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;

use crate::models::patient::Patient;

/// Generate a PDF with the patient's basic info card.
/// Returns the file path of the generated PDF.
pub fn generate_patient_card(patient: &Patient, output_dir: &PathBuf) -> Result<String, String> {
    std::fs::create_dir_all(output_dir).map_err(|e| format!("Error creating dir: {}", e))?;

    let filename = format!(
        "ficha_paciente_{}_{}.pdf",
        patient.document_number,
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let filepath = output_dir.join(&filename);

    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Ficha - {} {}", patient.first_name, patient.last_name),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let mut y = 270.0;
    let left = 20.0;

    // Title
    current_layer.use_text("FICHA DEL PACIENTE", 16.0, Mm(left), Mm(y), &font_bold);
    y -= 10.0;

    // Separator line
    current_layer.use_text(
        "────────────────────────────────────────────────────",
        10.0,
        Mm(left),
        Mm(y),
        &font,
    );
    y -= 10.0;

    // Helper to write a field
    let write_field = |layer: &PdfLayerReference, label: &str, value: &str, y: &mut f32| {
        layer.use_text(
            &format!("{}: {}", label, value),
            10.0,
            Mm(left),
            Mm(*y),
            &font,
        );
        *y -= 7.0;
    };

    // Section: Datos Personales
    current_layer.use_text("DATOS PERSONALES", 12.0, Mm(left), Mm(y), &font_bold);
    y -= 8.0;

    write_field(
        &current_layer,
        "Nombre completo",
        &format!("{} {}", patient.first_name, patient.last_name),
        &mut y,
    );
    write_field(
        &current_layer,
        "Documento",
        &format!("{} {}", patient.document_type, patient.document_number),
        &mut y,
    );
    write_field(&current_layer, "Fecha de nacimiento", &patient.birth_date, &mut y);
    write_field(
        &current_layer,
        "Genero",
        match patient.gender.as_str() {
            "M" => "Masculino",
            "F" => "Femenino",
            _ => "Otro",
        },
        &mut y,
    );
    write_field(
        &current_layer,
        "Estado civil",
        patient.marital_status.as_deref().unwrap_or("—"),
        &mut y,
    );

    y -= 5.0;
    current_layer.use_text("CONTACTO", 12.0, Mm(left), Mm(y), &font_bold);
    y -= 8.0;

    write_field(&current_layer, "Telefono", &patient.phone, &mut y);
    write_field(
        &current_layer,
        "Telefono secundario",
        patient.phone_secondary.as_deref().unwrap_or("—"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Email",
        patient.email.as_deref().unwrap_or("—"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Direccion",
        patient.address.as_deref().unwrap_or("—"),
        &mut y,
    );

    y -= 5.0;
    current_layer.use_text("DATOS DE SALUD", 12.0, Mm(left), Mm(y), &font_bold);
    y -= 8.0;

    write_field(
        &current_layer,
        "EPS",
        patient.eps.as_deref().unwrap_or("Particular"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Grupo sanguineo",
        patient.blood_type.as_deref().unwrap_or("—"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Alergias",
        patient.allergies.as_deref().unwrap_or("Ninguna conocida"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Medicamentos",
        patient.current_medications.as_deref().unwrap_or("Ninguno"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Antecedentes",
        patient.medical_history.as_deref().unwrap_or("—"),
        &mut y,
    );

    y -= 5.0;
    current_layer.use_text("ACUDIENTE", 12.0, Mm(left), Mm(y), &font_bold);
    y -= 8.0;

    write_field(
        &current_layer,
        "Nombre",
        patient.guardian_name.as_deref().unwrap_or("—"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Parentesco",
        patient.guardian_relationship.as_deref().unwrap_or("—"),
        &mut y,
    );
    write_field(
        &current_layer,
        "Telefono",
        patient.guardian_phone.as_deref().unwrap_or("—"),
        &mut y,
    );

    // Footer
    y -= 10.0;
    current_layer.use_text(
        &format!(
            "Generado: {}",
            chrono::Utc::now().format("%Y-%m-%d %H:%M")
        ),
        8.0,
        Mm(left),
        Mm(y),
        &font,
    );

    // Save
    let file = File::create(&filepath).map_err(|e| format!("Error creating file: {}", e))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Error saving PDF: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}
