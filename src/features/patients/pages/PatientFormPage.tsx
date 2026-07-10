import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button, Input, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { usePatients } from "../hooks/usePatients";
import {
  DOCUMENT_TYPES,
  GENDERS,
  BLOOD_TYPES,
  MARITAL_STATUSES,
  type Patient,
  type CreatePatientRequest,
} from "../types";

export default function PatientFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { getPatient, createPatient, updatePatient } = usePatients();

  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  // Form state
  const [form, setForm] = useState<CreatePatientRequest>({
    document_type: "CC",
    document_number: "",
    first_name: "",
    last_name: "",
    birth_date: "",
    gender: "M",
    marital_status: null,
    phone: "",
    phone_secondary: null,
    email: null,
    address: null,
    eps: null,
    blood_type: null,
    allergies: null,
    current_medications: null,
    medical_history: null,
    guardian_name: null,
    guardian_relationship: null,
    guardian_phone: null,
    data_consent: false,
  });

  useEffect(() => {
    if (isEditing && id) {
      getPatient(Number(id))
        .then((patient: Patient) => {
          setForm({
            document_type: patient.document_type,
            document_number: patient.document_number,
            first_name: patient.first_name,
            last_name: patient.last_name,
            birth_date: patient.birth_date,
            gender: patient.gender,
            marital_status: patient.marital_status,
            phone: patient.phone,
            phone_secondary: patient.phone_secondary,
            email: patient.email,
            address: patient.address,
            eps: patient.eps,
            blood_type: patient.blood_type,
            allergies: patient.allergies,
            current_medications: patient.current_medications,
            medical_history: patient.medical_history,
            guardian_name: patient.guardian_name,
            guardian_relationship: patient.guardian_relationship,
            guardian_phone: patient.guardian_phone,
            data_consent: patient.data_consent,
          });
        })
        .catch((err) => toast("error", String(err)))
        .finally(() => setFetching(false));
    }
  }, [id]);

  const updateField = (field: string, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        await updatePatient({
          id: Number(id),
          document_type: form.document_type,
          document_number: form.document_number,
          first_name: form.first_name,
          last_name: form.last_name,
          birth_date: form.birth_date,
          gender: form.gender,
          marital_status: form.marital_status,
          phone: form.phone,
          phone_secondary: form.phone_secondary,
          email: form.email,
          address: form.address,
          eps: form.eps,
          blood_type: form.blood_type,
          allergies: form.allergies,
          current_medications: form.current_medications,
          medical_history: form.medical_history,
          guardian_name: form.guardian_name,
          guardian_relationship: form.guardian_relationship,
          guardian_phone: form.guardian_phone,
          data_consent: form.data_consent,
        });
        toast("success", "Paciente actualizado exitosamente.");
      } else {
        await createPatient(form);
        toast("success", "Paciente creado exitosamente.");
      }
      navigate("/patients");
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Cargando datos del paciente...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? "Editar Paciente" : "Nuevo Paciente"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section: Datos Personales */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">
            Datos Personales
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Tipo de documento"
              options={[...DOCUMENT_TYPES]}
              value={form.document_type}
              onChange={(e) => updateField("document_type", e.target.value)}
              required
            />
            <Input
              label="Número de documento"
              value={form.document_number}
              onChange={(e) => updateField("document_number", e.target.value)}
              required
            />
            <Input
              label="Nombres"
              value={form.first_name}
              onChange={(e) => updateField("first_name", e.target.value)}
              required
            />
            <Input
              label="Apellidos"
              value={form.last_name}
              onChange={(e) => updateField("last_name", e.target.value)}
              required
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.birth_date}
              onChange={(e) => updateField("birth_date", e.target.value)}
              required
            />
            <Select
              label="Género"
              options={[...GENDERS]}
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
              required
            />
            <Select
              label="Estado civil"
              options={[{ value: "", label: "— Seleccionar —" }, ...MARITAL_STATUSES]}
              value={form.marital_status || ""}
              onChange={(e) => updateField("marital_status", e.target.value)}
            />
          </div>
        </section>

        {/* Section: Contacto */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">
            Información de Contacto
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Teléfono celular (WhatsApp)"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="3001234567"
              required
            />
            <Input
              label="Teléfono secundario"
              value={form.phone_secondary || ""}
              onChange={(e) => updateField("phone_secondary", e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={form.email || ""}
              onChange={(e) => updateField("email", e.target.value)}
            />
            <Input
              label="Dirección"
              value={form.address || ""}
              onChange={(e) => updateField("address", e.target.value)}
            />
          </div>
        </section>

        {/* Section: Datos de Salud */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">
            Datos de Salud
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              label="EPS"
              value={form.eps || ""}
              onChange={(e) => updateField("eps", e.target.value)}
              placeholder="Si aplica"
            />
            <Select
              label="Grupo sanguíneo"
              options={[{ value: "", label: "— Seleccionar —" }, ...BLOOD_TYPES]}
              value={form.blood_type || ""}
              onChange={(e) => updateField("blood_type", e.target.value)}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Alergias conocidas</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={form.allergies || ""}
                onChange={(e) => updateField("allergies", e.target.value)}
                placeholder="Ninguna conocida"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Medicamentos actuales</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={form.current_medications || ""}
                onChange={(e) => updateField("current_medications", e.target.value)}
                placeholder="Ninguno"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Antecedentes médicos relevantes</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={form.medical_history || ""}
                onChange={(e) => updateField("medical_history", e.target.value)}
                placeholder="Diabetes, hipertensión, etc."
              />
            </div>
          </div>
        </section>

        {/* Section: Acudiente */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">
            Acudiente / Responsable
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Obligatorio para menores de edad.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Nombre del acudiente"
              value={form.guardian_name || ""}
              onChange={(e) => updateField("guardian_name", e.target.value)}
            />
            <Input
              label="Parentesco"
              value={form.guardian_relationship || ""}
              onChange={(e) => updateField("guardian_relationship", e.target.value)}
              placeholder="Madre, Padre, etc."
            />
            <Input
              label="Teléfono del acudiente"
              value={form.guardian_phone || ""}
              onChange={(e) => updateField("guardian_phone", e.target.value)}
            />
          </div>
        </section>

        {/* Section: Autorización de Datos */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">
            Autorización de Datos Personales
          </h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.data_consent}
              onChange={(e) => updateField("data_consent", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              El paciente autoriza el tratamiento de sus datos personales sensibles
              de salud de acuerdo con la Ley 1581 de 2012 (Habeas Data) y su
              decreto reglamentario 1377 de 2013.
            </span>
          </label>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate("/patients")}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} icon={<Save size={16} />}>
            {isEditing ? "Guardar Cambios" : "Registrar Paciente"}
          </Button>
        </div>
      </form>
    </div>
  );
}
