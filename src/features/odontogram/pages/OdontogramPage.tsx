import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Eye } from "lucide-react";
import { Button, Badge, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useOdontogram, type OdontogramFinding, type OdontogramSummary } from "../hooks/useOdontogram";
import OdontogramCanvas from "../components/OdontogramCanvas";
import ToolPanel from "../components/ToolPanel";
import { FINDING_TYPES, getFindingColor, isFindingFullTooth } from "../utils/tooth-geometry";
import type { DentitionType, ToothFace } from "../utils/fdi-nomenclature";

interface OdontogramPageProps {
  patientId?: number;
  readOnly?: boolean;
}

export default function OdontogramPage({ patientId, readOnly = false }: OdontogramPageProps) {
  const { toast } = useToast();
  const { createOdontogram, addFinding, removeFinding, getByPatient, getDetail } = useOdontogram();

  const [odontograms, setOdontograms] = useState<OdontogramSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [findings, setFindings] = useState<OdontogramFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dentition, setDentition] = useState<DentitionType>("permanent");

  // Tool state
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<OdontogramFinding[]>([]);

  // Comparison mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [compareFindings, setCompareFindings] = useState<OdontogramFinding[]>([]);

  const fetchOdontograms = useCallback(async () => {
    if (!patientId) return;
    try {
      const list = await getByPatient(patientId);
      setOdontograms(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      toast("error", String(err));
    }
  }, [patientId]);

  const fetchDetail = useCallback(async () => {
    if (!selectedId) {
      setFindings([]);
      return;
    }
    try {
      setLoading(true);
      const detail = await getDetail(selectedId);
      setFindings(detail.findings);
      setDentition(detail.odontogram.dentition_type as DentitionType);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchOdontograms();
  }, [fetchOdontograms]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Load compare odontogram
  useEffect(() => {
    if (!compareId) {
      setCompareFindings([]);
      return;
    }
    getDetail(compareId).then((d) => setCompareFindings(d.findings)).catch(() => {});
  }, [compareId]);

  const handleCreateOdontogram = async (isInitial: boolean) => {
    if (!patientId) return;
    try {
      const detail = await createOdontogram({
        patient_id: patientId,
        dentition_type: dentition,
        is_initial: isInitial,
      });
      toast("success", isInitial ? "Odontograma inicial creado." : "Evolución creada.");
      setSelectedId(detail.odontogram.id);
      fetchOdontograms();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleFaceClick = async (toothNumber: string, face: ToothFace) => {
    if (!selectedId || readOnly) return;

    if (selectedTool === "__eraser") {
      // Find and remove the finding for this tooth+face
      const existing = findings.find(
        (f) => f.tooth_number === toothNumber && (f.face === face || f.face === "full"),
      );
      if (existing) {
        try {
          await removeFinding({ finding_id: existing.id, odontogram_id: selectedId });
          setUndoStack((prev) => [...prev, existing]);
          fetchDetail();
        } catch (err) {
          toast("error", String(err));
        }
      }
      return;
    }

    if (!selectedTool) return;

    const findingType = FINDING_TYPES.find((f) => f.id === selectedTool);
    if (!findingType) return;

    const isFullTooth = isFindingFullTooth(selectedTool);

    try {
      const newFinding = await addFinding({
        odontogram_id: selectedId,
        tooth_number: toothNumber,
        face: isFullTooth ? "full" : face,
        finding_type: selectedTool,
        color: getFindingColor(selectedTool),
      });
      setUndoStack((prev) => [...prev, newFinding]);
      fetchDetail();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0 || !selectedId) return;
    const last = undoStack[undoStack.length - 1];
    try {
      await removeFinding({ finding_id: last.id, odontogram_id: selectedId });
      setUndoStack((prev) => prev.slice(0, -1));
      fetchDetail();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleExportPDF = () => {
    // Canvas to image export
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `odontograma_${patientId}_${selectedId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("success", "Odontograma exportado como imagen.");
  };

  if (!patientId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
        <p>Seleccione un paciente para ver su odontograma.</p>
      </div>
    );
  }

  const selectedOdontogram = odontograms.find((o) => o.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Odontograma</h2>
          {selectedOdontogram && (
            <Badge variant={selectedOdontogram.is_initial ? "info" : "neutral"}>
              {selectedOdontogram.is_initial ? "Inicial" : "Evolución"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Dentition toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setDentition("permanent")}
              className={`px-3 py-1.5 text-xs font-medium ${
                dentition === "permanent" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Permanente
            </button>
            <button
              onClick={() => setDentition("deciduous")}
              className={`px-3 py-1.5 text-xs font-medium ${
                dentition === "deciduous" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Temporal
            </button>
          </div>

          {!readOnly && (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus size={14} />}
                onClick={() => handleCreateOdontogram(odontograms.length === 0)}
              >
                {odontograms.length === 0 ? "Crear Inicial" : "Nueva Evolución"}
              </Button>
            </>
          )}

          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={handleExportPDF}>
            Exportar
          </Button>

          {odontograms.length > 1 && (
            <Button
              size="sm"
              variant={compareMode ? "primary" : "secondary"}
              icon={<Eye size={14} />}
              onClick={() => setCompareMode(!compareMode)}
            >
              Comparar
            </Button>
          )}
        </div>
      </div>

      {/* Version selector */}
      {odontograms.length > 0 && (
        <div className="flex items-center gap-4">
          <Select
            label="Versión"
            options={odontograms.map((o) => ({
              value: String(o.id),
              label: `${o.is_initial ? "Inicial" : "Evolución"} — ${new Date(o.created_at).toLocaleDateString("es-CO")} (${o.findings_count} hallazgos)`,
            }))}
            value={String(selectedId || "")}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          />
          {compareMode && (
            <Select
              label="Comparar con"
              options={[
                { value: "", label: "Seleccionar..." },
                ...odontograms
                  .filter((o) => o.id !== selectedId)
                  .map((o) => ({
                    value: String(o.id),
                    label: `${o.is_initial ? "Inicial" : "Evolución"} — ${new Date(o.created_at).toLocaleDateString("es-CO")}`,
                  })),
              ]}
              value={String(compareId || "")}
              onChange={(e) => setCompareId(e.target.value ? Number(e.target.value) : null)}
            />
          )}
        </div>
      )}

      {/* Main content: Canvas + Tools */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>
      ) : !selectedId ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
          <p>No hay odontogramas. Cree el odontograma inicial para comenzar.</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Tool panel */}
          <ToolPanel
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
            readOnly={readOnly}
          />

          {/* Canvas area */}
          <div className="flex-1 space-y-4">
            <div className={`flex ${compareMode ? "gap-4" : ""}`}>
              <div>
                {compareMode && <p className="mb-1 text-xs font-medium text-gray-500">Actual</p>}
                <OdontogramCanvas
                  dentition={dentition}
                  findings={findings}
                  selectedTool={selectedTool}
                  onFaceClick={handleFaceClick}
                  readOnly={readOnly}
                />
              </div>
              {compareMode && compareId && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Comparación</p>
                  <OdontogramCanvas
                    dentition={dentition}
                    findings={compareFindings}
                    selectedTool={null}
                    onFaceClick={() => {}}
                    readOnly
                  />
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Convenciones
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {FINDING_TYPES.map((f) => (
                  <div key={f.id} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm border border-gray-300"
                      style={{ backgroundColor: f.color }}
                    />
                    <span className="text-[11px] text-gray-600">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
