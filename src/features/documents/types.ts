export interface Document {
  id: number;
  patient_id: number;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type: string;
  notes: string | null;
  uploaded_by: number;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface UploadDocumentRequest {
  patient_id: number;
  original_name: string;
  document_type: string;
  notes?: string | null;
  data: number[];
}

export interface ListDocumentsRequest {
  patient_id: number;
  document_type?: string | null;
}

export const DOCUMENT_TYPES = [
  { value: "foto", label: "Fotografía" },
  { value: "radiografia", label: "Radiografía" },
  { value: "consentimiento", label: "Consentimiento" },
  { value: "examen", label: "Examen de laboratorio" },
  { value: "otro", label: "Otro" },
] as const;

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"];
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
