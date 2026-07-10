import { useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Modal, Button, Input, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "../hooks/useAppointments";
import { useProcedures } from "@features/procedures/hooks/useProcedures";
import { formatCurrency, calculateDiscount, type DiscountType } from "@features/procedures/types";
import type { ProcedureSummary } from "@features/procedures/types";

interface ProcedureSelectorProps {
  appointmentId: number;
  onClose: () => void;
  onAdded: () => void;
}

export default function ProcedureSelector({
  appointmentId,
  onClose,
  onAdded,
}: ProcedureSelectorProps) {
  const { toast } = useToast();
  const { addProcedure } = useAppointments();
  const { searchProcedures, listProcedures } = useProcedures();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProcedureSummary[]>([]);
  const [selected, setSelected] = useState<ProcedureSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Form for selected procedure
  const [quantity, setQuantity] = useState(1);
  const [discountType, setDiscountType] = useState<DiscountType | "">("");
  const [discountValue, setDiscountValue] = useState(0);
  const [toothNumber, setToothNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Load initial list
  useEffect(() => {
    listProcedures(true).then(setResults).catch(() => {});
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      listProcedures(true).then(setResults).catch(() => {});
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchProcedures(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectProcedure = (proc: ProcedureSummary) => {
    setSelected(proc);
    setQuantity(1);
    setDiscountType("");
    setDiscountValue(0);
    setToothNumber("");
    setNotes("");
  };

  const getFinalPrice = () => {
    if (!selected) return 0;
    const subtotal = selected.base_price * quantity;
    if (!discountType || discountValue <= 0) return subtotal;
    return calculateDiscount(subtotal, discountType as DiscountType, discountValue);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setLoading(true);
    try {
      await addProcedure({
        appointment_id: appointmentId,
        procedure_id: selected.id,
        quantity,
        unit_price: selected.base_price,
        discount_type: discountType || null,
        discount_value: discountValue || 0,
        tooth_number: toothNumber || null,
        notes: notes || null,
      });
      toast("success", `"${selected.name}" agregado a la cita.`);
      onAdded();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Agregar Procedimiento" size="lg">
      {!selected ? (
        // Search & select step
        <div className="space-y-4">
          <Input
            label="Buscar procedimiento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o código..."
            leftIcon={<Search size={16} />}
          />
          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            {results.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                No se encontraron procedimientos.
              </p>
            ) : (
              results.map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  className="flex w-full items-center justify-between border-b border-gray-50 px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
                  onClick={() => selectProcedure(proc)}
                >
                  <div>
                    <span className="text-xs font-mono text-gray-400">{proc.code} </span>
                    <span className="text-sm font-medium">{proc.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{proc.category}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatCurrency(proc.base_price)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        // Configure procedure step
        <form id="proc-add-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Selected procedure info */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-gray-400">{selected.code}</span>
                <p className="font-medium text-gray-900">{selected.name}</p>
              </div>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() => setSelected(null)}
              >
                Cambiar
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Precio: {formatCurrency(selected.base_price)} · {selected.duration_minutes} min
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cantidad"
              type="number"
              value={String(quantity)}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              min="1"
              required
            />
            <Input
              label="Diente (opcional)"
              value={toothNumber}
              onChange={(e) => setToothNumber(e.target.value)}
              placeholder="Ej: 11, 24, 36"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo de descuento"
              options={[
                { value: "", label: "Sin descuento" },
                { value: "percentage", label: "Porcentaje (%)" },
                { value: "fixed", label: "Valor fijo ($)" },
              ]}
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value as DiscountType | "");
                setDiscountValue(0);
              }}
            />
            {discountType && (
              <Input
                label={discountType === "percentage" ? "Descuento (%)" : "Descuento ($)"}
                type="number"
                value={String(discountValue)}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
              />
            )}
          </div>

          <Input
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas sobre este procedimiento"
          />

          {/* Price summary */}
          <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-600">
              {quantity > 1 && (
                <span>
                  {quantity} × {formatCurrency(selected.base_price)} ={" "}
                  {formatCurrency(selected.base_price * quantity)}
                </span>
              )}
              {discountType && discountValue > 0 && (
                <span className="ml-2 text-green-600">
                  - {discountType === "percentage" ? `${discountValue}%` : formatCurrency(discountValue)}
                </span>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-500">Total: </span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(getFinalPrice())}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button loading={loading} type="submit">
              Agregar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
