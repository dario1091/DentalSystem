use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: i64,
    pub patient_id: i64,
    pub file_name: String,
    pub original_name: String,
    pub file_path: String,
    pub file_size: i64,
    pub mime_type: String,
    pub document_type: String,
    pub notes: Option<String>,
    pub uploaded_by: i64,
    pub uploaded_by_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadDocumentRequest {
    pub patient_id: i64,
    pub original_name: String,
    pub document_type: String,
    pub notes: Option<String>,
    pub data: Vec<u8>,
}

#[derive(Debug, Deserialize)]
pub struct ListDocumentsRequest {
    pub patient_id: i64,
    pub document_type: Option<String>,
}

/// Allowed MIME types for upload
pub const ALLOWED_MIME_TYPES: &[(&str, &str)] = &[
    ("image/jpeg", "jpg"),
    ("image/png", "png"),
    ("image/webp", "webp"),
    ("application/pdf", "pdf"),
];

/// Document type categories
pub const DOCUMENT_TYPES: &[(&str, &str)] = &[
    ("foto", "Fotografía"),
    ("radiografia", "Radiografía"),
    ("consentimiento", "Consentimiento"),
    ("examen", "Examen de laboratorio"),
    ("otro", "Otro"),
];

/// Maximum file size: 50 MB
pub const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;
