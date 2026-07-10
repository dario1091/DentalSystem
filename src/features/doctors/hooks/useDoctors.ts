import { invoke } from "@tauri-apps/api/core";
import type {
  Doctor,
  DoctorSummary,
  CreateDoctorRequest,
  UpdateDoctorRequest,
} from "../types";

export function useDoctors() {
  const listDoctors = async (activeOnly: boolean = true): Promise<DoctorSummary[]> => {
    return invoke<DoctorSummary[]>("list_doctors", { activeOnly });
  };

  const getDoctor = async (id: number): Promise<Doctor> => {
    return invoke<Doctor>("get_doctor", { id });
  };

  const createDoctor = async (request: CreateDoctorRequest): Promise<Doctor> => {
    return invoke<Doctor>("create_doctor", { request });
  };

  const updateDoctor = async (request: UpdateDoctorRequest): Promise<Doctor> => {
    return invoke<Doctor>("update_doctor", { request });
  };

  const deactivateDoctor = async (id: number): Promise<void> => {
    return invoke<void>("deactivate_doctor", { id });
  };

  return { listDoctors, getDoctor, createDoctor, updateDoctor, deactivateDoctor };
}
