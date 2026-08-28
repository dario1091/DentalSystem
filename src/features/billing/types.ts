export interface Invoice {
  id: number;
  invoice_number: string;
  patient_id: number;
  appointment_id: number | null;
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  created_by: number;
  created_by_name: string | null;
  patient_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  procedure_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
}

export interface PatientBalance {
  patient_id: number;
  total_invoiced: number;
  total_paid: number;
  balance_due: number;
  invoice_count: number;
  available_credit: number;
}

export interface CreateInvoiceRequest {
  patient_id: number;
  appointment_id?: number | null;
  items: CreateInvoiceItemRequest[];
  discount?: number | null;
  notes?: string | null;
}

export interface CreateInvoiceItemRequest {
  procedure_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number | null;
}

export interface AddPaymentRequest {
  invoice_id: number;
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface RevenueReport {
  total_invoiced: number;
  total_paid: number;
  pending: number;
  invoices: Invoice[];
  credit_deposits: number;
  credit_applied: number;
  credit_refunds: number;
  credit_penalties: number;
}

// ===== Saldo a favor / anticipos =====

export interface PatientCredit {
  patient_id: number;
  balance: number;
  updated_at: string;
}

export interface CreditMovement {
  id: number;
  patient_id: number;
  movement_type: string; // deposit, apply, refund, penalty
  amount: number;
  invoice_id: number | null;
  invoice_number: string | null;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
}

export interface AddCreditRequest {
  patient_id: number;
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface ApplyCreditRequest {
  patient_id: number;
  invoice_id: number;
  amount: number;
  notes?: string | null;
}

export interface RefundCreditRequest {
  patient_id: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface RefundResult {
  total_withdrawn: number;
  refunded_amount: number;
  penalty_amount: number;
}

export const REFUND_PENALTY_RATE = 0.2;

export const CREDIT_MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  deposit: { label: "Abono", color: "success" },
  apply: { label: "Aplicado a factura", color: "info" },
  refund: { label: "Devolución", color: "warning" },
  penalty: { label: "Penalización (20%)", color: "neutral" },
};

export const INVOICE_STATUSES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "warning" },
  partial: { label: "Abono parcial", color: "info" },
  paid: { label: "Pagado", color: "success" },
  cancelled: { label: "Anulado", color: "neutral" },
};

export const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
] as const;
