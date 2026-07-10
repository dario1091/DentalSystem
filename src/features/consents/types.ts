export interface Consent {
  id: number;
  patient_id: number;
  appointment_id: number | null;
  procedure_id: number | null;
  template_name: string;
  status: string;
  pdf_path: string | null;
  signature_path: string | null;
  signed_pdf_path: string | null;
  notes: string | null;
  sent_at: string | null;
  signed_at: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  patient_name: string | null;
  procedure_name: string | null;
}

export interface CreateConsentRequest {
  patient_id: number;
  appointment_id?: number | null;
  procedure_id?: number | null;
  template_name: string;
  notes?: string | null;
}

export interface UpdateConsentStatusRequest {
  id: number;
  status: string;
}

export interface SaveSignatureRequest {
  consent_id: number;
  signature_data: number[];
}

export const CONSENT_STATUSES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "warning" },
  sent: { label: "Enviado", color: "info" },
  signed: { label: "Firmado", color: "success" },
  expired: { label: "Expirado", color: "neutral" },
};
