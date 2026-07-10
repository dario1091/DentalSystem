import { useEffect, useState, type FormEvent } from "react";
import { Modal, Button, Input, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useDoctors } from "../hooks/useDoctors";
import { SPECIALTIES, type CreateDoctorRequest } from "../types";

const docTypeOptions = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PP", label: "Pasaporte" },
];

interface DoctorFormModalProps {
  doctorId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DoctorFormModal({ doctorId, onClose, onSuccess }: DoctorFormModalProps) {
  const { toast } = useToast();
  const { getDoctor, createDoctor, updateDoctor } = useDoctors();
  const isEditing = doctorId !== null;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [form, setForm] = useState<CreateDoctorRequest>({
    document_type: "CC",
    document_number: "",
    first_name: "",
    last_name: "",
    professional_license: "",
    specialty: "Odontología General",
    university: null,
    phone: "",
    email: null,
  });

  useEffect(() => {
    if (isEditing && doctorId) {
      getDoctor(doctorId)
        .then((doc) => {
          setForm({
            document_type: doc.document_type,
            document_number: doc.document_number,
            first_name: doc.first_name,
            last_name: doc.last_name,
            professional_license: doc.professional_license,
            specialty: doc.specialty,
            university: doc.university,
            phone: doc.phone,
            email: doc.email,
          });
        })
        .catch((err) => toast("error", String(err)))
        .finally(() => setFetching(false));
    }
  }, [doctorId]);

  const updateField = (field: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing && doctorId) {
        await updateDoctor({
          id: doctorId,
          document_type: form.document_type,
          document_number: form.document_number,
          first_name: form.first_name,
          last_name: form.last_name,
          professional_license: form.professional_license,
          specialty: form.specialty,
          university: form.university,
          phone: form.phone,
          email: form.email,
        });
        toast("success", "Doctor actualizado.");
      } else {
        await createDoctor(form);
        toast("success", "Doctor registrado.");
      }
      onSuccess();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? "Editar Doctor" : "Nuevo Doctor"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            loading={loading}
            onClick={() => (document.getElementById("doctor-form") as HTMLFormElement)?.requestSubmit()}
          >
            {isEditing ? "Guardar" : "Registrar"}
          </Button>
        </>
      }
    >
      {fetching ? (
        <div className="py-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <form id="doctor-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo documento"
              options={docTypeOptions}
              value={form.document_type}
              onChange={(e) => updateField("document_type", e.target.value)}
              required
            />
            <Input
              label="Número documento"
              value={form.document_number}
              onChange={(e) => updateField("document_number", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Registro profesional"
              value={form.professional_license}
              onChange={(e) => updateField("professional_license", e.target.value)}
              placeholder="Tarjeta profesional"
              required
            />
            <Select
              label="Especialidad"
              options={[...SPECIALTIES]}
              value={form.specialty}
              onChange={(e) => updateField("specialty", e.target.value)}
              required
            />
          </div>
          <Input
            label="Universidad"
            value={form.university || ""}
            onChange={(e) => updateField("university", e.target.value)}
            placeholder="Universidad de egreso"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email || ""}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
