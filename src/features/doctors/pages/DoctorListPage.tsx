import { useEffect, useState } from "react";
import { Plus, Edit, UserX } from "lucide-react";
import { Button, Badge, Table, type Column } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useDoctors } from "../hooks/useDoctors";
import type { DoctorSummary } from "../types";
import DoctorFormModal from "../components/DoctorFormModal";

export default function DoctorListPage() {
  const { toast } = useToast();
  const { listDoctors, deactivateDoctor } = useDoctors();

  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchDoctors = async () => {
    try {
      const data = await listDoctors(false);
      setDoctors(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleDeactivate = async (doctor: DoctorSummary) => {
    if (!confirm(`¿Desactivar a Dr. ${doctor.first_name} ${doctor.last_name}?`)) return;
    try {
      await deactivateDoctor(doctor.id);
      toast("success", "Doctor desactivado.");
      fetchDoctors();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const columns: Column<DoctorSummary & Record<string, unknown>>[] = [
    {
      key: "last_name",
      header: "Nombre",
      sortable: true,
      render: (item) => (
        <span className="font-medium">
          Dr. {item.first_name} {item.last_name}
        </span>
      ),
    },
    { key: "professional_license", header: "Reg. Profesional", sortable: true },
    { key: "specialty", header: "Especialidad", sortable: true },
    {
      key: "is_active",
      header: "Estado",
      render: (item) =>
        item.is_active ? (
          <Badge variant="success" dot>Activo</Badge>
        ) : (
          <Badge variant="neutral" dot>Inactivo</Badge>
        ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (item) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Edit size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(item.id);
              setShowForm(true);
            }}
          >
            Editar
          </Button>
          {item.is_active && (
            <Button
              size="sm"
              variant="ghost"
              icon={<UserX size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeactivate(item);
              }}
            >
              Desactivar
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Cargando doctores...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Doctores</h1>
          <p className="mt-1 text-sm text-gray-500">
            {doctors.filter((d) => d.is_active).length} doctor(es) activo(s)
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
        >
          Nuevo Doctor
        </Button>
      </div>

      <Table
        columns={columns}
        data={doctors as (DoctorSummary & Record<string, unknown>)[]}
        keyExtractor={(item) => item.id}
        emptyMessage="No hay doctores registrados."
      />

      {showForm && (
        <DoctorFormModal
          doctorId={editingId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchDoctors();
          }}
        />
      )}
    </div>
  );
}
