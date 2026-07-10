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
}

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
