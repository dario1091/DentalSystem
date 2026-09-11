import { useState } from "react";
import { Save, X, Search } from "lucide-react";
import { Button } from "@shared/components/ui";
import { useClinicalHistory } from "../hooks/useClinicalHistory";
import type {
  ClinicalHistory,
  CreateClinicalHistoryRequest,
  UpdateClinicalHistoryRequest,
  Cie10Code,
} from "../types";

interface ClinicalHistoryFormProps {
  patientId: number;
  existing?: ClinicalHistory | null;
  onSave: (request: CreateClinicalHistoryRequest | UpdateClinicalHistoryRequest) => Promise<void>;
  onCancel: () => void;
}

export default function ClinicalHistoryForm({
  patientId,
  existing,
  onSave,
  onCancel,
}: ClinicalHistoryFormProps) {
  const [form, setForm] = useState({
    chief_complaint: existing?.chief_complaint ?? "",
    present_illness: existing?.present_illness ?? "",
    medical_history: existing?.medical_history ?? "",
    surgical_history: existing?.surgical_history ?? "",
    family_history: existing?.family_history ?? "",
    allergies: existing?.allergies ?? "",
    medications: existing?.medications ?? "",
    clinical_exam: existing?.clinical_exam ?? "",
    diagnosis: existing?.diagnosis ?? "",
    cie10_code: existing?.cie10_code ?? "",
    treatment_plan: existing?.treatment_plan ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chief_complaint.trim()) return;

    setSaving(true);
    try {
      if (existing) {
        await onSave({
          id: existing.id,
          chief_complaint: form.chief_complaint || null,
          present_illness: form.present_illness || null,
          medical_history: form.medical_history || null,
          surgical_history: form.surgical_history || null,
          family_history: form.family_history || null,
          allergies: form.allergies || null,
          medications: form.medications || null,
          clinical_exam: form.clinical_exam || null,
          diagnosis: form.diagnosis || null,
          cie10_code: form.cie10_code || null,
          treatment_plan: form.treatment_plan || null,
        } as UpdateClinicalHistoryRequest);
      } else {
        await onSave({
          patient_id: patientId,
          chief_complaint: form.chief_complaint,
          present_illness: form.present_illness || null,
          medical_history: form.medical_history || null,
          surgical_history: form.surgical_history || null,
          family_history: form.family_history || null,
          allergies: form.allergies || null,
          medications: form.medications || null,
          clinical_exam: form.clinical_exam || null,
          diagnosis: form.diagnosis || null,
          cie10_code: form.cie10_code || null,
          treatment_plan: form.treatment_plan || null,
        } as CreateClinicalHistoryRequest);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">
          {existing ? "Editar Historia Clínica" : "Apertura de Historia Clínica"}
        </h3>

        <div className="space-y-5">
          {/* Motivo de consulta - OBLIGATORIO */}
          <FormTextarea
            label="Motivo de Consulta *"
            value={form.chief_complaint}
            onChange={(v) => handleChange("chief_complaint", v)}
            placeholder="Razón principal por la que el paciente asiste a consulta"
            required
          />

          {/* Enfermedad actual */}
          <FormTextarea
            label="Enfermedad Actual"
            value={form.present_illness}
            onChange={(v) => handleChange("present_illness", v)}
            placeholder="Descripción detallada de la enfermedad o condición actual"
          />

          {/* Antecedentes */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FormTextarea
              label="Antecedentes Médicos"
              value={form.medical_history}
              onChange={(v) => handleChange("medical_history", v)}
              placeholder="Enfermedades previas, hospitalizaciones, etc."
              rows={3}
            />
            <FormTextarea
              label="Antecedentes Quirúrgicos"
              value={form.surgical_history}
              onChange={(v) => handleChange("surgical_history", v)}
              placeholder="Cirugías previas"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FormTextarea
              label="Antecedentes Familiares"
              value={form.family_history}
              onChange={(v) => handleChange("family_history", v)}
              placeholder="Patologías familiares relevantes"
              rows={3}
            />
            <FormTextarea
              label="Alergias"
              value={form.allergies}
              onChange={(v) => handleChange("allergies", v)}
              placeholder="Alergias conocidas (medicamentos, materiales, alimentos)"
              rows={3}
            />
          </div>

          <FormTextarea
            label="Medicamentos Actuales"
            value={form.medications}
            onChange={(v) => handleChange("medications", v)}
            placeholder="Medicamentos que toma actualmente"
            rows={2}
          />

          {/* Examen clínico */}
          <FormTextarea
            label="Examen Clínico"
            value={form.clinical_exam}
            onChange={(v) => handleChange("clinical_exam", v)}
            placeholder="Hallazgos del examen clínico intraoral y extraoral"
          />

          {/* Código CIE-10 (opcional, con buscador) */}
          <Cie10Search
            value={form.cie10_code}
            onChange={(v) => handleChange("cie10_code", v)}
          />

          {/* Diagnóstico descriptivo */}
          <FormTextarea
            label="Diagnóstico (descripción)"
            value={form.diagnosis}
            onChange={(v) => handleChange("diagnosis", v)}
            placeholder="Descripción del diagnóstico"
            rows={2}
          />

          {/* Plan de tratamiento */}
          <FormTextarea
            label="Plan de Tratamiento"
            value={form.treatment_plan}
            onChange={(v) => handleChange("treatment_plan", v)}
            placeholder="Plan de tratamiento propuesto, fases y procedimientos"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" type="button" icon={<X size={14} />} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          type="submit"
          icon={<Save size={14} />}
          disabled={!form.chief_complaint.trim() || saving}
        >
          {saving ? "Guardando..." : existing ? "Actualizar" : "Crear Historia Clínica"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Searchable, multi-select CIE-10 (dental) code picker. Stores the selected
 * codes as a comma-separated string in the same `cie10_code` field.
 */
function Cie10Search({
  value,
  onChange,
}: {
  value: string;
  onChange: (codes: string) => void;
}) {
  const { searchCie10 } = useClinicalHistory();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Cie10Code[]>([]);
  const [open, setOpen] = useState(false);
  // Remember descriptions of picked codes for display.
  const [descs, setDescs] = useState<Record<string, string>>({});

  // Current codes as an array (parsed from the comma-separated value).
  const codes = value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const runSearch = (q: string) => {
    setQuery(q);
    setOpen(true);
    searchCie10(q).then(setResults).catch(() => setResults([]));
  };

  const add = (c: Cie10Code) => {
    if (codes.includes(c.code)) {
      setOpen(false);
      setQuery("");
      return;
    }
    setDescs((prev) => ({ ...prev, [c.code]: c.description }));
    onChange([...codes, c.code].join(", "));
    setOpen(false);
    setQuery("");
  };

  const remove = (code: string) => {
    onChange(codes.filter((c) => c !== code).join(", "));
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        Códigos CIE-10 (opcional, puede agregar varios)
      </label>

      {/* Selected codes as chips */}
      {codes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-800"
              title={descs[code] || ""}
            >
              <span className="font-mono font-semibold">{code}</span>
              {descs[code] ? <span className="text-blue-700">— {descs[code]}</span> : null}
              <button
                type="button"
                onClick={() => remove(code)}
                className="ml-0.5 text-blue-500 hover:text-red-500"
                aria-label={`Quitar ${code}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search size={16} />
          </div>
          <input
            value={query}
            onFocus={() => runSearch(query)}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Buscar y agregar por código (K02) o descripción (caries)..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.map((c) => {
              const already = codes.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  disabled={already}
                  onClick={() => add(c)}
                  className={`flex w-full items-start gap-2 border-b border-gray-50 px-3 py-2 text-left last:border-b-0 ${
                    already ? "cursor-default opacity-40" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-blue-600">{c.code}</span>
                  <span className="text-sm text-gray-700">{c.description}</span>
                  {already && <span className="ml-auto text-xs text-gray-400">agregado</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
