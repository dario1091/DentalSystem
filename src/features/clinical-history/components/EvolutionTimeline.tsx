import { Lock, Unlock, Plus, Edit, FileText } from "lucide-react";
import { Button, Badge } from "@shared/components/ui";
import type { Evolution } from "../types";

interface EvolutionTimelineProps {
  evolutions: Evolution[];
  onAddEvolution: () => void;
  onEditEvolution: (evolution: Evolution) => void;
  onAddAddendum: (evolution: Evolution) => void;
}

export default function EvolutionTimeline({
  evolutions,
  onAddEvolution,
  onEditEvolution,
  onAddAddendum,
}: EvolutionTimelineProps) {
  if (evolutions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <FileText size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">No hay evoluciones registradas.</p>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          className="mt-4"
          onClick={onAddEvolution}
        >
          Registrar Primera Evolución
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {evolutions.length} evolución{evolutions.length !== 1 ? "es" : ""} registrada
          {evolutions.length !== 1 ? "s" : ""}
        </p>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={onAddEvolution}>
          Nueva Evolución
        </Button>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {evolutions.map((evo) => (
          <EvolutionCard
            key={evo.id}
            evolution={evo}
            onEdit={() => onEditEvolution(evo)}
            onAddAddendum={() => onAddAddendum(evo)}
          />
        ))}
      </div>
    </div>
  );
}

function EvolutionCard({
  evolution,
  onEdit,
  onAddAddendum,
}: {
  evolution: Evolution;
  onEdit: () => void;
  onAddAddendum: () => void;
}) {
  const date = new Date(evolution.created_at);
  const formattedDate = date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`rounded-lg border bg-white p-5 ${
        evolution.is_addendum ? "border-amber-200 bg-amber-50/30" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">
            #{evolution.sequence_number}
          </span>
          {evolution.is_addendum && (
            <Badge variant="warning">Adenda</Badge>
          )}
          {evolution.is_locked ? (
            <span title="Evolución bloqueada (>24h)">
              <Lock size={14} className="text-red-400" />
            </span>
          ) : (
            <span title="Editable">
              <Unlock size={14} className="text-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!evolution.is_locked && (
            <Button variant="ghost" size="sm" icon={<Edit size={12} />} onClick={onEdit}>
              Editar
            </Button>
          )}
          {evolution.is_locked && (
            <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={onAddAddendum}>
              Adenda
            </Button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
        <span>{formattedDate} · {formattedTime}</span>
        <span>·</span>
        <span>Dr. {evolution.created_by_name ?? "Desconocido"}</span>
        {evolution.appointment_id && (
          <>
            <span>·</span>
            <span className="text-blue-600">Cita #{evolution.appointment_id}</span>
          </>
        )}
      </div>

      {/* SOAP Content */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SoapSection letter="S" label="Subjetivo" content={evolution.subjective} color="blue" />
        <SoapSection letter="O" label="Objetivo" content={evolution.objective} color="green" />
        <SoapSection letter="A" label="Análisis" content={evolution.analysis} color="amber" />
        <SoapSection letter="P" label="Plan" content={evolution.plan} color="purple" />
      </div>
    </div>
  );
}

const SECTION_COLORS: Record<string, { dot: string; text: string }> = {
  blue: { dot: "bg-blue-500", text: "text-blue-700" },
  green: { dot: "bg-green-500", text: "text-green-700" },
  amber: { dot: "bg-amber-500", text: "text-amber-700" },
  purple: { dot: "bg-purple-500", text: "text-purple-700" },
};

function SoapSection({
  letter,
  label,
  content,
  color,
}: {
  letter: string;
  label: string;
  content: string;
  color: string;
}) {
  const c = SECTION_COLORS[color] ?? SECTION_COLORS.blue;
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <div className="mb-1 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold ${c.text}`}>
          {letter} — {label}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-700">{content}</p>
    </div>
  );
}
