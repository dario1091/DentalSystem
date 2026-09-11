import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, Download, MessageCircle, Receipt } from "lucide-react";
import { Button, Badge, useToast, useConfirm } from "@shared/components/ui";
import { formatCurrency } from "@features/procedures/types";
import { useQuotes } from "../hooks/useQuotes";
import type { Quote } from "../types";
import { QUOTE_STATUS_CONFIG } from "../types";
import CreateQuoteModal from "./CreateQuoteModal";

interface QuotesTabProps {
  patientId: number;
}

export default function QuotesTab({ patientId }: QuotesTabProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { listByPatient, exportPdf, whatsappLink, convertToInvoice } = useQuotes();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setQuotes(await listByPatient(patientId));
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (quote: Quote) => {
    setBusyId(quote.id);
    try {
      await exportPdf(quote.id);
      toast("success", "PDF de cotización generado.");
    } catch (err) {
      toast("error", String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleWhatsapp = async (quote: Quote) => {
    setBusyId(quote.id);
    try {
      const link = await whatsappLink(quote.id);
      window.open(link, "_blank");
      await load();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (quote: Quote) => {
    const ok = await confirm({
      title: "Convertir en factura",
      message: `Se creará una factura con los procedimientos del plan de tratamiento ${quote.quote_number}. El paciente podrá pagarla por partes o abonar. ¿Continuar?`,
      confirmLabel: "Sí, facturar",
    });
    if (!ok) return;
    setBusyId(quote.id);
    try {
      const invoice = await convertToInvoice(quote.id);
      toast("success", `Factura ${invoice.invoice_number} creada desde la cotización.`);
      await load();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Planes de Tratamiento</h3>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
          Nuevo Plan
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando cotizaciones...</div>
      ) : quotes.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">Este paciente no tiene planes de tratamiento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => {
            const cfg = QUOTE_STATUS_CONFIG[q.status];
            const isConverted = q.status === "converted";
            const busy = busyId === q.id;
            return (
              <div
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{q.quote_number}</span>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {q.created_at?.slice(0, 10)}
                    {q.valid_until ? ` · válida hasta ${q.valid_until.slice(0, 10)}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">{formatCurrency(q.total)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Download size={14} />}
                    onClick={() => handleDownload(q)}
                    disabled={busy}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<MessageCircle size={14} />}
                    onClick={() => handleWhatsapp(q)}
                    disabled={busy}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Receipt size={14} />}
                    onClick={() => handleConvert(q)}
                    disabled={busy || isConverted}
                    title={isConverted ? "Ya facturada" : "Convertir en factura"}
                  >
                    {isConverted ? "Facturada" : "Facturar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateQuoteModal
          patientId={patientId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}
