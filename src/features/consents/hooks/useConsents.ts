import { invoke } from "@tauri-apps/api/core";
import type { Consent, CreateConsentRequest, UpdateConsentStatusRequest, SaveSignatureRequest } from "../types";

export function useConsents() {
  const createConsent = async (request: CreateConsentRequest): Promise<Consent> => {
    return invoke<Consent>("create_consent", { request });
  };

  const listConsents = async (patientId: number): Promise<Consent[]> => {
    return invoke<Consent[]>("list_consents", { patientId });
  };

  const updateConsentStatus = async (request: UpdateConsentStatusRequest): Promise<Consent> => {
    return invoke<Consent>("update_consent_status", { request });
  };

  const saveSignature = async (request: SaveSignatureRequest): Promise<Consent> => {
    return invoke<Consent>("save_consent_signature", { request });
  };

  const generateWhatsappLink = async (patientId: number, consentId: number): Promise<string> => {
    return invoke<string>("generate_whatsapp_link", { patientId, consentId });
  };

  const getConsentTemplates = async (): Promise<[string, string][]> => {
    return invoke<[string, string][]>("get_consent_templates");
  };

  const getConsentPdfData = async (consentId: number): Promise<number[]> => {
    return invoke<number[]>("get_consent_pdf_data", { consentId });
  };

  const exportConsentPdf = async (consentId: number): Promise<string> => {
    return invoke<string>("export_consent_pdf", { consentId });
  };

  return {
    createConsent,
    listConsents,
    updateConsentStatus,
    saveSignature,
    generateWhatsappLink,
    getConsentTemplates,
    getConsentPdfData,
    exportConsentPdf,
  };
}
