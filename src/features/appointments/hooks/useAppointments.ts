import { invoke } from "@tauri-apps/api/core";
import type {
  Appointment,
  AppointmentSummary,
  AppointmentProcedure,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  ChangeStatusRequest,
  AddProcedureRequest,
  RemoveProcedureRequest,
  ListAppointmentsFilter,
} from "../types";

export function useAppointments() {
  const createAppointment = async (
    request: CreateAppointmentRequest,
  ): Promise<Appointment> => {
    return invoke<Appointment>("create_appointment", { request });
  };

  const updateAppointment = async (
    request: UpdateAppointmentRequest,
  ): Promise<Appointment> => {
    return invoke<Appointment>("update_appointment", { request });
  };

  const getAppointment = async (id: number): Promise<Appointment> => {
    return invoke<Appointment>("get_appointment", { id });
  };

  const listAppointments = async (
    filter: ListAppointmentsFilter,
  ): Promise<AppointmentSummary[]> => {
    return invoke<AppointmentSummary[]>("list_appointments", { filter });
  };

  const changeStatus = async (
    request: ChangeStatusRequest,
  ): Promise<Appointment> => {
    return invoke<Appointment>("change_appointment_status", { request });
  };

  const addProcedure = async (
    request: AddProcedureRequest,
  ): Promise<AppointmentProcedure> => {
    return invoke<AppointmentProcedure>("add_procedure_to_appointment", { request });
  };

  const removeProcedure = async (
    request: RemoveProcedureRequest,
  ): Promise<void> => {
    return invoke<void>("remove_procedure_from_appointment", { request });
  };

  const getAppointmentProcedures = async (
    appointmentId: number,
  ): Promise<AppointmentProcedure[]> => {
    return invoke<AppointmentProcedure[]>("get_appointment_procedures", { appointmentId });
  };

  return {
    createAppointment,
    updateAppointment,
    getAppointment,
    listAppointments,
    changeStatus,
    addProcedure,
    removeProcedure,
    getAppointmentProcedures,
  };
}
