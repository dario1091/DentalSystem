export interface Prize {
  id: number;
  name: string;
  color: string;
  weight: number;
  validity_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientPrize {
  id: number;
  patient_id: number;
  patient_name: string | null;
  prize_id: number | null;
  prize_name: string;
  status: string; // pending, redeemed, expired
  won_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  notes: string | null;
  created_by: number;
  created_by_name: string | null;
}

export interface CreatePrizeRequest {
  name: string;
  color?: string | null;
  weight?: number | null;
  validity_days?: number | null;
}

export interface UpdatePrizeRequest {
  id: number;
  name: string;
  color: string;
  weight: number;
  validity_days: number;
  active: boolean;
}

export interface SpinRequest {
  patient_id: number;
}

export interface RedeemPrizeRequest {
  patient_prize_id: number;
  notes?: string | null;
}

export const PRIZE_STATUSES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "warning" },
  redeemed: { label: "Canjeado", color: "success" },
  expired: { label: "Vencido", color: "neutral" },
};

// Paleta vibrante para segmentos de la ruleta (estilo llamativo).
export const PRIZE_COLORS = [
  "#ff2d75", // fucsia
  "#ff7a00", // naranja
  "#ffd000", // amarillo
  "#00c2a8", // turquesa
  "#7c3aed", // morado
  "#2563eb", // azul
  "#ff4d4d", // rojo coral
  "#22c55e", // verde
] as const;
