export interface Patient {
  id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  marital_status: string | null;
  phone: string;
  phone_secondary: string | null;
  email: string | null;
  address: string | null;
  eps: string | null;
  blood_type: string | null;
  allergies: string | null;
  current_medications: string | null;
  medical_history: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  photo_path: string | null;
  data_consent: boolean;
  data_consent_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientSummary {
  id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

export interface CreatePatientRequest {
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  marital_status?: string | null;
  phone: string;
  phone_secondary?: string | null;
  email?: string | null;
  address?: string | null;
  eps?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  medical_history?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_phone?: string | null;
  data_consent: boolean;
}

export interface UpdatePatientRequest {
  id: number;
  document_type?: string | null;
  document_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  phone?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  address?: string | null;
  eps?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  medical_history?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_phone?: string | null;
  data_consent?: boolean | null;
}

export interface SearchPatientsRequest {
  query?: string | null;
  active_only?: boolean | null;
  limit?: number | null;
  offset?: number | null;
}

export const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PP", label: "Pasaporte" },
  { value: "RC", label: "Registro Civil" },
] as const;

export const GENDERS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "O", label: "Otro" },
] as const;

export const BLOOD_TYPES = [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
] as const;

export const MARITAL_STATUSES = [
  { value: "soltero", label: "Soltero/a" },
  { value: "casado", label: "Casado/a" },
  { value: "union_libre", label: "Unión Libre" },
  { value: "divorciado", label: "Divorciado/a" },
  { value: "viudo", label: "Viudo/a" },
] as const;
