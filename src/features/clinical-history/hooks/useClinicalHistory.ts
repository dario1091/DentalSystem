import { invoke } from "@tauri-apps/api/core";
import type {
  ClinicalHistory,
  ClinicalHistoryDetail,
  Evolution,
  CreateClinicalHistoryRequest,
  UpdateClinicalHistoryRequest,
  AddEvolutionRequest,
  AddAddendumRequest,
  UpdateEvolutionRequest,
} from "../types";

export function useClinicalHistory() {
  const getClinicalHistory = async (patientId: number): Promise<ClinicalHistoryDetail | null> => {
    return invoke<ClinicalHistoryDetail | null>("get_clinical_history", { patientId });
  };

  const createClinicalHistory = async (
    request: CreateClinicalHistoryRequest
  ): Promise<ClinicalHistory> => {
    return invoke<ClinicalHistory>("create_clinical_history", { request });
  };

  const updateClinicalHistory = async (
    request: UpdateClinicalHistoryRequest
  ): Promise<ClinicalHistory> => {
    return invoke<ClinicalHistory>("update_clinical_history", { request });
  };

  const addEvolution = async (request: AddEvolutionRequest): Promise<Evolution> => {
    return invoke<Evolution>("add_evolution", { request });
  };

  const addAddendum = async (request: AddAddendumRequest): Promise<Evolution> => {
    return invoke<Evolution>("add_addendum", { request });
  };

  const updateEvolution = async (request: UpdateEvolutionRequest): Promise<Evolution> => {
    return invoke<Evolution>("update_evolution", { request });
  };

  const getEvolutions = async (
    clinicalHistoryId: number,
    fromDate?: string | null,
    toDate?: string | null
  ): Promise<Evolution[]> => {
    return invoke<Evolution[]>("get_evolutions", {
      clinicalHistoryId,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
    });
  };

  return {
    getClinicalHistory,
    createClinicalHistory,
    updateClinicalHistory,
    addEvolution,
    addAddendum,
    updateEvolution,
    getEvolutions,
  };
}
