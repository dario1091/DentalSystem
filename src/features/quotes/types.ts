export type QuoteStatus = "draft" | "sent" | "accepted" | "converted" | "expired";

export interface Quote {
  id: number;
  quote_number: string;
  patient_id: number;
  odontogram_id: number | null;
  subtotal: number;
  discount: number;
  total: number;
  status: QuoteStatus;
  valid_until: string | null;
  notes: string | null;
  invoice_id: number | null;
  created_by: number;
  created_by_name: string | null;
  patient_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: number;
  quote_id: number;
  procedure_id: number | null;
  description: string;
  tooth_number: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface QuoteDetail {
  quote: Quote;
  items: QuoteItem[];
}

export interface CreateQuoteItemRequest {
  procedure_id?: number | null;
  description: string;
  tooth_number?: string | null;
  quantity: number;
  unit_price: number;
  discount?: number | null;
}

export interface CreateQuoteRequest {
  patient_id: number;
  odontogram_id?: number | null;
  items: CreateQuoteItemRequest[];
  discount?: number | null;
  valid_until?: string | null;
  notes?: string | null;
}

export const QUOTE_STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; variant: "default" | "info" | "success" | "warning" | "neutral" }
> = {
  draft: { label: "Borrador", variant: "neutral" },
  sent: { label: "Enviada", variant: "info" },
  accepted: { label: "Aceptada", variant: "success" },
  converted: { label: "Facturada", variant: "success" },
  expired: { label: "Vencida", variant: "warning" },
};
