export interface ClinicalHistory {
  id: number;
  patient_id: number;
  chief_complaint: string;
  present_illness: string | null;
  medical_history: string | null;
  surgical_history: string | null;
  family_history: string | null;
  allergies: string | null;
  medications: string | null;
  clinical_exam: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  evolutions_count: number;
}

export interface Evolution {
  id: number;
  clinical_history_id: number;
  appointment_id: number | null;
  sequence_number: number;
  subjective: string;
  objective: string;
  analysis: string;
  plan: string;
  is_locked: boolean;
  is_addendum: boolean;
  parent_evolution_id: number | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
}

export interface ClinicalHistoryDetail {
  history: ClinicalHistory;
  evolutions: Evolution[];
}

export interface CreateClinicalHistoryRequest {
  patient_id: number;
  chief_complaint: string;
  present_illness?: string | null;
  medical_history?: string | null;
  surgical_history?: string | null;
  family_history?: string | null;
  allergies?: string | null;
  medications?: string | null;
  clinical_exam?: string | null;
  diagnosis?: string | null;
  treatment_plan?: string | null;
}

export interface UpdateClinicalHistoryRequest {
  id: number;
  chief_complaint?: string | null;
  present_illness?: string | null;
  medical_history?: string | null;
  surgical_history?: string | null;
  family_history?: string | null;
  allergies?: string | null;
  medications?: string | null;
  clinical_exam?: string | null;
  diagnosis?: string | null;
  treatment_plan?: string | null;
}

export interface AddEvolutionRequest {
  clinical_history_id: number;
  appointment_id?: number | null;
  subjective: string;
  objective: string;
  analysis: string;
  plan: string;
}

export interface AddAddendumRequest {
  clinical_history_id: number;
  parent_evolution_id: number;
  subjective: string;
  objective: string;
  analysis: string;
  plan: string;
}

export interface UpdateEvolutionRequest {
  id: number;
  subjective?: string | null;
  objective?: string | null;
  analysis?: string | null;
  plan?: string | null;
}
