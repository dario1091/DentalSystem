use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;

use crate::models::patient::Patient;

/// Generate the patient info card PDF using the shared branded template.
/// Returns the file path of the generated PDF.
pub fn generate_patient_card(
    patient: &Patient,
    clinic: &ClinicInfo,
    logo_path: Option<&str>,
    output_dir: &PathBuf,
) -> Result<String, String> {
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
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let left = 15.0;
    let ink = (0.20, 0.23, 0.26);
    let muted = (0.45, 0.48, 0.52);

    // ---- Header: logo + clinic ----
    let mut header_text_x = left;
    if let Some(logo) = logo_path {
        if let Ok((rgb_data, w, h)) = load_image_rgb(logo) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_data,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let natural_h_mm = h as f32 * px_to_mm;
                let scale = (32.0 / natural_h_mm).min(55.0 / natural_w_mm);
                let logo_w_mm = natural_w_mm * scale;
                let logo_h_mm = natural_h_mm * scale;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(293.0 - logo_h_mm)),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                header_text_x = left + logo_w_mm + 7.0;
            }
        }
    }

    layer.set_fill_color(rgb(BRAND));
    layer.use_text(&clinic.name, 16.0, Mm(header_text_x), Mm(280.0), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut sub = Vec::new();
    if !clinic.nit.is_empty() {
        sub.push(format!("NIT: {}", clinic.nit));
    }
    if !clinic.address.is_empty() {
        sub.push(clinic.address.clone());
    }
    if !clinic.phone.is_empty() {
        sub.push(format!("Tel: {}", clinic.phone));
    }
    if !sub.is_empty() {
        layer.use_text(sub.join("   ·   "), 8.5, Mm(header_text_x), Mm(274.0), &font);
    }

    hline(&layer, left, 210.0 - left, 258.0, 0.6, BRAND);

    // ---- Title ----
    let mut y = 250.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text("Ficha del Paciente", 17.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    layer.use_text(
        &format!("Generada: {}", chrono::Local::now().format("%Y-%m-%d %H:%M")),
        8.5,
        Mm(150.0),
        Mm(y),
        &font,
    );
    y -= 12.0;

    // ---- Helpers ----
    let gender = match patient.gender.as_str() {
        "M" => "Masculino",
        "F" => "Femenino",
        _ => "Otro",
    };

    // Two-column field writer within a section.
    let col2_x = 108.0;

    let section = |layer: &PdfLayerReference, title: &str, y: &mut f32| {
        layer.set_fill_color(rgb(muted));
        layer.use_text(title, 8.5, Mm(left), Mm(*y), &font_bold);
        *y -= 2.5;
        hline(layer, left, 210.0 - left * 2.0, *y, 0.3, (0.82, 0.85, 0.88));
        *y -= 6.0;
    };
    let field = |layer: &PdfLayerReference, x: f32, label: &str, value: &str, y: f32| {
        layer.set_fill_color(rgb(muted));
        layer.use_text(label, 7.5, Mm(x), Mm(y), &font);
        layer.set_fill_color(rgb(ink));
        let v = if value.len() > 46 { &value[..46] } else { value };
        layer.use_text(v, 9.5, Mm(x), Mm(y - 4.5), &font);
    };

    // ---- Datos personales ----
    section(&layer, "DATOS PERSONALES", &mut y);
    field(&layer, left, "Nombre completo", &format!("{} {}", patient.first_name, patient.last_name), y);
    field(&layer, col2_x, "Documento", &format!("{} {}", patient.document_type, patient.document_number), y);
    y -= 12.0;
    field(&layer, left, "Fecha de nacimiento", &patient.birth_date, y);
    field(&layer, col2_x, "Genero", gender, y);
    y -= 12.0;
    field(&layer, left, "Estado civil", patient.marital_status.as_deref().unwrap_or("-"), y);
    y -= 12.0;

    // ---- Contacto ----
    section(&layer, "CONTACTO", &mut y);
    field(&layer, left, "Telefono", &patient.phone, y);
    field(&layer, col2_x, "Telefono secundario", patient.phone_secondary.as_deref().unwrap_or("-"), y);
    y -= 12.0;
    field(&layer, left, "Email", patient.email.as_deref().unwrap_or("-"), y);
    field(&layer, col2_x, "Direccion", patient.address.as_deref().unwrap_or("-"), y);
    y -= 12.0;

    // ---- Datos de salud ----
    section(&layer, "DATOS DE SALUD", &mut y);
    field(&layer, left, "EPS", patient.eps.as_deref().unwrap_or("Particular"), y);
    field(&layer, col2_x, "Grupo sanguineo", patient.blood_type.as_deref().unwrap_or("-"), y);
    y -= 12.0;
    field(&layer, left, "Alergias", patient.allergies.as_deref().unwrap_or("Ninguna conocida"), y);
    field(&layer, col2_x, "Medicamentos", patient.current_medications.as_deref().unwrap_or("Ninguno"), y);
    y -= 12.0;
    field(&layer, left, "Antecedentes", patient.medical_history.as_deref().unwrap_or("-"), y);
    y -= 12.0;

    // ---- Acudiente ----
    section(&layer, "ACUDIENTE", &mut y);
    field(&layer, left, "Nombre", patient.guardian_name.as_deref().unwrap_or("-"), y);
    field(&layer, col2_x, "Parentesco", patient.guardian_relationship.as_deref().unwrap_or("-"), y);
    y -= 12.0;
    field(&layer, left, "Telefono", patient.guardian_phone.as_deref().unwrap_or("-"), y);

    // ---- Footer ----
    hline(&layer, left, 210.0 - left * 2.0, 12.0, 0.3, (0.82, 0.85, 0.88));
    layer.set_fill_color(rgb(muted));
    layer.use_text("Documento confidencial de uso clinico.", 7.5, Mm(left), Mm(7.5), &font);

    let file = File::create(&filepath).map_err(|e| format!("Error creating file: {}", e))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Error saving PDF: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

// ===========================================================================
// Quote (cotización) PDF
// ===========================================================================

/// Clinic header info (read from settings by the caller).
pub struct ClinicInfo {
    pub name: String,
    pub nit: String,
    pub address: String,
    pub phone: String,
}

/// A single line of a quote for the PDF.
pub struct QuotePdfItem {
    pub description: String,
    pub tooth_number: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
    pub discount: f64,
    pub total: f64,
}

/// All data needed to render a treatment-plan PDF.
pub struct QuotePdfData {
    pub quote_number: String,
    pub created_at: String,
    pub valid_until: Option<String>,
    pub patient_name: String,
    pub patient_doc: String,
    pub patient_phone: String,
    pub items: Vec<QuotePdfItem>,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub notes: Option<String>,
    /// Optional odontogram image (PNG bytes) to embed.
    pub odontogram_png: Option<Vec<u8>>,
    /// Optional clinic logo file path (PNG or JPG) to render in the header.
    pub logo_path: Option<String>,
}

// Brand color (a calm teal/blue) used for header bands and accents.
const BRAND: (f32, f32, f32) = (0.16, 0.44, 0.55);
const BRAND_LIGHT: (f32, f32, f32) = (0.90, 0.95, 0.97);

fn rgb(c: (f32, f32, f32)) -> Color {
    Color::Rgb(Rgb::new(c.0, c.1, c.2, None))
}

/// Draw a filled rectangle (x, y are bottom-left in mm).
/// In printpdf 0.7 a closed `Line` is filled using the current fill color.
fn fill_rect(layer: &PdfLayerReference, x: f32, y: f32, w: f32, h: f32, color: (f32, f32, f32)) {
    layer.set_fill_color(rgb(color));
    // Match outline to fill so any stroke is invisible (avoids a hard border).
    layer.set_outline_color(rgb(color));
    layer.set_outline_thickness(0.0);
    let rect = Line {
        points: vec![
            (Point::new(Mm(x), Mm(y)), false),
            (Point::new(Mm(x + w), Mm(y)), false),
            (Point::new(Mm(x + w), Mm(y + h)), false),
            (Point::new(Mm(x), Mm(y + h)), false),
        ],
        is_closed: true,
    };
    layer.add_line(rect);
}

/// Draw a thin horizontal line at height `y` (mm), from `x` for `w` mm.
fn hline(layer: &PdfLayerReference, x: f32, w: f32, y: f32, thickness: f32, color: (f32, f32, f32)) {
    layer.set_outline_color(rgb(color));
    layer.set_outline_thickness(thickness);
    let line = Line {
        points: vec![
            (Point::new(Mm(x), Mm(y)), false),
            (Point::new(Mm(x + w), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(line);
}

/// Load a clinic logo (PNG or JPG) from disk into RGB pixels for printpdf.
fn load_image_rgb(path: &str) -> Result<(Vec<u8>, u32, u32), String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Error al leer logo: {}", e))?;
    let img = ::image::load_from_memory(&bytes)
        .map_err(|e| format!("Error al abrir imagen: {}", e))?;
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    Ok((rgb.into_raw(), w, h))
}

/// Generate a treatment-plan PDF and return its file path.
pub fn generate_quote_pdf(
    clinic: &ClinicInfo,
    data: &QuotePdfData,
    output_dir: &PathBuf,
) -> Result<String, String> {
    std::fs::create_dir_all(output_dir).map_err(|e| format!("Error creating dir: {}", e))?;

    let filename = format!("plan_tratamiento_{}.pdf", data.quote_number);
    let filepath = output_dir.join(&filename);

    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Plan de Tratamiento {}", data.quote_number),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let left = 15.0;
    let lh = 6.0;

    // Reusable text colors.
    let ink = (0.20, 0.23, 0.26); // soft near-black
    let muted = (0.45, 0.48, 0.52);

    // ---- Header: logo + clinic (no heavy band, just a thin accent rule) ----
    let mut header_text_x = left;
    if let Some(logo) = &data.logo_path {
        if let Ok((rgb_data, w, h)) = load_image_rgb(logo) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_data,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let natural_h_mm = h as f32 * px_to_mm;

                // Fit the logo within a box up to 32mm tall and 55mm wide,
                // preserving aspect ratio (so wide logos don't overflow).
                let max_h_mm = 32.0_f32;
                let max_w_mm = 55.0_f32;
                let scale = (max_h_mm / natural_h_mm).min(max_w_mm / natural_w_mm);
                let logo_w_mm = natural_w_mm * scale;
                let logo_h_mm = natural_h_mm * scale;

                // Sit the logo in the top margin; its top aligns near 293mm.
                let logo_top = 293.0_f32;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(logo_top - logo_h_mm)),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        // Pin dpi to 96 so our mm-based scale math is exact
                        // (printpdf defaults to 300dpi, which shrinks images).
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                header_text_x = left + logo_w_mm + 7.0;
            }
        }
    }

    // Clinic name and contact (dark text, no band), vertically centered
    // against the logo height.
    layer.set_fill_color(rgb(BRAND));
    layer.use_text(&clinic.name, 16.0, Mm(header_text_x), Mm(280.0), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut sub = Vec::new();
    if !clinic.nit.is_empty() {
        sub.push(format!("NIT: {}", clinic.nit));
    }
    if !clinic.address.is_empty() {
        sub.push(clinic.address.clone());
    }
    if !clinic.phone.is_empty() {
        sub.push(format!("Tel: {}", clinic.phone));
    }
    if !sub.is_empty() {
        layer.use_text(sub.join("   ·   "), 8.5, Mm(header_text_x), Mm(274.0), &font);
    }

    // Thin accent rule under the header (below the taller logo).
    hline(&layer, left, 210.0 - left, 258.0, 0.6, BRAND);

    // ---- Title + number/date ----
    let mut y = 250.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text("Plan de Tratamiento", 17.0, Mm(left), Mm(y), &font_bold);
    let date_short = if data.created_at.len() >= 10 { &data.created_at[..10] } else { &data.created_at };
    layer.set_fill_color(rgb(muted));
    layer.use_text(&format!("No. {}", data.quote_number), 9.5, Mm(160.0), Mm(y + 2.0), &font_bold);
    layer.use_text(&format!("Fecha: {}", date_short), 8.5, Mm(160.0), Mm(y - 2.5), &font);
    y -= 12.0;

    // ---- Patient block (label + name, light divider — no filled box) ----
    layer.set_fill_color(rgb(muted));
    layer.use_text("PACIENTE", 8.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.patient_name, 13.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut pinfo = format!("Documento: {}", data.patient_doc);
    if !data.patient_phone.is_empty() {
        pinfo.push_str(&format!("     Tel: {}", data.patient_phone));
    }
    if let Some(vu) = &data.valid_until {
        let vu_short = if vu.len() >= 10 { &vu[..10] } else { vu };
        pinfo.push_str(&format!("     Válido hasta: {}", vu_short));
    }
    layer.use_text(&pinfo, 8.5, Mm(left), Mm(y - 5.0), &font);
    y -= 10.0;
    hline(&layer, left, 210.0 - left, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    // ---- Optional odontogram image ----
    if let Some(png) = &data.odontogram_png {
        if let Ok((rgb_img, w, h)) = decode_png_for_pdf(png) {
            layer.set_fill_color(rgb(muted));
            layer.use_text("ODONTOGRAMA", 8.0, Mm(left), Mm(y), &font_bold);
            layer.set_fill_color(rgb(ink));
            y -= 4.0;
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_img,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let target_width_mm = 185.0_f32;
                let px_to_mm_96 = 0.264583_f32;
                let natural_width_mm = w as f32 * px_to_mm_96;
                let scale = target_width_mm / natural_width_mm;
                let img_height_mm = (h as f32 * px_to_mm_96) * scale;
                let translate_y = y - img_height_mm;
                let x_centered = (210.0 - target_width_mm) / 2.0;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(x_centered)),
                        translate_y: Some(Mm(translate_y.max(48.0))),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                y = translate_y.max(48.0) - 8.0;
            }
        }
    }

    // ---- Items table ----
    if y < 70.0 {
        y = 70.0;
    }
    // Column x positions.
    let col_proc = left;
    let col_tooth = 108.0;
    let col_qty = 130.0;
    let col_price = 148.0;
    let col_total = 178.0;

    // Header: subtle light background + thin rule (no heavy fill).
    fill_rect(&layer, left, y - 2.5, 210.0 - left * 2.0, 7.5, BRAND_LIGHT);
    layer.set_fill_color(rgb(BRAND));
    layer.use_text("PROCEDIMIENTO", 8.0, Mm(col_proc + 1.0), Mm(y), &font_bold);
    layer.use_text("DIENTE", 8.0, Mm(col_tooth), Mm(y), &font_bold);
    layer.use_text("CANT.", 8.0, Mm(col_qty), Mm(y), &font_bold);
    layer.use_text("PRECIO", 8.0, Mm(col_price), Mm(y), &font_bold);
    layer.use_text("TOTAL", 8.0, Mm(col_total), Mm(y), &font_bold);
    y -= 9.0;

    let mut zebra = false;
    for item in &data.items {
        if y < 45.0 {
            break;
        }
        if zebra {
            fill_rect(&layer, left, y - 1.8, 210.0 - left * 2.0, 6.5, (0.965, 0.975, 0.985));
        }
        zebra = !zebra;

        let desc = if item.description.len() > 50 {
            &item.description[..50]
        } else {
            &item.description
        };
        layer.set_fill_color(rgb(ink));
        layer.use_text(desc, 9.0, Mm(col_proc + 1.0), Mm(y), &font);
        layer.set_fill_color(rgb(muted));
        layer.use_text(item.tooth_number.as_deref().unwrap_or("-"), 9.0, Mm(col_tooth), Mm(y), &font);
        layer.use_text(&item.quantity.to_string(), 9.0, Mm(col_qty + 1.0), Mm(y), &font);
        layer.use_text(&format!("${:.0}", item.unit_price), 9.0, Mm(col_price), Mm(y), &font);
        layer.set_fill_color(rgb(ink));
        layer.use_text(&format!("${:.0}", item.total), 9.0, Mm(col_total), Mm(y), &font_bold);
        y -= 6.5;
    }

    // Closing rule under the table.
    y -= 1.0;
    hline(&layer, left, 210.0 - left * 2.0, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    // ---- Totals (right aligned, light band only behind TOTAL) ----
    let tx_label = 138.0;
    let tx_val = 178.0;
    layer.set_fill_color(rgb(muted));
    layer.use_text("Subtotal", 9.5, Mm(tx_label), Mm(y), &font);
    layer.set_fill_color(rgb(ink));
    layer.use_text(&format!("${:.0}", data.subtotal), 9.5, Mm(tx_val), Mm(y), &font);
    y -= lh;
    if data.discount > 0.0 {
        layer.set_fill_color(rgb(muted));
        layer.use_text("Descuento", 9.5, Mm(tx_label), Mm(y), &font);
        layer.set_fill_color(rgb(ink));
        layer.use_text(&format!("-${:.0}", data.discount), 9.5, Mm(tx_val), Mm(y), &font);
        y -= lh;
    }
    // TOTAL row with a soft highlight band.
    fill_rect(&layer, tx_label - 3.0, y - 2.5, 210.0 - (tx_label - 3.0) - left, 8.5, BRAND_LIGHT);
    layer.set_fill_color(rgb(BRAND));
    layer.use_text("TOTAL", 11.0, Mm(tx_label), Mm(y), &font_bold);
    layer.use_text(&format!("${:.0}", data.total), 11.0, Mm(tx_val), Mm(y), &font_bold);
    layer.set_fill_color(rgb(ink));
    y -= 14.0;

    // ---- Notes ----
    if let Some(notes) = &data.notes {
        if !notes.is_empty() && y > 30.0 {
            layer.set_fill_color(rgb(muted));
            layer.use_text("OBSERVACIONES", 8.0, Mm(left), Mm(y), &font_bold);
            layer.set_fill_color(rgb(ink));
            y -= lh;
            for line in notes.lines() {
                if y < 22.0 {
                    break;
                }
                let l = if line.len() > 100 { &line[..100] } else { line };
                layer.use_text(l, 8.5, Mm(left), Mm(y), &font);
                y -= 5.0;
            }
        }
    }

    // ---- Footer (thin rule + muted text, no heavy band) ----
    hline(&layer, left, 210.0 - left * 2.0, 12.0, 0.3, (0.82, 0.85, 0.88));
    layer.set_fill_color(rgb(muted));
    layer.use_text(
        "Plan de tratamiento informativo. Los precios pueden variar segun valoracion clinica.",
        7.5,
        Mm(left),
        Mm(7.5),
        &font,
    );

    let file = File::create(&filepath).map_err(|e| format!("Error creating file: {}", e))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Error saving PDF: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

// ===========================================================================
// Consent (consentimiento informado) PDF — shared branded template
// ===========================================================================

pub struct ConsentPdfData {
    pub title: String,
    pub content: String,
    pub patient_name: String,
    pub patient_doc: String,
    pub patient_phone: String,
    pub procedure_name: String,
    pub date: String,
    /// Optional signature image (PNG bytes). When present it is embedded in the
    /// signature area; otherwise a blank signature line is drawn.
    pub signature_png: Option<Vec<u8>>,
    pub logo_path: Option<String>,
}

/// Generate a consent PDF at the exact `dest_path` provided by the caller.
pub fn generate_consent_pdf(
    clinic: &ClinicInfo,
    data: &ConsentPdfData,
    dest_path: &std::path::Path,
) -> Result<(), String> {
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Error creating dir: {}", e))?;
    }

    let (doc, page1, layer1) = PdfDocument::new(&data.title, Mm(210.0), Mm(297.0), "Layer 1");
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let left = 15.0;
    let ink = (0.20, 0.23, 0.26);
    let muted = (0.45, 0.48, 0.52);

    // ---- Header: logo + clinic ----
    let mut header_text_x = left;
    if let Some(logo) = &data.logo_path {
        if let Ok((rgb_data, w, h)) = load_image_rgb(logo) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_data,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let natural_h_mm = h as f32 * px_to_mm;
                let scale = (32.0 / natural_h_mm).min(55.0 / natural_w_mm);
                let logo_w_mm = natural_w_mm * scale;
                let logo_h_mm = natural_h_mm * scale;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(293.0 - logo_h_mm)),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                header_text_x = left + logo_w_mm + 7.0;
            }
        }
    }

    layer.set_fill_color(rgb(BRAND));
    layer.use_text(&clinic.name, 16.0, Mm(header_text_x), Mm(280.0), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut sub = Vec::new();
    if !clinic.nit.is_empty() {
        sub.push(format!("NIT: {}", clinic.nit));
    }
    if !clinic.address.is_empty() {
        sub.push(clinic.address.clone());
    }
    if !clinic.phone.is_empty() {
        sub.push(format!("Tel: {}", clinic.phone));
    }
    if !sub.is_empty() {
        layer.use_text(sub.join("   ·   "), 8.5, Mm(header_text_x), Mm(274.0), &font);
    }

    hline(&layer, left, 210.0 - left, 258.0, 0.6, BRAND);

    // ---- Title ----
    let mut y = 250.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.title, 15.0, Mm(left), Mm(y), &font_bold);
    y -= 11.0;

    // ---- Patient block ----
    layer.set_fill_color(rgb(muted));
    layer.use_text("PACIENTE", 8.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.patient_name, 12.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut pinfo = format!("Documento: {}", data.patient_doc);
    if !data.patient_phone.is_empty() {
        pinfo.push_str(&format!("     Tel: {}", data.patient_phone));
    }
    layer.use_text(&pinfo, 8.5, Mm(left), Mm(y - 5.0), &font);
    layer.use_text(
        &format!("Procedimiento: {}     Fecha: {}", data.procedure_name, data.date),
        8.5,
        Mm(left),
        Mm(y - 10.0),
        &font,
    );
    y -= 16.0;
    hline(&layer, left, 210.0 - left * 2.0, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    // ---- Body text (word-wrapped, paginated) ----
    layer.set_fill_color(rgb(ink));
    let max_chars = 110usize;
    for raw_line in data.content.lines() {
        for chunk in wrap_text(raw_line, max_chars) {
            if y < 60.0 {
                break;
            }
            layer.use_text(&chunk, 9.5, Mm(left), Mm(y), &font);
            y -= 5.2;
        }
    }

    // ---- Signature area ----
    if y < 60.0 {
        y = 60.0;
    }
    y -= 6.0;
    hline(&layer, left, 210.0 - left * 2.0, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    if let Some(sig) = &data.signature_png {
        if let Ok((rgb_img, w, h)) = decode_png_for_pdf(sig) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_img,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let target_w_mm = 60.0_f32;
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let scale = target_w_mm / natural_w_mm;
                let sig_h_mm = (h as f32 * px_to_mm) * scale;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm((y - sig_h_mm).max(24.0))),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                y = (y - sig_h_mm).max(24.0) - 3.0;
            }
        }
        hline(&layer, left, 60.0, y, 0.4, ink);
        y -= 4.5;
        layer.set_fill_color(rgb(muted));
        layer.use_text("Firma del paciente", 8.0, Mm(left), Mm(y), &font);
    } else {
        y -= 12.0;
        hline(&layer, left, 70.0, y, 0.4, ink);
        y -= 4.5;
        layer.set_fill_color(rgb(muted));
        layer.use_text("Firma del paciente", 8.0, Mm(left), Mm(y), &font);
    }
    y -= 7.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.patient_name, 9.5, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    layer.use_text(
        &format!("Documento: {}     Fecha: {}", data.patient_doc, data.date),
        8.5,
        Mm(left),
        Mm(y - 5.0),
        &font,
    );

    // ---- Footer ----
    hline(&layer, left, 210.0 - left * 2.0, 12.0, 0.3, (0.82, 0.85, 0.88));
    layer.set_fill_color(rgb(muted));
    layer.use_text("Consentimiento informado.", 7.5, Mm(left), Mm(7.5), &font);

    let bytes = doc
        .save_to_bytes()
        .map_err(|e| format!("Error al generar PDF: {}", e))?;
    std::fs::write(dest_path, &bytes).map_err(|e| format!("Error al guardar PDF: {}", e))?;
    Ok(())
}

/// Naive word-wrap: split a line into chunks of at most `max` chars, breaking
/// on spaces where possible.
fn wrap_text(line: &str, max: usize) -> Vec<String> {
    if line.trim().is_empty() {
        return vec![String::new()];
    }
    let mut out = Vec::new();
    let mut current = String::new();
    for word in line.split_whitespace() {
        if current.is_empty() {
            current = word.to_string();
        } else if current.len() + 1 + word.len() <= max {
            current.push(' ');
            current.push_str(word);
        } else {
            out.push(std::mem::take(&mut current));
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

// ===========================================================================
// Clinical history PDF — shared branded template (multi-page)
// ===========================================================================

pub struct EvolutionPdfEntry {
    pub sequence_number: i64,
    pub date: String,
    pub is_addendum: bool,
    pub subjective: String,
    pub objective: String,
    pub analysis: String,
    pub plan: String,
    pub author: String,
}

pub struct ClinicalHistoryPdfData {
    pub patient_name: String,
    pub patient_doc: String,
    pub created_at: String,
    pub chief_complaint: String,
    pub present_illness: Option<String>,
    pub medical_history: Option<String>,
    pub surgical_history: Option<String>,
    pub family_history: Option<String>,
    pub allergies: Option<String>,
    pub medications: Option<String>,
    pub clinical_exam: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub evolutions: Vec<EvolutionPdfEntry>,
    pub logo_path: Option<String>,
}

/// Draw the branded header on a page layer. Returns the y cursor after it.
fn draw_branded_header(
    layer: &PdfLayerReference,
    clinic: &ClinicInfo,
    logo_path: Option<&str>,
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
) -> f32 {
    let left = 15.0;
    let muted = (0.45, 0.48, 0.52);

    let mut header_text_x = left;
    if let Some(logo) = logo_path {
        if let Ok((rgb_data, w, h)) = load_image_rgb(logo) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_data,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let natural_h_mm = h as f32 * px_to_mm;
                let scale = (28.0 / natural_h_mm).min(50.0 / natural_w_mm);
                let logo_w_mm = natural_w_mm * scale;
                let logo_h_mm = natural_h_mm * scale;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(291.0 - logo_h_mm)),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                header_text_x = left + logo_w_mm + 6.0;
            }
        }
    }

    layer.set_fill_color(rgb(BRAND));
    layer.use_text(&clinic.name, 15.0, Mm(header_text_x), Mm(282.0), font_bold);
    layer.set_fill_color(rgb(muted));
    let mut sub = Vec::new();
    if !clinic.nit.is_empty() {
        sub.push(format!("NIT: {}", clinic.nit));
    }
    if !clinic.phone.is_empty() {
        sub.push(format!("Tel: {}", clinic.phone));
    }
    if !sub.is_empty() {
        layer.use_text(sub.join("   ·   "), 8.0, Mm(header_text_x), Mm(277.0), font);
    }
    hline(layer, left, 210.0 - left, 262.0, 0.6, BRAND);
    layer.set_fill_color(rgb((0.20, 0.23, 0.26)));
    258.0
}

/// Generate a clinical-history PDF (multi-page) and return its file path.
pub fn generate_clinical_history_pdf(
    clinic: &ClinicInfo,
    data: &ClinicalHistoryPdfData,
    output_dir: &PathBuf,
) -> Result<String, String> {
    std::fs::create_dir_all(output_dir).map_err(|e| format!("Error creating dir: {}", e))?;

    let safe_name: String = data
        .patient_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    let filename = format!(
        "historia_clinica_{}_{}.pdf",
        safe_name,
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let filepath = output_dir.join(&filename);

    let (doc, page1, layer1) =
        PdfDocument::new("Historia Clínica", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let left = 15.0;
    let ink = (0.20, 0.23, 0.26);
    let muted = (0.45, 0.48, 0.52);
    let content_w = 210.0 - left * 2.0;
    let max_chars = 108usize;

    let mut layer = doc.get_page(page1).get_layer(layer1);
    let mut y = draw_branded_header(&layer, clinic, data.logo_path.as_deref(), &font, &font_bold);

    // Give the title some breathing room below the header divider.
    y -= 8.0;

    // Title + patient (only on first page).
    layer.set_fill_color(rgb(ink));
    layer.use_text("Historia Clínica", 17.0, Mm(left), Mm(y), &font_bold);
    y -= 10.0;
    layer.set_fill_color(rgb(muted));
    layer.use_text("PACIENTE", 8.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.patient_name, 12.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    let created = data.created_at.chars().take(10).collect::<String>();
    layer.use_text(
        &format!("Documento: {}     Creada: {}", data.patient_doc, created),
        8.5,
        Mm(left),
        Mm(y - 5.0),
        &font,
    );
    y -= 12.0;

    // Helper closure state is emulated with a small struct via macro-free approach:
    // we thread `y` and `layer` through explicit calls below.

    // Ensure there is room; otherwise start a new page.
    macro_rules! ensure_room {
        ($needed:expr) => {
            if y - ($needed) < 18.0 {
                let (p, l) = doc.add_page(Mm(210.0), Mm(297.0), "Layer");
                layer = doc.get_page(p).get_layer(l);
                y = draw_branded_header(&layer, clinic, data.logo_path.as_deref(), &font, &font_bold);
            }
        };
    }

    // Draw a "Label: value" field with wrapping. Skips empty values.
    macro_rules! field {
        ($label:expr, $value:expr) => {
            if let Some(val) = $value {
                let v = val.trim();
                if !v.is_empty() {
                    ensure_room!(10.0);
                    layer.set_fill_color(rgb(muted));
                    layer.use_text($label, 8.0, Mm(left), Mm(y), &font_bold);
                    y -= 4.5;
                    layer.set_fill_color(rgb(ink));
                    for line in v.lines() {
                        for chunk in wrap_text(line, max_chars) {
                            ensure_room!(5.0);
                            layer.use_text(&chunk, 9.0, Mm(left), Mm(y), &font);
                            y -= 5.0;
                        }
                    }
                    y -= 2.5;
                }
            }
        };
    }

    // ---- Section: Anamnesis ----
    layer.set_fill_color(rgb(BRAND));
    layer.use_text("ANAMNESIS", 9.0, Mm(left), Mm(y), &font_bold);
    y -= 2.5;
    hline(&layer, left, content_w, y, 0.3, (0.82, 0.85, 0.88));
    y -= 6.0;
    layer.set_fill_color(rgb(ink));

    field!("Motivo de consulta", Some(&data.chief_complaint));
    field!("Enfermedad actual", data.present_illness.as_deref());
    field!("Antecedentes médicos", data.medical_history.as_deref());
    field!("Antecedentes quirúrgicos", data.surgical_history.as_deref());
    field!("Antecedentes familiares", data.family_history.as_deref());
    field!("Alergias", data.allergies.as_deref());
    field!("Medicamentos", data.medications.as_deref());

    // ---- Section: Examen y diagnóstico ----
    ensure_room!(14.0);
    y -= 2.0;
    layer.set_fill_color(rgb(BRAND));
    layer.use_text("EXAMEN Y DIAGNÓSTICO", 9.0, Mm(left), Mm(y), &font_bold);
    y -= 2.5;
    hline(&layer, left, content_w, y, 0.3, (0.82, 0.85, 0.88));
    y -= 6.0;
    layer.set_fill_color(rgb(ink));

    field!("Examen clínico", data.clinical_exam.as_deref());
    field!("Diagnóstico", data.diagnosis.as_deref());
    field!("Plan de tratamiento", data.treatment_plan.as_deref());

    // ---- Section: Evoluciones (SOAP) ----
    if !data.evolutions.is_empty() {
        ensure_room!(16.0);
        y -= 2.0;
        layer.set_fill_color(rgb(BRAND));
        layer.use_text("EVOLUCIONES", 9.0, Mm(left), Mm(y), &font_bold);
        y -= 2.5;
        hline(&layer, left, content_w, y, 0.3, (0.82, 0.85, 0.88));
        y -= 6.0;

        for ev in &data.evolutions {
            ensure_room!(12.0);
            // Evolution header line.
            let kind = if ev.is_addendum { "Adenda" } else { "Evolución" };
            layer.set_fill_color(rgb(BRAND));
            layer.use_text(
                &format!("{} #{}", kind, ev.sequence_number),
                9.5,
                Mm(left),
                Mm(y),
                &font_bold,
            );
            layer.set_fill_color(rgb(muted));
            let date = ev.date.chars().take(10).collect::<String>();
            let by = if ev.author.is_empty() { String::new() } else { format!("  ·  {}", ev.author) };
            layer.use_text(&format!("{}{}", date, by), 8.0, Mm(120.0), Mm(y), &font);
            y -= 5.5;

            // SOAP lines.
            let soap = [
                ("S (Subjetivo)", &ev.subjective),
                ("O (Objetivo)", &ev.objective),
                ("A (Análisis)", &ev.analysis),
                ("P (Plan)", &ev.plan),
            ];
            for (label, value) in soap {
                let v = value.trim();
                if v.is_empty() {
                    continue;
                }
                ensure_room!(6.0);
                layer.set_fill_color(rgb(muted));
                layer.use_text(label, 7.5, Mm(left + 2.0), Mm(y), &font_bold);
                y -= 4.2;
                layer.set_fill_color(rgb(ink));
                for line in v.lines() {
                    for chunk in wrap_text(line, max_chars - 2) {
                        ensure_room!(4.8);
                        layer.use_text(&chunk, 8.5, Mm(left + 4.0), Mm(y), &font);
                        y -= 4.6;
                    }
                }
                y -= 1.0;
            }
            y -= 2.0;
            hline(&layer, left, content_w, y, 0.2, (0.88, 0.90, 0.92));
            y -= 5.0;
        }
    }

    // Footer on the last page.
    hline(&layer, left, content_w, 12.0, 0.3, (0.82, 0.85, 0.88));
    layer.set_fill_color(rgb(muted));
    layer.use_text("Documento clinico confidencial.", 7.5, Mm(left), Mm(7.5), &font);

    let file = File::create(&filepath).map_err(|e| format!("Error creating file: {}", e))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Error saving PDF: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

// ===========================================================================
// Odontogram PDF — shared branded template
// ===========================================================================

pub struct OdontogramFindingLine {
    pub tooth: String,
    pub face: String,
    pub label: String,
}

pub struct OdontogramPdfData {
    pub patient_name: String,
    pub patient_doc: String,
    pub kind: String, // "Inicial" | "Evolución"
    pub date: String,
    pub odontogram_png: Vec<u8>,
    pub findings: Vec<OdontogramFindingLine>,
    pub logo_path: Option<String>,
}

/// Generate an odontogram PDF and return its file path.
pub fn generate_odontogram_pdf(
    clinic: &ClinicInfo,
    data: &OdontogramPdfData,
    output_dir: &PathBuf,
) -> Result<String, String> {
    std::fs::create_dir_all(output_dir).map_err(|e| format!("Error creating dir: {}", e))?;

    let safe_name: String = data
        .patient_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    let filename = format!(
        "odontograma_{}_{}.pdf",
        safe_name,
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let filepath = output_dir.join(&filename);

    let (doc, page1, layer1) =
        PdfDocument::new("Odontograma", Mm(210.0), Mm(297.0), "Layer 1");
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let left = 15.0;
    let ink = (0.20, 0.23, 0.26);
    let muted = (0.45, 0.48, 0.52);

    // ---- Header: logo + clinic ----
    let mut header_text_x = left;
    if let Some(logo) = &data.logo_path {
        if let Ok((rgb_data, w, h)) = load_image_rgb(logo) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_data,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let natural_h_mm = h as f32 * px_to_mm;
                let scale = (32.0 / natural_h_mm).min(55.0 / natural_w_mm);
                let logo_w_mm = natural_w_mm * scale;
                let logo_h_mm = natural_h_mm * scale;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(293.0 - logo_h_mm)),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                header_text_x = left + logo_w_mm + 7.0;
            }
        }
    }

    layer.set_fill_color(rgb(BRAND));
    layer.use_text(&clinic.name, 16.0, Mm(header_text_x), Mm(280.0), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut sub = Vec::new();
    if !clinic.nit.is_empty() {
        sub.push(format!("NIT: {}", clinic.nit));
    }
    if !clinic.address.is_empty() {
        sub.push(clinic.address.clone());
    }
    if !clinic.phone.is_empty() {
        sub.push(format!("Tel: {}", clinic.phone));
    }
    if !sub.is_empty() {
        layer.use_text(sub.join("   ·   "), 8.5, Mm(header_text_x), Mm(274.0), &font);
    }

    hline(&layer, left, 210.0 - left, 258.0, 0.6, BRAND);

    // ---- Title ----
    let mut y = 250.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text("Odontograma", 17.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    layer.use_text(&format!("{}   ·   {}", data.kind, data.date), 9.0, Mm(150.0), Mm(y), &font);
    y -= 12.0;

    // ---- Patient block ----
    layer.set_fill_color(rgb(muted));
    layer.use_text("PACIENTE", 8.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.patient_name, 13.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    layer.use_text(&format!("Documento: {}", data.patient_doc), 8.5, Mm(left), Mm(y - 5.0), &font);
    y -= 12.0;
    hline(&layer, left, 210.0 - left * 2.0, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    // ---- Odontogram image (large, centered) ----
    if let Ok((rgb_img, w, h)) = decode_png_for_pdf(&data.odontogram_png) {
        if let Ok(img) = Image::try_from(ImageXObject {
            width: Px(w as usize),
            height: Px(h as usize),
            color_space: ColorSpace::Rgb,
            bits_per_component: ColorBits::Bit8,
            interpolate: true,
            image_data: rgb_img,
            image_filter: None,
            clipping_bbox: None,
            smask: None,
        }) {
            let target_width_mm = 185.0_f32;
            let px_to_mm = 0.264583_f32;
            let natural_width_mm = w as f32 * px_to_mm;
            let scale = target_width_mm / natural_width_mm;
            let img_h_mm = (h as f32 * px_to_mm) * scale;
            let translate_y = y - img_h_mm;
            let x_centered = (210.0 - target_width_mm) / 2.0;
            img.add_to_layer(
                layer.clone(),
                ImageTransform {
                    translate_x: Some(Mm(x_centered)),
                    translate_y: Some(Mm(translate_y.max(40.0))),
                    scale_x: Some(scale),
                    scale_y: Some(scale),
                    dpi: Some(96.0),
                    ..Default::default()
                },
            );
            y = translate_y.max(40.0) - 8.0;
        }
    }

    // ---- Findings list (two columns) ----
    if !data.findings.is_empty() && y > 40.0 {
        layer.set_fill_color(rgb(muted));
        layer.use_text("HALLAZGOS", 8.0, Mm(left), Mm(y), &font_bold);
        y -= 2.5;
        hline(&layer, left, 210.0 - left * 2.0, y, 0.3, (0.82, 0.85, 0.88));
        y -= 6.0;

        layer.set_fill_color(rgb(ink));
        let col_x = [left, 110.0_f32];
        let mut col = 0usize;
        let mut row_y = y;
        for f in &data.findings {
            if row_y < 22.0 {
                break;
            }
            let face = if f.face == "full" || f.face.is_empty() {
                String::new()
            } else {
                format!(" ({})", f.face)
            };
            let text = format!("Diente {}{}: {}", f.tooth, face, f.label);
            let t = if text.len() > 55 { text[..55].to_string() } else { text };
            layer.use_text(&t, 9.0, Mm(col_x[col]), Mm(row_y), &font);
            if col == 0 {
                col = 1;
            } else {
                col = 0;
                row_y -= 5.5;
            }
        }
    }

    // ---- Footer ----
    hline(&layer, left, 210.0 - left * 2.0, 12.0, 0.3, (0.82, 0.85, 0.88));
    layer.set_fill_color(rgb(muted));
    layer.use_text("Documento clinico. Registro odontografico del paciente.", 7.5, Mm(left), Mm(7.5), &font);

    let file = File::create(&filepath).map_err(|e| format!("Error creating file: {}", e))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Error saving PDF: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

// ===========================================================================
// Invoice (recibo/factura) PDF — same visual template as the treatment plan
// ===========================================================================

pub struct InvoicePdfItem {
    pub description: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub discount: f64,
    pub total: f64,
}

pub struct InvoicePdfPayment {
    pub date: String,
    pub amount: f64,
    pub method: String,
    pub by: String,
}

pub struct InvoicePdfData {
    pub invoice_number: String,
    pub created_at: String,
    pub status: String, // pending, partial, paid, cancelled
    pub patient_name: String,
    pub patient_doc: String,
    pub patient_phone: String,
    pub items: Vec<InvoicePdfItem>,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub amount_paid: f64,
    pub payments: Vec<InvoicePdfPayment>,
    pub notes: Option<String>,
    pub logo_path: Option<String>,
}

fn status_label(status: &str) -> &'static str {
    match status {
        "paid" => "PAGADO",
        "partial" => "ABONO PARCIAL",
        "cancelled" => "ANULADO",
        _ => "PENDIENTE",
    }
}

fn status_color(status: &str) -> (f32, f32, f32) {
    match status {
        "paid" => (0.13, 0.55, 0.33),      // green
        "partial" => (0.85, 0.60, 0.13),   // amber
        "cancelled" => (0.70, 0.20, 0.20), // red
        _ => (0.45, 0.48, 0.52),           // muted
    }
}

/// Generate an invoice/receipt PDF and return its file path.
pub fn generate_invoice_pdf(
    clinic: &ClinicInfo,
    data: &InvoicePdfData,
    output_dir: &PathBuf,
) -> Result<String, String> {
    std::fs::create_dir_all(output_dir).map_err(|e| format!("Error creating dir: {}", e))?;

    let filename = format!("recibo_{}.pdf", data.invoice_number);
    let filepath = output_dir.join(&filename);

    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Recibo {}", data.invoice_number),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {}", e))?;

    let left = 15.0;
    let lh = 6.0;
    let ink = (0.20, 0.23, 0.26);
    let muted = (0.45, 0.48, 0.52);

    // ---- Header: logo + clinic ----
    let mut header_text_x = left;
    if let Some(logo) = &data.logo_path {
        if let Ok((rgb_data, w, h)) = load_image_rgb(logo) {
            if let Ok(img) = Image::try_from(ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: rgb_data,
                image_filter: None,
                clipping_bbox: None,
                smask: None,
            }) {
                let px_to_mm = 0.264583_f32;
                let natural_w_mm = w as f32 * px_to_mm;
                let natural_h_mm = h as f32 * px_to_mm;
                let max_h_mm = 32.0_f32;
                let max_w_mm = 55.0_f32;
                let scale = (max_h_mm / natural_h_mm).min(max_w_mm / natural_w_mm);
                let logo_w_mm = natural_w_mm * scale;
                let logo_h_mm = natural_h_mm * scale;
                let logo_top = 293.0_f32;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(logo_top - logo_h_mm)),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(96.0),
                        ..Default::default()
                    },
                );
                header_text_x = left + logo_w_mm + 7.0;
            }
        }
    }

    layer.set_fill_color(rgb(BRAND));
    layer.use_text(&clinic.name, 16.0, Mm(header_text_x), Mm(280.0), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut sub = Vec::new();
    if !clinic.nit.is_empty() {
        sub.push(format!("NIT: {}", clinic.nit));
    }
    if !clinic.address.is_empty() {
        sub.push(clinic.address.clone());
    }
    if !clinic.phone.is_empty() {
        sub.push(format!("Tel: {}", clinic.phone));
    }
    if !sub.is_empty() {
        layer.use_text(sub.join("   ·   "), 8.5, Mm(header_text_x), Mm(274.0), &font);
    }

    hline(&layer, left, 210.0 - left, 258.0, 0.6, BRAND);

    // ---- Title + number/date/status ----
    let mut y = 250.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text("Recibo", 17.0, Mm(left), Mm(y), &font_bold);
    let date_short = if data.created_at.len() >= 10 { &data.created_at[..10] } else { &data.created_at };
    layer.set_fill_color(rgb(muted));
    layer.use_text(&format!("No. {}", data.invoice_number), 9.5, Mm(160.0), Mm(y + 2.0), &font_bold);
    layer.use_text(&format!("Fecha: {}", date_short), 8.5, Mm(160.0), Mm(y - 2.5), &font);
    // Status pill
    layer.set_fill_color(rgb(status_color(&data.status)));
    layer.use_text(status_label(&data.status), 9.5, Mm(left + 32.0), Mm(y + 1.0), &font_bold);
    y -= 12.0;

    // ---- Patient block ----
    layer.set_fill_color(rgb(muted));
    layer.use_text("PACIENTE", 8.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    layer.set_fill_color(rgb(ink));
    layer.use_text(&data.patient_name, 13.0, Mm(left), Mm(y), &font_bold);
    layer.set_fill_color(rgb(muted));
    let mut pinfo = format!("Documento: {}", data.patient_doc);
    if !data.patient_phone.is_empty() {
        pinfo.push_str(&format!("     Tel: {}", data.patient_phone));
    }
    layer.use_text(&pinfo, 8.5, Mm(left), Mm(y - 5.0), &font);
    y -= 10.0;
    hline(&layer, left, 210.0 - left, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    // ---- Items table ----
    let col_desc = left;
    let col_qty = 120.0;
    let col_price = 138.0;
    let col_disc = 158.0;
    let col_total = 178.0;

    fill_rect(&layer, left, y - 2.5, 210.0 - left * 2.0, 7.5, BRAND_LIGHT);
    layer.set_fill_color(rgb(BRAND));
    layer.use_text("DESCRIPCION", 8.0, Mm(col_desc + 1.0), Mm(y), &font_bold);
    layer.use_text("CANT.", 8.0, Mm(col_qty), Mm(y), &font_bold);
    layer.use_text("PRECIO", 8.0, Mm(col_price), Mm(y), &font_bold);
    layer.use_text("DESC.", 8.0, Mm(col_disc), Mm(y), &font_bold);
    layer.use_text("TOTAL", 8.0, Mm(col_total), Mm(y), &font_bold);
    y -= 9.0;

    let mut zebra = false;
    for item in &data.items {
        if y < 55.0 {
            break;
        }
        if zebra {
            fill_rect(&layer, left, y - 1.8, 210.0 - left * 2.0, 6.5, (0.965, 0.975, 0.985));
        }
        zebra = !zebra;

        let desc = if item.description.len() > 55 {
            &item.description[..55]
        } else {
            &item.description
        };
        layer.set_fill_color(rgb(ink));
        layer.use_text(desc, 9.0, Mm(col_desc + 1.0), Mm(y), &font);
        layer.set_fill_color(rgb(muted));
        layer.use_text(&item.quantity.to_string(), 9.0, Mm(col_qty + 1.0), Mm(y), &font);
        layer.use_text(&format!("${:.0}", item.unit_price), 9.0, Mm(col_price), Mm(y), &font);
        if item.discount > 0.0 {
            layer.use_text(&format!("-${:.0}", item.discount), 9.0, Mm(col_disc), Mm(y), &font);
        }
        layer.set_fill_color(rgb(ink));
        layer.use_text(&format!("${:.0}", item.total), 9.0, Mm(col_total), Mm(y), &font_bold);
        y -= 6.5;
    }

    y -= 1.0;
    hline(&layer, left, 210.0 - left * 2.0, y, 0.3, (0.82, 0.85, 0.88));
    y -= 8.0;

    // ---- Totals ----
    let tx_label = 138.0;
    let tx_val = 178.0;
    layer.set_fill_color(rgb(muted));
    layer.use_text("Subtotal", 9.5, Mm(tx_label), Mm(y), &font);
    layer.set_fill_color(rgb(ink));
    layer.use_text(&format!("${:.0}", data.subtotal), 9.5, Mm(tx_val), Mm(y), &font);
    y -= lh;
    if data.discount > 0.0 {
        layer.set_fill_color(rgb(muted));
        layer.use_text("Descuento", 9.5, Mm(tx_label), Mm(y), &font);
        layer.set_fill_color(rgb(ink));
        layer.use_text(&format!("-${:.0}", data.discount), 9.5, Mm(tx_val), Mm(y), &font);
        y -= lh;
    }
    fill_rect(&layer, tx_label - 3.0, y - 2.5, 210.0 - (tx_label - 3.0) - left, 8.5, BRAND_LIGHT);
    layer.set_fill_color(rgb(BRAND));
    layer.use_text("TOTAL", 11.0, Mm(tx_label), Mm(y), &font_bold);
    layer.use_text(&format!("${:.0}", data.total), 11.0, Mm(tx_val), Mm(y), &font_bold);
    y -= lh + 3.0;
    layer.set_fill_color(rgb(muted));
    layer.use_text("Pagado", 9.5, Mm(tx_label), Mm(y), &font);
    layer.set_fill_color(rgb((0.13, 0.55, 0.33)));
    layer.use_text(&format!("${:.0}", data.amount_paid), 9.5, Mm(tx_val), Mm(y), &font);
    y -= lh;
    let balance = data.total - data.amount_paid;
    if balance > 0.0 {
        layer.set_fill_color(rgb(muted));
        layer.use_text("Saldo", 9.5, Mm(tx_label), Mm(y), &font_bold);
        layer.set_fill_color(rgb((0.70, 0.20, 0.20)));
        layer.use_text(&format!("${:.0}", balance), 9.5, Mm(tx_val), Mm(y), &font_bold);
        y -= lh;
    }
    layer.set_fill_color(rgb(ink));
    y -= 6.0;

    // ---- Payment history ----
    if !data.payments.is_empty() && y > 40.0 {
        layer.set_fill_color(rgb(muted));
        layer.use_text("HISTORIAL DE PAGOS", 8.0, Mm(left), Mm(y), &font_bold);
        layer.set_fill_color(rgb(ink));
        y -= lh;
        for p in &data.payments {
            if y < 22.0 {
                break;
            }
            let method_label = match p.method.as_str() {
                "efectivo" => "Efectivo",
                "transferencia" => "Transferencia",
                "tarjeta" => "Tarjeta",
                other => other,
            };
            let date = if p.date.len() >= 10 { &p.date[..10] } else { &p.date };
            layer.use_text(
                &format!("{}   ${:.0}   {}   {}", date, p.amount, method_label, p.by),
                8.5,
                Mm(left + 2.0),
                Mm(y),
                &font,
            );
            y -= 5.0;
        }
    }

    // ---- Notes ----
    if let Some(notes) = &data.notes {
        if !notes.is_empty() && y > 26.0 {
            y -= 2.0;
            layer.set_fill_color(rgb(muted));
            layer.use_text("OBSERVACIONES", 8.0, Mm(left), Mm(y), &font_bold);
            layer.set_fill_color(rgb(ink));
            y -= lh;
            for line in notes.lines() {
                if y < 20.0 {
                    break;
                }
                let l = if line.len() > 100 { &line[..100] } else { line };
                layer.use_text(l, 8.5, Mm(left), Mm(y), &font);
                y -= 5.0;
            }
        }
    }

    // ---- Footer ----
    hline(&layer, left, 210.0 - left * 2.0, 12.0, 0.3, (0.82, 0.85, 0.88));
    layer.set_fill_color(rgb(muted));
    layer.use_text(
        "Gracias por su confianza.",
        7.5,
        Mm(left),
        Mm(7.5),
        &font,
    );

    let file = File::create(&filepath).map_err(|e| format!("Error creating file: {}", e))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Error saving PDF: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

/// Decode PNG bytes into RGB pixel data + dimensions for printpdf.
/// Composites RGBA/Grayscale over a white background.
pub fn decode_png_for_pdf(png_data: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    use std::io::Cursor;

    let decoder = png::Decoder::new(Cursor::new(png_data));
    let mut reader = decoder
        .read_info()
        .map_err(|e| format!("Error al decodificar PNG: {}", e))?;

    let info = reader.info();
    let width = info.width;
    let height = info.height;
    let color_type = info.color_type;

    let mut buf = vec![0; reader.output_buffer_size()];
    let frame_info = reader
        .next_frame(&mut buf)
        .map_err(|e| format!("Error al leer frame PNG: {}", e))?;

    let bytes = &buf[..frame_info.buffer_size()];

    let rgb_data = match color_type {
        png::ColorType::Rgb => bytes.to_vec(),
        png::ColorType::Rgba => {
            let mut rgb = Vec::with_capacity((bytes.len() / 4) * 3);
            for chunk in bytes.chunks(4) {
                let r = chunk[0] as f32;
                let g = chunk[1] as f32;
                let b = chunk[2] as f32;
                let a = chunk[3] as f32 / 255.0;
                rgb.push(((r * a) + (255.0 * (1.0 - a))) as u8);
                rgb.push(((g * a) + (255.0 * (1.0 - a))) as u8);
                rgb.push(((b * a) + (255.0 * (1.0 - a))) as u8);
            }
            rgb
        }
        png::ColorType::Grayscale => {
            let mut rgb = Vec::with_capacity(bytes.len() * 3);
            for &gray in bytes {
                rgb.push(gray);
                rgb.push(gray);
                rgb.push(gray);
            }
            rgb
        }
        png::ColorType::GrayscaleAlpha => {
            let mut rgb = Vec::with_capacity((bytes.len() / 2) * 3);
            for chunk in bytes.chunks(2) {
                let gray = chunk[0];
                rgb.push(gray);
                rgb.push(gray);
                rgb.push(gray);
            }
            rgb
        }
        _ => return Err("Formato de color PNG no soportado.".to_string()),
    };

    Ok((rgb_data, width, height))
}
