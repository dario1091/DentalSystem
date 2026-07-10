import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, UserX, UserCheck } from "lucide-react";
import { Button, Input, Badge, Table, type Column } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { usePatients } from "../hooks/usePatients";
import type { PatientSummary } from "../types";

export default function PatientListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { searchPatients, countPatients } = usePatients();

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPatients = useCallback(async () => {
    try {
      const [results, count] = await Promise.all([
        searchPatients({
          query: searchQuery || null,
          active_only: !showInactive,
          limit: 100,
          offset: null,
        }),
        countPatients(!showInactive),
      ]);
      setPatients(results);
      setTotalCount(count);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, showInactive]);

  useEffect(() => {
    setLoading(true);
    const debounce = setTimeout(fetchPatients, 300);
    return () => clearTimeout(debounce);
  }, [fetchPatients]);

  const columns: Column<PatientSummary & Record<string, unknown>>[] = [
    {
      key: "last_name",
      header: "Nombre",
      sortable: true,
      render: (item) => (
        <span className="font-medium">
          {item.last_name}, {item.first_name}
        </span>
      ),
    },
    {
      key: "document_number",
      header: "Documento",
      sortable: true,
      render: (item) => (
        <span className="text-gray-600">
          {item.document_type} {item.document_number}
        </span>
      ),
    },
    { key: "phone", header: "Teléfono", sortable: true },
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
      key: "created_at",
      header: "Registro",
      sortable: true,
      render: (item) => (
        <span className="text-xs text-gray-500">
          {new Date(item.created_at).toLocaleDateString("es-CO")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pacientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} paciente{totalCount !== 1 ? "s" : ""} registrado{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => navigate("/patients/new")}
        >
          Nuevo Paciente
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nombre, documento o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
        <Button
          variant={showInactive ? "secondary" : "ghost"}
          size="sm"
          icon={showInactive ? <UserX size={16} /> : <UserCheck size={16} />}
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? "Mostrando todos" : "Solo activos"}
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          Cargando pacientes...
        </div>
      ) : (
        <Table
          columns={columns}
          data={patients as (PatientSummary & Record<string, unknown>)[]}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => navigate(`/patients/${item.id}`)}
          emptyMessage={
            searchQuery
              ? "No se encontraron pacientes con esos criterios."
              : "No hay pacientes registrados. Cree el primero."
          }
          pageSize={15}
        />
      )}
    </div>
  );
}
