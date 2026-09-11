import { invoke } from "@tauri-apps/api/core";
import type { Quote, QuoteDetail, CreateQuoteRequest, QuoteStatus } from "../types";

interface Invoice {
  id: number;
  invoice_number: string;
}

export function useQuotes() {
  const createQuote = async (request: CreateQuoteRequest): Promise<Quote> => {
    return invoke<Quote>("create_quote", { request });
  };

  const getQuote = async (id: number): Promise<QuoteDetail> => {
    return invoke<QuoteDetail>("get_quote", { id });
  };

  const listByPatient = async (patientId: number): Promise<Quote[]> => {
    return invoke<Quote[]>("list_quotes_by_patient", { patientId });
  };

  const updateStatus = async (quoteId: number, status: QuoteStatus): Promise<Quote> => {
    return invoke<Quote>("update_quote_status", { request: { quote_id: quoteId, status } });
  };

  const convertToInvoice = async (quoteId: number): Promise<Invoice> => {
    return invoke<Invoice>("convert_quote_to_invoice", { quoteId });
  };

  /**
   * Generate and open the quote PDF. Optionally embeds the odontogram image
   * (PNG bytes as a number[] array).
   */
  const exportPdf = async (quoteId: number, odontogramPng?: number[]): Promise<string> => {
    return invoke<string>("export_quote_pdf", {
      quoteId,
      odontogramPng: odontogramPng ?? null,
    });
  };

  const whatsappLink = async (quoteId: number): Promise<string> => {
    return invoke<string>("quote_whatsapp_link", { quoteId });
  };

  return { createQuote, getQuote, listByPatient, updateStatus, convertToInvoice, exportPdf, whatsappLink };
}
