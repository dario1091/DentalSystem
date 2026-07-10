import { invoke } from "@tauri-apps/api/core";

export interface OdontogramFinding {
  id: number;
  odontogram_id: number;
  tooth_number: string;
  face: string | null;
  finding_type: string;
  color: string;
  notes: string | null;
  created_at: string;
}

export interface OdontogramSummary {
  id: number;
  patient_id: number;
  dentition_type: string;
  is_initial: boolean;
  created_by_name: string | null;
  created_at: string;
  findings_count: number;
}

export interface OdontogramDetail {
  odontogram: {
    id: number;
    patient_id: number;
    appointment_id: number | null;
    dentition_type: string;
    is_initial: boolean;
    notes: string | null;
    created_by: number;
    created_by_name: string | null;
    created_at: string;
    findings_count: number;
  };
  findings: OdontogramFinding[];
}

export function useOdontogram() {
  const createOdontogram = async (request: {
    patient_id: number;
    appointment_id?: number | null;
    dentition_type?: string | null;
    is_initial?: boolean;
    notes?: string | null;
  }): Promise<OdontogramDetail> => {
    return invoke<OdontogramDetail>("create_odontogram", { request });
  };

  const addFinding = async (request: {
    odontogram_id: number;
    tooth_number: string;
    face: string | null;
    finding_type: string;
    color: string;
    notes?: string | null;
  }): Promise<OdontogramFinding> => {
    return invoke<OdontogramFinding>("add_finding", { request });
  };

  const removeFinding = async (request: {
    finding_id: number;
    odontogram_id: number;
  }): Promise<void> => {
    return invoke<void>("remove_finding", { request });
  };

  const getByPatient = async (patientId: number): Promise<OdontogramSummary[]> => {
    return invoke<OdontogramSummary[]>("get_odontograms_by_patient", { patientId });
  };

  const getDetail = async (odontogramId: number): Promise<OdontogramDetail> => {
    return invoke<OdontogramDetail>("get_odontogram_detail", { odontogramId });
  };

  return { createOdontogram, addFinding, removeFinding, getByPatient, getDetail };
}
