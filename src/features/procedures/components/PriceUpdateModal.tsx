import { useEffect, useState, type FormEvent } from "react";
import { Modal, Button, Input } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useProcedures } from "../hooks/useProcedures";
import { formatCurrency, type PriceHistoryEntry } from "../types";

interface PriceUpdateModalProps {
  procedureId: number;
  procedureName: string;
  currentPrice: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PriceUpdateModal({
  procedureId,
  procedureName,
  currentPrice,
  onClose,
  onSuccess,
}: PriceUpdateModalProps) {
  const { toast } = useToast();
  const { updatePrice, getPriceHistory } = useProcedures();

  const [newPrice, setNewPrice] = useState(currentPrice);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    getPriceHistory(procedureId)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [procedureId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (newPrice < 0) {
      toast("error", "El precio no puede ser negativo.");
      return;
    }

    if (newPrice === currentPrice) {
      toast("error", "El nuevo precio es igual al actual.");
      return;
    }

    setLoading(true);
    try {
      await updatePrice({
        procedure_id: procedureId,
        new_price: newPrice,
        reason: reason || null,
      });
      toast("success", "Precio actualizado.");
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
      title="Actualizar Precio"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            onClick={() =>
              (document.getElementById("price-form") as HTMLFormElement)?.requestSubmit()
            }
          >
            Actualizar Precio
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm text-gray-600">Procedimiento:</p>
          <p className="font-medium text-gray-900">{procedureName}</p>
          <p className="mt-1 text-sm text-gray-500">
            Precio actual: <span className="font-semibold">{formatCurrency(currentPrice)}</span>
          </p>
        </div>

        <form id="price-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nuevo precio (COP)"
            type="number"
            value={String(newPrice)}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            min="0"
            step="1000"
            required
          />
          <Input
            label="Razón del cambio (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Actualización anual de tarifas"
          />
        </form>

        {/* Price History */}
        {!loadingHistory && history.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Historial de precios</h4>
            <div className="max-h-40 overflow-y-auto rounded border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left text-gray-500">Fecha</th>
                    <th className="px-2 py-1 text-right text-gray-500">Anterior</th>
                    <th className="px-2 py-1 text-right text-gray-500">Nuevo</th>
                    <th className="px-2 py-1 text-left text-gray-500">Razón</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-100">
                      <td className="px-2 py-1 text-gray-600">
                        {new Date(entry.changed_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-2 py-1 text-right text-red-500 line-through">
                        {formatCurrency(entry.old_price)}
                      </td>
                      <td className="px-2 py-1 text-right font-medium text-green-600">
                        {formatCurrency(entry.new_price)}
                      </td>
                      <td className="px-2 py-1 text-gray-500">{entry.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
