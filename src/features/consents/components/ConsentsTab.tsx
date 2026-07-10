import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Send,
  Download,
  PenTool,
  MessageCircle,
} from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useConsents } from "../hooks/useConsents";
import SignatureCanvas from "../components/SignatureCanvas";
import type { Consent } from "../types";
import { CONSENT_STATUSES } from "../types";
import { open } from "@tauri-apps/plugin-shell";

interface ConsentsTabProps {
  patientId: number;
}

export default function ConsentsTab({ patientId }: ConsentsTabProps) {
  const { toast } = useToast();
  const {
    createConsent,
    listConsents,
    saveSignature,
    generateWhatsappLink,
    getConsentTemplates,
    exportConsentPdf,
  } = useConsents();

  const [consents, setConsents] = useState<Consent[]>([]);
  const [templates, setTemplates] = useState<[string, string][]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSignature, setShowSignature] = useState<number | null>(null);

  // Create form
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [consentsList, templatesList] = await Promise.all([
        listConsents(patientId),
        getConsentTemplates(),
      ]);
      setConsents(consentsList);
      setTemplates(templatesList);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleCreate = async () => {
    if (!selectedTemplate) return;
    setCreating(true);
    try {
      await createConsent({
        patient_id: patientId,
        template_name: selectedTemplate,
        notes: notes || null,
      });
      toast("success", "Consentimiento generado con PDF.");
      setShowCreate(false);
      setSelectedTemplate("");
      setNotes("");
      await loadData();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleWhatsApp = async (consent: Consent) => {
    try {
      // Step 1: Export PDF to Downloads and open it
      const pdfPath = await exportConsentPdf(consent.id);
      toast("success", `PDF guardado en Descargas: ${pdfPath.split(/[\\/]/).pop()}`);

      // Step 2: Open WhatsApp with message (user attaches PDF manually)
      const link = await generateWhatsappLink(patientId, consent.id);
      await open(link);
      toast("info", "Adjunte el PDF manualmente en la conversación de WhatsApp.");
      await loadData();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleViewPdf = async (consent: Consent) => {
    try {
      const path = await exportConsentPdf(consent.id);
      toast("success", `PDF abierto: ${path.split(/[\\/]/).pop()}`);
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleSaveSignature = async (consentId: number, data: number[]) => {
    try {
      await saveSignature({ consent_id: consentId, signature_data: data });
      toast("success", "Firma guardada. Consentimiento marcado como firmado.");
      setShowSignature(null);
      await loadData();
    } catch (err) {
      toast("error", String(err));
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">Cargando consentimientos...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {consents.length} consentimiento(s)
        </p>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
          Nuevo Consentimiento
        </Button>
      </div>

      {/* List */}
      {consents.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No hay consentimientos registrados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consents.map((consent) => (
            <ConsentCard
              key={consent.id}
              consent={consent}
              templates={templates}
              onViewPdf={() => handleViewPdf(consent)}
              onWhatsApp={() => handleWhatsApp(consent)}
              onSign={() => setShowSignature(consent.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal isOpen onClose={() => setShowCreate(false)} title="Nuevo Consentimiento Informado">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Plantilla</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar plantilla...</option>
                {templates.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Notas adicionales"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={!selectedTemplate || creating}
              >
                {creating ? "Generando PDF..." : "Generar Consentimiento"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Signature Modal */}
      {showSignature && (
        <Modal isOpen onClose={() => setShowSignature(null)} title="Firma del Paciente" size="lg">
          <SignatureCanvas
            onSave={(data) => handleSaveSignature(showSignature, data)}
            onCancel={() => setShowSignature(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function ConsentCard({
  consent,
  templates,
  onViewPdf,
  onWhatsApp,
  onSign,
}: {
  consent: Consent;
  templates: [string, string][];
  onViewPdf: () => void;
  onWhatsApp: () => void;
  onSign: () => void;
}) {
  const statusInfo = CONSENT_STATUSES[consent.status] ?? { label: consent.status, color: "neutral" };
  const templateLabel = templates.find(([k]) => k === consent.template_name)?.[1] ?? consent.template_name;
  const date = new Date(consent.created_at).toLocaleDateString("es-CO");

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800">{templateLabel}</p>
          <Badge variant={statusInfo.color as any}>{statusInfo.label}</Badge>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
          <span>{date}</span>
          {consent.procedure_name && <span>· {consent.procedure_name}</span>}
          {consent.sent_at && (
            <span className="flex items-center gap-1">
              <Send size={10} /> Enviado: {new Date(consent.sent_at).toLocaleDateString("es-CO")}
            </span>
          )}
          {consent.signed_at && (
            <span className="flex items-center gap-1">
              <PenTool size={10} /> Firmado: {new Date(consent.signed_at).toLocaleDateString("es-CO")}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {consent.pdf_path && (
          <button onClick={onViewPdf} className="rounded p-2 hover:bg-gray-100" title="Ver PDF">
            <Download size={16} className="text-blue-600" />
          </button>
        )}
        {consent.status === "pending" || consent.status === "sent" ? (
          <>
            <button onClick={onWhatsApp} className="rounded p-2 hover:bg-green-50" title="Enviar por WhatsApp">
              <MessageCircle size={16} className="text-green-600" />
            </button>
            <button onClick={onSign} className="rounded p-2 hover:bg-purple-50" title="Firmar presencialmente">
              <PenTool size={16} className="text-purple-600" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
