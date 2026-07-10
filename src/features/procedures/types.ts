export interface Procedure {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProcedureSummary {
  id: number;
  code: string;
  name: string;
  category: string;
  base_price: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface PriceHistoryEntry {
  id: number;
  procedure_id: number;
  old_price: number;
  new_price: number;
  changed_by: number;
  changed_by_name: string | null;
  reason: string | null;
  changed_at: string;
}

export interface CreateProcedureRequest {
  code: string;
  name: string;
  category: string;
  description?: string | null;
  base_price: number;
  duration_minutes?: number | null;
}

export interface UpdateProcedureRequest {
  id: number;
  code?: string | null;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
  is_active?: boolean | null;
}

export interface UpdatePriceRequest {
  procedure_id: number;
  new_price: number;
  reason?: string | null;
}

export type DiscountType = "percentage" | "fixed";

export interface ProcedureDiscount {
  procedure_id: number;
  discount_type: DiscountType;
  discount_value: number;
  final_price: number;
}

export const PROCEDURE_CATEGORIES = [
  { value: "Consulta", label: "Consulta" },
  { value: "Prevención", label: "Prevención" },
  { value: "Periodoncia", label: "Periodoncia" },
  { value: "Operatoria", label: "Operatoria" },
  { value: "Endodoncia", label: "Endodoncia" },
  { value: "Cirugía", label: "Cirugía" },
  { value: "Prótesis Fija", label: "Prótesis Fija" },
  { value: "Prótesis Removible", label: "Prótesis Removible" },
  { value: "Estética", label: "Estética" },
  { value: "Implantología", label: "Implantología" },
  { value: "Diagnóstico", label: "Diagnóstico" },
  { value: "Ortodoncia", label: "Ortodoncia" },
] as const;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculateDiscount(
  basePrice: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (discountType === "percentage") {
    const clamped = Math.min(Math.max(discountValue, 0), 100);
    return Math.round(basePrice * (1 - clamped / 100));
  }
  const clamped = Math.min(Math.max(discountValue, 0), basePrice);
  return Math.round(basePrice - clamped);
}
