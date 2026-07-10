export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: number;
  patient_id: number;
  patient_name: string | null;
  doctor_id: number;
  doctor_name: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  total_amount: number;
  status_changed_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface AppointmentSummary {
  id: number;
  patient_name: string;
  doctor_name: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  reason: string | null;
  total_amount: number;
}

export interface AppointmentProcedure {
  id: number;
  appointment_id: number;
  procedure_id: number;
  procedure_name: string | null;
  procedure_code: string | null;
  quantity: number;
  unit_price: number;
  discount_type: "percentage" | "fixed" | null;
  discount_value: number;
  final_price: number;
  tooth_number: string | null;
  notes: string | null;
}

export interface CreateAppointmentRequest {
  patient_id: number;
  doctor_id: number;
  start_time: string;
  end_time: string;
  reason?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentRequest {
  id: number;
  patient_id?: number | null;
  doctor_id?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
  notes?: string | null;
}

export interface ChangeStatusRequest {
  appointment_id: number;
  new_status: AppointmentStatus;
}

export interface AddProcedureRequest {
  appointment_id: number;
  procedure_id: number;
  quantity?: number;
  unit_price: number;
  discount_type?: "percentage" | "fixed" | null;
  discount_value?: number;
  tooth_number?: string | null;
  notes?: string | null;
}

export interface RemoveProcedureRequest {
  appointment_procedure_id: number;
  appointment_id: number;
}

export interface ListAppointmentsFilter {
  doctor_id?: number | null;
  patient_id?: number | null;
  status?: AppointmentStatus | null;
  date_from?: string | null;
  date_to?: string | null;
}

export type CalendarView = "day" | "week" | "month";

// Status config for display
export const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  scheduled: {
    label: "Programada",
    color: "text-blue-700",
    bgColor: "bg-blue-100 border-blue-300",
    dotColor: "bg-blue-500",
  },
  confirmed: {
    label: "Confirmada",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100 border-indigo-300",
    dotColor: "bg-indigo-500",
  },
  in_progress: {
    label: "En progreso",
    color: "text-amber-700",
    bgColor: "bg-amber-100 border-amber-300",
    dotColor: "bg-amber-500",
  },
  completed: {
    label: "Completada",
    color: "text-green-700",
    bgColor: "bg-green-100 border-green-300",
    dotColor: "bg-green-500",
  },
  cancelled: {
    label: "Cancelada",
    color: "text-red-700",
    bgColor: "bg-red-100 border-red-300",
    dotColor: "bg-red-500",
  },
  no_show: {
    label: "No asistió",
    color: "text-gray-700",
    bgColor: "bg-gray-100 border-gray-300",
    dotColor: "bg-gray-500",
  },
};

// Valid state transitions map
export const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

// Helper functions
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function toISOLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
