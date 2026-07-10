import { invoke } from "@tauri-apps/api/core";
import type {
  Patient,
  PatientSummary,
  CreatePatientRequest,
  UpdatePatientRequest,
  SearchPatientsRequest,
} from "../types";

export function usePatients() {
  const searchPatients = async (request: SearchPatientsRequest): Promise<PatientSummary[]> => {
    return invoke<PatientSummary[]>("search_patients", { request });
  };

  const getPatient = async (id: number): Promise<Patient> => {
    return invoke<Patient>("get_patient", { id });
  };

  const createPatient = async (request: CreatePatientRequest): Promise<Patient> => {
    return invoke<Patient>("create_patient", { request });
  };

  const updatePatient = async (request: UpdatePatientRequest): Promise<Patient> => {
    return invoke<Patient>("update_patient", { request });
  };

  const deactivatePatient = async (id: number): Promise<void> => {
    return invoke<void>("deactivate_patient", { id });
  };

  const countPatients = async (activeOnly: boolean): Promise<number> => {
    return invoke<number>("count_patients", { activeOnly });
  };

  return {
    searchPatients,
    getPatient,
    createPatient,
    updatePatient,
    deactivatePatient,
    countPatients,
  };
}
