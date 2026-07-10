import { invoke } from "@tauri-apps/api/core";
import type {
  Invoice, InvoiceDetail, PatientBalance, Payment, RevenueReport,
  CreateInvoiceRequest, AddPaymentRequest,
} from "../types";

export function useBilling() {
  const createInvoice = async (request: CreateInvoiceRequest): Promise<Invoice> => {
    return invoke<Invoice>("create_invoice", { request });
  };

  const getInvoice = async (id: number): Promise<InvoiceDetail> => {
    return invoke<InvoiceDetail>("get_invoice", { id });
  };

  const listInvoicesByPatient = async (patientId: number): Promise<Invoice[]> => {
    return invoke<Invoice[]>("list_invoices_by_patient", { patientId });
  };

  const addPayment = async (request: AddPaymentRequest): Promise<Payment> => {
    return invoke<Payment>("add_payment", { request });
  };

  const getPatientBalance = async (patientId: number): Promise<PatientBalance> => {
    return invoke<PatientBalance>("get_patient_balance", { patientId });
  };

  const getRevenueReport = async (fromDate?: string | null, toDate?: string | null): Promise<RevenueReport> => {
    return invoke<RevenueReport>("get_revenue_report", { fromDate: fromDate ?? null, toDate: toDate ?? null });
  };

  const exportInvoicePdf = async (invoiceId: number): Promise<string> => {
    return invoke<string>("export_invoice_pdf", { invoiceId });
  };

  return {
    createInvoice,
    getInvoice,
    listInvoicesByPatient,
    addPayment,
    getPatientBalance,
    getRevenueReport,
    exportInvoicePdf,
  };
}
