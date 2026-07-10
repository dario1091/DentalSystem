export interface Doctor {
  id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  professional_license: string;
  specialty: string;
  university: string | null;
  phone: string;
  email: string | null;
  signature_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorSummary {
  id: number;
  first_name: string;
  last_name: string;
  professional_license: string;
  specialty: string;
  is_active: boolean;
}

export interface CreateDoctorRequest {
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  professional_license: string;
  specialty: string;
  university?: string | null;
  phone: string;
  email?: string | null;
}

export interface UpdateDoctorRequest {
  id: number;
  document_type?: string | null;
  document_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  professional_license?: string | null;
  specialty?: string | null;
  university?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean | null;
}

export const SPECIALTIES = [
  { value: "Odontología General", label: "Odontología General" },
  { value: "Ortodoncia", label: "Ortodoncia" },
  { value: "Endodoncia", label: "Endodoncia" },
  { value: "Periodoncia", label: "Periodoncia" },
  { value: "Cirugía Oral", label: "Cirugía Oral" },
  { value: "Prostodoncia", label: "Prostodoncia" },
  { value: "Odontopediatría", label: "Odontopediatría" },
  { value: "Implantología", label: "Implantología" },
  { value: "Estética Dental", label: "Estética Dental" },
  { value: "Radiología Oral", label: "Radiología Oral" },
] as const;
