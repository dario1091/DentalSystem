import { useEffect, useState } from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Modal, Button } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "@features/appointments/hooks/useAppointments";
import { useBilling } from "@features/billing/hooks/useBilling";
import type { CreateInvoiceItemRequest } from "@features/billing/types";
import { PAYMENT_METHODS } from "@features/billing/types";

interface InvoiceFromAppointmentModalProps {
  appointmentId: number;
  patientId: number;
  onClose: () => void;
  onCompleted: () => void;
}

interface EditableItem {
  id: string;
  procedure_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export default function InvoiceFromAppointmentModal({
  appointmentId,
  patientId,
  onClose,
  onCompleted,
}: InvoiceFromAppointmentModalProps) {
  const { toast } = useToast();
  const { getAppointmentProcedures, changeStatus } = useAppointments();
  const { createInvoice, addPayment } = useBilling();

  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Payment options
  const [collectNow, setCollectNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  useEffect(() => {
    loadProcedures();
  }, [appointmentId]);

  const loadProcedures = async () => {
    try {
      const procs = await getAppointmentProcedures(appointmentId);
      const editableItems: EditableItem[] = procs.map((p, idx) => ({
        id: `proc-${idx}`,
        procedure_id: p.procedure_id,
        description: p.procedure_name || "Procedimiento",
        quantity: p.quantity,
        unit_price: p.unit_price,
        discount: p.discount_value || 0,
      }));
      setItems(editableItems);
      // Default payment amount = total
      const total = editableItems.reduce((acc, i) => acc + (i.quantity * i.unit_price - i.discount), 0);
      setPaymentAmount(total.toString());
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  const total = items.reduce((acc, i) => acc + (i.quantity * i.unit_price - i.discount), 0);

  const updateItem = (id: string, field: keyof EditableItem, value: any) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, procedure_id: null, description: "", quantity: 1, unit_price: 0, discount: 0 },
    ]);
  };

  const handleConfirm = async () => {
    const validItems = items.filter((i) => i.description && i.unit_price > 0);
    if (validItems.length === 0) {
      toast("error", "Agregue al menos un procedimiento a facturar.");
      return;
    }

    setProcessing(true);
    try {
      // 1. Create invoice from items
      const invoiceItems: CreateInvoiceItemRequest[] = validItems.map((i) => ({
        procedure_id: i.procedure_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount > 0 ? i.discount : undefined,
      }));

      const invoice = await createInvoice({
        patient_id: patientId,
        appointment_id: appointmentId,
        items: invoiceItems,
      });

      // 2. Register payment if collecting now
      if (collectNow && paymentAmount && parseFloat(paymentAmount) > 0) {
        await addPayment({
          invoice_id: invoice.id,
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          reference: paymentRef || null,
        });
      }

      // 3. Mark appointment as completed
      await changeStatus({ appointment_id: appointmentId, new_status: "completed" });

      toast("success", `Cita completada. Factura ${invoice.invoice_number} generada.`);
      onCompleted();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setProcessing(false);
    }
  };

  const formatMoney = (n: number) => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <Modal isOpen onClose={onClose} title="Completar cita y facturar" size="lg">
        <div className="py-8 text-center text-gray-400">Cargando procedimientos...</div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Completar cita y facturar" size="xl">
      <div className="space-y-5">
        {/* Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Procedimientos a facturar</h4>
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addItem}>
              Agregar ítem
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded border border-gray-200 p-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  placeholder="Descripción"
                  className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                  className="w-14 rounded border border-gray-300 px-2 py-1.5 text-center text-sm"
                  min="1"
                  title="Cantidad"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1.5 text-xs text-gray-400">$</span>
                  <input
                    type="number"
                    value={item.unit_price || ""}
                    onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                    className="w-28 rounded border border-gray-300 py-1.5 pl-5 pr-2 text-sm"
                    min="0"
                    placeholder="Precio"
                  />
                </div>
                <span className="w-24 text-right text-sm font-medium text-gray-700">
                  {formatMoney(item.quantity * item.unit_price - item.discount)}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {items.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">
                No hay procedimientos. Agregue al menos uno para facturar.
              </p>
            )}
          </div>

          {/* Total */}
          <div className="mt-3 flex justify-end border-t border-gray-200 pt-3">
            <span className="text-lg font-bold text-gray-800">Total: {formatMoney(total)}</span>
          </div>
        </div>

        {/* Payment section */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={collectNow}
              onChange={(e) => setCollectNow(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">Registrar pago ahora</span>
          </label>

          {collectNow && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Monto ($)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  min="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Método</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Referencia</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Opcional"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={<Receipt size={14} />}
            onClick={handleConfirm}
            disabled={processing || items.length === 0}
          >
            {processing ? "Procesando..." : "Completar cita y generar factura"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
