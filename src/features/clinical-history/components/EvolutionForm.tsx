import { useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@shared/components/ui";
import type { AddEvolutionRequest, AddAddendumRequest, UpdateEvolutionRequest, Evolution } from "../types";

interface EvolutionFormProps {
  clinicalHistoryId: number;
  appointmentId?: number | null;
  /** If set, this is an edit of an existing (unlocked) evolution */
  existing?: Evolution | null;
  /** If set, this is an addendum to a locked evolution */
  parentEvolution?: Evolution | null;
  onSave: (request: AddEvolutionRequest | AddAddendumRequest | UpdateEvolutionRequest) => Promise<void>;
  onCancel: () => void;
}

export default function EvolutionForm({
  clinicalHistoryId,
  appointmentId,
  existing,
  parentEvolution,
  onSave,
  onCancel,
}: EvolutionFormProps) {
  const [form, setForm] = useState({
    subjective: existing?.subjective ?? "",
    objective: existing?.objective ?? "",
    analysis: existing?.analysis ?? "",
    plan: existing?.plan ?? "",
  });
  const [saving, setSaving] = useState(false);

  const isAddendum = !!parentEvolution;
  const isEdit = !!existing && !existing.is_locked;

  const title = isAddendum
    ? `Adenda a Evolución #${parentEvolution.sequence_number}`
    : isEdit
      ? `Editar Evolución #${existing.sequence_number}`
      : "Nueva Evolución (SOAP)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subjective.trim() || !form.objective.trim() || !form.analysis.trim() || !form.plan.trim()) {
      return;
    }

    setSaving(true);
    try {
      if (isEdit && existing) {
        await onSave({
          id: existing.id,
          subjective: form.subjective,
          objective: form.objective,
          analysis: form.analysis,
          plan: form.plan,
        } as UpdateEvolutionRequest);
      } else if (isAddendum && parentEvolution) {
        await onSave({
          clinical_history_id: clinicalHistoryId,
          parent_evolution_id: parentEvolution.id,
          subjective: form.subjective,
          objective: form.objective,
          analysis: form.analysis,
          plan: form.plan,
        } as AddAddendumRequest);
      } else {
        await onSave({
          clinical_history_id: clinicalHistoryId,
          appointment_id: appointmentId ?? null,
          subjective: form.subjective,
          objective: form.objective,
          analysis: form.analysis,
          plan: form.plan,
        } as AddEvolutionRequest);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-5">
      <h4 className="mb-4 text-sm font-semibold text-blue-800">{title}</h4>

      <div className="space-y-4">
        <SoapField
          letter="S"
          label="Subjetivo"
          placeholder="Lo que el paciente refiere: síntomas, quejas, motivo de la consulta"
          value={form.subjective}
          onChange={(v) => setForm((p) => ({ ...p, subjective: v }))}
          color="blue"
        />
        <SoapField
          letter="O"
          label="Objetivo"
          placeholder="Hallazgos del examen clínico: signos vitales, exploración, resultados"
          value={form.objective}
          onChange={(v) => setForm((p) => ({ ...p, objective: v }))}
          color="green"
        />
        <SoapField
          letter="A"
          label="Análisis"
          placeholder="Diagnóstico, impresión clínica, análisis de hallazgos"
          value={form.analysis}
          onChange={(v) => setForm((p) => ({ ...p, analysis: v }))}
          color="amber"
        />
        <SoapField
          letter="P"
          label="Plan"
          placeholder="Plan de tratamiento, medicamentos, recomendaciones, próxima cita"
          value={form.plan}
          onChange={(v) => setForm((p) => ({ ...p, plan: v }))}
          color="purple"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" type="button" size="sm" icon={<X size={14} />} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          type="submit"
          size="sm"
          icon={<Save size={14} />}
          disabled={saving || !form.subjective.trim() || !form.objective.trim() || !form.analysis.trim() || !form.plan.trim()}
        >
          {saving ? "Guardando..." : isAddendum ? "Guardar Adenda" : isEdit ? "Actualizar" : "Registrar Evolución"}
        </Button>
      </div>
    </form>
  );
}

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-700" },
  green: { bg: "bg-green-100", border: "border-green-300", text: "text-green-700" },
  amber: { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700" },
  purple: { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-700" },
};

function SoapField({
  letter,
  label,
  placeholder,
  value,
  onChange,
  color,
}: {
  letter: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  color: string;
}) {
  const c = COLORS[color] ?? COLORS.blue;
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.bg} ${c.text} text-sm font-bold`}
      >
        {letter}
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          required
          className={`w-full rounded-lg border ${c.border} bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
      </div>
    </div>
  );
}
