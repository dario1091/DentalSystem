import { useEffect, useState, type FormEvent } from "react";
import { Modal, Button, Input, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useProcedures } from "../hooks/useProcedures";
import { PROCEDURE_CATEGORIES, type CreateProcedureRequest } from "../types";

interface ProcedureFormModalProps {
  procedureId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProcedureFormModal({
  procedureId,
  onClose,
  onSuccess,
}: ProcedureFormModalProps) {
  const { toast } = useToast();
  const { getProcedure, createProcedure, updateProcedure } = useProcedures();
  const isEditing = procedureId !== null;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [form, setForm] = useState<CreateProcedureRequest>({
    code: "",
    name: "",
    category: "Consulta",
    description: null,
    base_price: 0,
    duration_minutes: 30,
  });

  useEffect(() => {
    if (isEditing && procedureId) {
      getProcedure(procedureId)
        .then((proc) => {
          setForm({
            code: proc.code,
            name: proc.name,
            category: proc.category,
            description: proc.description,
            base_price: proc.base_price,
            duration_minutes: proc.duration_minutes,
          });
        })
        .catch((err) => toast("error", String(err)))
        .finally(() => setFetching(false));
    }
  }, [procedureId]);

  const updateField = (field: string, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (form.base_price < 0) {
      toast("error", "El precio no puede ser negativo.");
      return;
    }

    setLoading(true);

    try {
      if (isEditing && procedureId) {
        await updateProcedure({
          id: procedureId,
          code: form.code,
          name: form.name,
          category: form.category,
          description: form.description,
          duration_minutes: form.duration_minutes,
        });
        toast("success", "Procedimiento actualizado.");
      } else {
        await createProcedure(form);
        toast("success", "Procedimiento creado.");
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
      title={isEditing ? "Editar Procedimiento" : "Nuevo Procedimiento"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            onClick={() =>
              (document.getElementById("procedure-form") as HTMLFormElement)?.requestSubmit()
            }
          >
            {isEditing ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      {fetching ? (
        <div className="py-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <form id="procedure-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código CUPS"
              value={form.code}
              onChange={(e) => updateField("code", e.target.value)}
              placeholder="Ej: 232101"
              required
            />
            <Select
              label="Categoría"
              options={[...PROCEDURE_CATEGORIES]}
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              required
            />
          </div>
          <Input
            label="Nombre del procedimiento"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Ej: Consulta odontológica de primera vez"
            required
          />
          <Input
            label="Descripción (opcional)"
            value={form.description || ""}
            onChange={(e) => updateField("description", e.target.value || null)}
            placeholder="Descripción detallada del procedimiento"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio base (COP)"
              type="number"
              value={String(form.base_price)}
              onChange={(e) => updateField("base_price", Number(e.target.value))}
              min="0"
              step="1000"
              required
            />
            <Input
              label="Duración (minutos)"
              type="number"
              value={String(form.duration_minutes || 30)}
              onChange={(e) => updateField("duration_minutes", Number(e.target.value))}
              min="5"
              step="5"
              required
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
