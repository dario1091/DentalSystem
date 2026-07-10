import { useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@shared/components/ui";
import type { ClinicalHistory, CreateClinicalHistoryRequest, UpdateClinicalHistoryRequest } from "../types";

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

          {/* Diagnóstico */}
          <FormTextarea
            label="Diagnóstico (CIE-10)"
            value={form.diagnosis}
            onChange={(v) => handleChange("diagnosis", v)}
            placeholder="Diagnóstico según clasificación CIE-10"
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
