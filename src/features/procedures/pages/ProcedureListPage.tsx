import { useEffect, useState } from "react";
import { Plus, Edit, DollarSign, XCircle, Search } from "lucide-react";
import { Button, Badge, Table, Input, Select, type Column } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useProcedures } from "../hooks/useProcedures";
import { PROCEDURE_CATEGORIES, formatCurrency, type ProcedureSummary } from "../types";
import ProcedureFormModal from "../components/ProcedureFormModal";
import PriceUpdateModal from "../components/PriceUpdateModal";

export default function ProcedureListPage() {
  const { toast } = useToast();
  const { listProcedures, searchProcedures, deactivateProcedure } = useProcedures();

  const [procedures, setProcedures] = useState<ProcedureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priceModal, setPriceModal] = useState<{
    id: number;
    name: string;
    price: number;
  } | null>(null);

  const fetchProcedures = async () => {
    try {
      setLoading(true);
      let data: ProcedureSummary[];
      if (searchQuery.trim()) {
        data = await searchProcedures(searchQuery.trim());
      } else {
        data = await listProcedures(!showInactive, categoryFilter || null);
      }
      setProcedures(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcedures();
  }, [categoryFilter, showInactive]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProcedures();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeactivate = async (proc: ProcedureSummary) => {
    if (!confirm(`¿Desactivar "${proc.name}"? No aparecerá en nuevas citas.`)) return;
    try {
      await deactivateProcedure(proc.id);
      toast("success", "Procedimiento desactivado.");
      fetchProcedures();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const columns: Column<ProcedureSummary & Record<string, unknown>>[] = [
    {
      key: "code",
      header: "Código",
      sortable: true,
      render: (item) => (
        <span className="font-mono text-xs text-gray-600">{item.code}</span>
      ),
    },
    {
      key: "name",
      header: "Procedimiento",
      sortable: true,
      render: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: "category",
      header: "Categoría",
      sortable: true,
      render: (item) => (
        <Badge variant="info">{item.category}</Badge>
      ),
    },
    {
      key: "base_price",
      header: "Precio",
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-gray-900">{formatCurrency(item.base_price)}</span>
      ),
    },
    {
      key: "duration_minutes",
      header: "Duración",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-gray-500">{item.duration_minutes} min</span>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      render: (item) =>
        item.is_active ? (
          <Badge variant="success" dot>
            Activo
          </Badge>
        ) : (
          <Badge variant="neutral" dot>
            Inactivo
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (item) => (
        <div className="flex gap-1">
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
          <Button
            size="sm"
            variant="ghost"
            icon={<DollarSign size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setPriceModal({
                id: item.id,
                name: item.name,
                price: item.base_price,
              });
            }}
          >
            Precio
          </Button>
          {item.is_active && (
            <Button
              size="sm"
              variant="ghost"
              icon={<XCircle size={14} />}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Catálogo de Procedimientos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {procedures.filter((p) => p.is_active).length} procedimiento(s) activo(s)
            {categoryFilter && ` en "${categoryFilter}"`}
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
        >
          Nuevo Procedimiento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            label="Buscar"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre, código o categoría..."
            leftIcon={<Search size={16} className="text-gray-400" />}
          />
        </div>
        <div className="w-48">
          <Select
            label="Categoría"
            options={[{ value: "", label: "Todas" }, ...PROCEDURE_CATEGORIES]}
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setSearchQuery("");
            }}
          />
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Mostrar inactivos
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          Cargando procedimientos...
        </div>
      ) : (
        <Table
          columns={columns}
          data={procedures as (ProcedureSummary & Record<string, unknown>)[]}
          keyExtractor={(item) => item.id}
          emptyMessage="No se encontraron procedimientos."
        />
      )}

      {/* Modals */}
      {showForm && (
        <ProcedureFormModal
          procedureId={editingId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchProcedures();
          }}
        />
      )}

      {priceModal && (
        <PriceUpdateModal
          procedureId={priceModal.id}
          procedureName={priceModal.name}
          currentPrice={priceModal.price}
          onClose={() => setPriceModal(null)}
          onSuccess={() => {
            setPriceModal(null);
            fetchProcedures();
          }}
        />
      )}
    </div>
  );
}
