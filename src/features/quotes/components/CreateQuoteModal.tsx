import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Search, X } from "lucide-react";
import { Modal, Button, Input, useToast } from "@shared/components/ui";
import { useProcedures } from "@features/procedures/hooks/useProcedures";
import { formatCurrency } from "@features/procedures/types";
import type { ProcedureSummary } from "@features/procedures/types";
import { useOdontogram } from "@features/odontogram/hooks/useOdontogram";
import type { OdontogramDetail } from "@features/odontogram/hooks/useOdontogram";
import OdontogramCanvas from "@features/odontogram/components/OdontogramCanvas";
import type { DentitionType } from "@features/odontogram/utils/fdi-nomenclature";
import { getToothByNumber } from "@features/odontogram/utils/fdi-nomenclature";
import { FINDING_TYPES } from "@features/odontogram/utils/tooth-geometry";
import { useQuotes } from "../hooks/useQuotes";

interface CreateQuoteModalProps {
  patientId: number;
  onClose: () => void;
  onCreated: () => void;
}

interface LineItem {
  key: string;
  procedure_id: number | null;
  description: string;
  tooth_number: string | null;
  quantity: number;
  unit_price: number;
  // Origin finding (for display context)
  findingLabel?: string;
}

function findingLabel(findingType: string): string {
  return FINDING_TYPES.find((f) => f.id === findingType)?.label ?? findingType;
}

export default function CreateQuoteModal({ patientId, onClose, onCreated }: CreateQuoteModalProps) {
  const { toast } = useToast();
  const { getByPatient, getDetail } = useOdontogram();
  const { listProcedures } = useProcedures();
  const { createQuote, exportPdf } = useQuotes();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [procedures, setProcedures] = useState<ProcedureSummary[]>([]);
  const [odontogram, setOdontogram] = useState<OdontogramDetail | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [includeOdontogram, setIncludeOdontogram] = useState(true);
  const [procPickerFor, setProcPickerFor] = useState<string | null>(null);

  // Hidden canvas wrapper used to export the odontogram as PNG for the PDF.
  const odontogramExportRef = useRef<HTMLDivElement>(null);

  // Load procedures + latest odontogram with findings
  useEffect(() => {
    (async () => {
      try {
        const [procs, odontos] = await Promise.all([
          listProcedures(true),
          getByPatient(patientId),
        ]);
        setProcedures(procs);
        if (odontos.length > 0) {
          const detail = await getDetail(odontos[0].id);
          setOdontogram(detail);
        }
      } catch (err) {
        toast("error", String(err));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Findings grouped by tooth (only the meaningful ones for treatment)
  const findingsByTooth = useMemo(() => {
    if (!odontogram) return [];
    const rows: { tooth: string; label: string; findingType: string }[] = [];
    for (const f of odontogram.findings) {
      rows.push({ tooth: f.tooth_number, label: findingLabel(f.finding_type), findingType: f.finding_type });
    }
    return rows;
  }, [odontogram]);

  const addFindingAsLine = (tooth: string, label: string) => {
    const toothName = getToothByNumber(tooth)?.name ?? `Diente ${tooth}`;
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        procedure_id: null,
        description: "",
        tooth_number: tooth,
        quantity: 1,
        unit_price: 0,
        findingLabel: `${label} · ${toothName}`,
      },
    ]);
  };

  const addManualLine = () => {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        procedure_id: null,
        description: "",
        tooth_number: null,
        quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const removeLine = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const updateLine = (key: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const assignProcedure = (key: string, proc: ProcedureSummary) => {
    updateLine(key, {
      procedure_id: proc.id,
      description: proc.name,
      unit_price: proc.base_price,
    });
    setProcPickerFor(null);
  };

  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0),
    [items],
  );

  const dentition: DentitionType =
    (odontogram?.odontogram.dentition_type as DentitionType) || "permanent";

  // Export the hidden odontogram canvas to PNG bytes (number[]).
  // We upscale onto a larger offscreen canvas so the image stays crisp when
  // enlarged in the PDF.
  const captureOdontogramPng = async (): Promise<number[] | undefined> => {
    if (!includeOdontogram || !odontogram) return undefined;
    const source = odontogramExportRef.current?.querySelector("canvas");
    if (!source) return undefined;

    // Upscale factor for print quality.
    const scale = 2.5;
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.round(source.width * scale);
    offscreen.height = Math.round(source.height * scale);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return undefined;
    // White background so transparent areas don't turn black in the PDF.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, offscreen.width, offscreen.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/png"),
    );
    if (!blob) return undefined;
    const buffer = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  };

  const handleSave = async (thenExport: boolean) => {
    const validItems = items.filter((it) => it.description.trim() && it.unit_price > 0);
    if (validItems.length === 0) {
      toast("error", "Agregue al menos un procedimiento con precio.");
      return;
    }

    setSaving(true);
    try {
      const quote = await createQuote({
        patient_id: patientId,
        odontogram_id: includeOdontogram ? odontogram?.odontogram.id ?? null : null,
        items: validItems.map((it) => ({
          procedure_id: it.procedure_id,
          description: it.description.trim(),
          tooth_number: it.tooth_number,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
        valid_until: validUntil || null,
        notes: notes.trim() || null,
      });

      toast("success", `Plan de tratamiento ${quote.quote_number} creado.`);

      if (thenExport) {
        const png = await captureOdontogramPng();
        await exportPdf(quote.id, png);
      }

      onCreated();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Nuevo Plan de Tratamiento" size="xl">
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando datos del paciente...</div>
      ) : (
        <div className="space-y-5">
          {/* Findings from odontogram */}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">
              Hallazgos del odontograma
            </h4>
            {!odontogram ? (
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Este paciente no tiene odontograma. Puede agregar procedimientos manualmente.
              </p>
            ) : findingsByTooth.length === 0 ? (
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                El odontograma no tiene hallazgos registrados.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {findingsByTooth.map((f, idx) => (
                  <button
                    key={`${f.tooth}-${idx}`}
                    type="button"
                    onClick={() => addFindingAsLine(f.tooth, f.label)}
                    className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                    title="Agregar como línea de cotización"
                  >
                    <Plus size={12} />
                    Diente {f.tooth}: {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Procedimientos cotizados</h4>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addManualLine}>
                Agregar línea
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="rounded border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-400">
                Agregue procedimientos desde los hallazgos o con "Agregar línea".
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.key} className="rounded-lg border border-gray-200 p-3">
                    {it.findingLabel && (
                      <p className="mb-1 text-xs font-medium text-emerald-700">{it.findingLabel}</p>
                    )}
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {it.procedure_id ? (
                          <div className="flex items-center justify-between rounded border border-blue-100 bg-blue-50 px-2 py-1.5">
                            <span className="text-sm font-medium text-gray-800">{it.description}</span>
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:text-blue-800"
                              onClick={() => setProcPickerFor(it.key)}
                            >
                              Cambiar
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Search size={14} />}
                            onClick={() => setProcPickerFor(it.key)}
                          >
                            Elegir procedimiento
                          </Button>
                        )}
                      </div>
                      <div className="w-16">
                        <Input
                          type="number"
                          value={String(it.quantity)}
                          onChange={(e) => updateLine(it.key, { quantity: Math.max(1, Number(e.target.value)) })}
                          min="1"
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          value={String(it.unit_price)}
                          onChange={(e) => updateLine(it.key, { unit_price: Math.max(0, Number(e.target.value)) })}
                          min="0"
                        />
                      </div>
                      <div className="w-24 pt-2 text-right text-sm font-semibold text-gray-700">
                        {formatCurrency(it.unit_price * it.quantity)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(it.key)}
                        className="pt-2 text-gray-400 hover:text-red-500"
                        title="Quitar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Inline procedure picker */}
                    {procPickerFor === it.key && (
                      <ProcedurePicker
                        procedures={procedures}
                        onPick={(proc) => assignProcedure(it.key, proc)}
                        onClose={() => setProcPickerFor(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Válida hasta (opcional)"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includeOdontogram}
                  onChange={(e) => setIncludeOdontogram(e.target.checked)}
                  disabled={!odontogram}
                />
                Incluir odontograma en el PDF
              </label>
            </div>
          </div>

          <Input
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones para el paciente"
          />

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Total estimado</span>
            <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X size={14} />} onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button variant="primary" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? "Guardando..." : "Guardar y generar PDF"}
            </Button>
          </div>

          {/* Hidden odontogram canvas for PNG export */}
          {includeOdontogram && odontogram && (
            <div
              ref={odontogramExportRef}
              style={{ position: "absolute", left: -99999, top: 0 }}
              aria-hidden
            >
              <OdontogramCanvas
                dentition={dentition}
                findings={odontogram.findings}
                selectedTool={null}
                onFaceClick={() => {}}
                readOnly
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Inline searchable procedure picker. */
function ProcedurePicker({
  procedures,
  onPick,
  onClose,
}: {
  procedures: ProcedureSummary[];
  onPick: (proc: ProcedureSummary) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return procedures.slice(0, 50);
    return procedures
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [query, procedures]);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2">
      <div className="mb-2 flex items-center justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar procedimiento por nombre o código..."
          leftIcon={<Search size={14} />}
        />
        <button type="button" onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">Sin resultados.</p>
        ) : (
          filtered.map((proc) => (
            <button
              key={proc.id}
              type="button"
              onClick={() => onPick(proc)}
              className="flex w-full items-center justify-between border-b border-gray-50 px-2 py-1.5 text-left hover:bg-gray-50 last:border-b-0"
            >
              <span className="text-sm">
                <span className="font-mono text-xs text-gray-400">{proc.code} </span>
                <span className="font-medium text-gray-800">{proc.name}</span>
                <span className="ml-2 text-xs text-gray-400">{proc.category}</span>
              </span>
              <span className="text-sm font-semibold text-gray-700">
                {formatCurrency(proc.base_price)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
