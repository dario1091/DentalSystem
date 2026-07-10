import { useEffect, useState } from "react";
import { FileText, Edit, Filter } from "lucide-react";
import { Button, Badge } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useClinicalHistory } from "../hooks/useClinicalHistory";
import ClinicalHistoryForm from "./ClinicalHistoryForm";
import EvolutionForm from "./EvolutionForm";
import EvolutionTimeline from "./EvolutionTimeline";
import type {
  ClinicalHistoryDetail,
  Evolution,
  CreateClinicalHistoryRequest,
  UpdateClinicalHistoryRequest,
  AddEvolutionRequest,
  AddAddendumRequest,
  UpdateEvolutionRequest,
} from "../types";

interface ClinicalHistoryTabProps {
  patientId: number;
  appointmentId?: number | null;
}

type View = "loading" | "empty" | "detail" | "create" | "edit";
type EvolutionAction =
  | { type: "none" }
  | { type: "new" }
  | { type: "edit"; evolution: Evolution }
  | { type: "addendum"; evolution: Evolution };

export default function ClinicalHistoryTab({ patientId, appointmentId }: ClinicalHistoryTabProps) {
  const { toast } = useToast();
  const {
    getClinicalHistory,
    createClinicalHistory,
    updateClinicalHistory,
    addEvolution,
    addAddendum,
    updateEvolution,
    getEvolutions,
  } = useClinicalHistory();

  const [view, setView] = useState<View>("loading");
  const [detail, setDetail] = useState<ClinicalHistoryDetail | null>(null);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [evolutionAction, setEvolutionAction] = useState<EvolutionAction>({ type: "none" });

  // Date filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const loadData = async () => {
    try {
      const result = await getClinicalHistory(patientId);
      if (result) {
        setDetail(result);
        setEvolutions(result.evolutions);
        setView("detail");
      } else {
        setView("empty");
      }
    } catch (err) {
      toast("error", String(err));
      setView("empty");
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Refresh evolutions with filters
  const refreshEvolutions = async () => {
    if (!detail) return;
    try {
      const evos = await getEvolutions(
        detail.history.id,
        fromDate || null,
        toDate || null
      );
      setEvolutions(evos);
    } catch (err) {
      toast("error", String(err));
    }
  };

  useEffect(() => {
    if (detail && (fromDate || toDate)) {
      refreshEvolutions();
    } else if (detail && !fromDate && !toDate) {
      setEvolutions(detail.evolutions);
    }
  }, [fromDate, toDate]);

  // --- Handlers ---

  const handleCreateHistory = async (
    request: CreateClinicalHistoryRequest | UpdateClinicalHistoryRequest
  ) => {
    try {
      await createClinicalHistory(request as CreateClinicalHistoryRequest);
      toast("success", "Historia clínica creada exitosamente.");
      await loadData();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleUpdateHistory = async (
    request: CreateClinicalHistoryRequest | UpdateClinicalHistoryRequest
  ) => {
    try {
      await updateClinicalHistory(request as UpdateClinicalHistoryRequest);
      toast("success", "Historia clínica actualizada.");
      await loadData();
      setView("detail");
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleSaveEvolution = async (
    request: AddEvolutionRequest | AddAddendumRequest | UpdateEvolutionRequest
  ) => {
    try {
      if ("parent_evolution_id" in request) {
        await addAddendum(request as AddAddendumRequest);
        toast("success", "Adenda registrada.");
      } else if ("id" in request && !("clinical_history_id" in request)) {
        await updateEvolution(request as UpdateEvolutionRequest);
        toast("success", "Evolución actualizada.");
      } else {
        await addEvolution(request as AddEvolutionRequest);
        toast("success", "Evolución registrada.");
      }
      setEvolutionAction({ type: "none" });
      await loadData();
    } catch (err) {
      toast("error", String(err));
    }
  };

  // --- Render ---

  if (view === "loading") {
    return <div className="py-10 text-center text-sm text-gray-400">Cargando historia clínica...</div>;
  }

  if (view === "empty" || view === "create") {
    return (
      <div>
        {view === "empty" && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-8 text-center">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="mb-1 text-sm font-medium text-gray-600">
              Este paciente no tiene historia clínica.
            </p>
            <p className="mb-4 text-xs text-gray-400">
              Debe crear una historia clínica antes de registrar evoluciones.
            </p>
            <Button variant="primary" size="sm" onClick={() => setView("create")}>
              Crear Historia Clínica
            </Button>
          </div>
        )}
        {view === "create" && (
          <ClinicalHistoryForm
            patientId={patientId}
            onSave={handleCreateHistory}
            onCancel={() => setView("empty")}
          />
        )}
      </div>
    );
  }

  if (view === "edit" && detail) {
    return (
      <ClinicalHistoryForm
        patientId={patientId}
        existing={detail.history}
        onSave={handleUpdateHistory}
        onCancel={() => setView("detail")}
      />
    );
  }

  // Detail view
  if (!detail) return null;
  const { history } = detail;

  return (
    <div className="space-y-6">
      {/* History Summary Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Historia Clínica</h3>
            <p className="mt-1 text-xs text-gray-500">
              Creada por {history.created_by_name ?? "—"} el{" "}
              {new Date(history.created_at).toLocaleDateString("es-CO")} ·{" "}
              <Badge variant="info">{history.evolutions_count} evoluciones</Badge>
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<Edit size={14} />} onClick={() => setView("edit")}>
            Editar
          </Button>
        </div>

        {/* Key fields summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SummaryField label="Motivo de Consulta" value={history.chief_complaint} />
          <SummaryField label="Diagnóstico (CIE-10)" value={history.diagnosis} />
          <SummaryField label="Plan de Tratamiento" value={history.treatment_plan} />
          <SummaryField label="Alergias" value={history.allergies} highlight />
        </div>

        {/* Collapsible details */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
            Ver todos los campos
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 lg:grid-cols-2">
            <SummaryField label="Enfermedad Actual" value={history.present_illness} />
            <SummaryField label="Antecedentes Médicos" value={history.medical_history} />
            <SummaryField label="Antecedentes Quirúrgicos" value={history.surgical_history} />
            <SummaryField label="Antecedentes Familiares" value={history.family_history} />
            <SummaryField label="Medicamentos Actuales" value={history.medications} />
            <SummaryField label="Examen Clínico" value={history.clinical_exam} />
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<Filter size={14} />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros
        </Button>
        {showFilters && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="Desde"
            />
            <span className="text-xs text-gray-400">—</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="Hasta"
            />
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Evolution Form (when active) */}
      {evolutionAction.type !== "none" && (
        <EvolutionForm
          clinicalHistoryId={history.id}
          appointmentId={appointmentId}
          existing={evolutionAction.type === "edit" ? evolutionAction.evolution : null}
          parentEvolution={evolutionAction.type === "addendum" ? evolutionAction.evolution : null}
          onSave={handleSaveEvolution}
          onCancel={() => setEvolutionAction({ type: "none" })}
        />
      )}

      {/* Evolutions Timeline */}
      <EvolutionTimeline
        evolutions={evolutions}
        onAddEvolution={() => setEvolutionAction({ type: "new" })}
        onEditEvolution={(evo) => setEvolutionAction({ type: "edit", evolution: evo })}
        onAddAddendum={(evo) => setEvolutionAction({ type: "addendum", evolution: evo })}
      />
    </div>
  );
}

function SummaryField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-sm text-gray-300">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`whitespace-pre-wrap text-sm ${
          highlight ? "font-medium text-red-600" : "text-gray-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
