import { useEffect, useState } from "react";
import { Plus, Receipt, Download, CreditCard } from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useBilling } from "../hooks/useBilling";
import type { Invoice, InvoiceDetail, PatientBalance, CreateInvoiceItemRequest } from "../types";
import { INVOICE_STATUSES, PAYMENT_METHODS } from "../types";

interface BillingTabProps {
  patientId: number;
}

export default function BillingTab({ patientId }: BillingTabProps) {
  const { toast } = useToast();
  const { listInvoicesByPatient, getInvoice, getPatientBalance, addPayment, createInvoice, exportInvoicePdf } = useBilling();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [balance, setBalance] = useState<PatientBalance | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("efectivo");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);

  // Create form
  const [items, setItems] = useState<CreateInvoiceItemRequest[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [inv, bal] = await Promise.all([
        listInvoicesByPatient(patientId),
        getPatientBalance(patientId),
      ]);
      setInvoices(inv);
      setBalance(bal);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [patientId]);

  const handleViewInvoice = async (id: number) => {
    try {
      const detail = await getInvoice(id);
      setSelectedInvoice(detail);
    } catch (err) { toast("error", String(err)); }
  };

  const handlePayment = async () => {
    if (!showPayment || !payAmount) return;
    setPaying(true);
    try {
      await addPayment({
        invoice_id: showPayment,
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        reference: payRef || null,
      });
      toast("success", "Pago registrado.");
      setShowPayment(null);
      setPayAmount("");
      setPayRef("");
      await loadData();
      if (selectedInvoice?.invoice.id === showPayment) {
        handleViewInvoice(showPayment);
      }
    } catch (err) { toast("error", String(err)); }
    finally { setPaying(false); }
  };

  const handleExportPdf = async (invoiceId: number) => {
    try {
      const path = await exportInvoicePdf(invoiceId);
      toast("success", `Recibo exportado: ${path.split(/[\\/]/).pop()}`);
    } catch (err) { toast("error", String(err)); }
  };

  const handleCreateInvoice = async () => {
    const validItems = items.filter(i => i.description && i.unit_price > 0);
    if (validItems.length === 0) return;
    setCreating(true);
    try {
      await createInvoice({ patient_id: patientId, items: validItems });
      toast("success", "Factura creada.");
      setShowCreate(false);
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      await loadData();
    } catch (err) { toast("error", String(err)); }
    finally { setCreating(false); }
  };

  const formatMoney = (n: number) => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`;

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Cargando facturación...</div>;

  return (
    <div className="space-y-6">
      {/* Balance summary */}
      {balance && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Total facturado" value={formatMoney(balance.total_invoiced)} />
          <StatCard label="Total pagado" value={formatMoney(balance.total_paid)} color="green" />
          <StatCard label="Saldo pendiente" value={formatMoney(balance.balance_due)} color={balance.balance_due > 0 ? "red" : "green"} />
          <StatCard label="Facturas" value={String(balance.invoice_count)} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{invoices.length} factura(s)</p>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
          Nueva Factura
        </Button>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Receipt size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No hay facturas registradas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const st = INVOICE_STATUSES[inv.status] ?? { label: inv.status, color: "neutral" };
            return (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div className="cursor-pointer" onClick={() => handleViewInvoice(inv.id)}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{inv.invoice_number}</p>
                    <Badge variant={st.color as any}>{st.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(inv.created_at).toLocaleDateString("es-CO")} · Total: {formatMoney(inv.total)} · Pagado: {formatMoney(inv.amount_paid)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {inv.status !== "paid" && inv.status !== "cancelled" && (
                    <Button variant="ghost" size="sm" icon={<CreditCard size={14} />} onClick={() => setShowPayment(inv.id)}>
                      Abonar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => handleExportPdf(inv.id)}>
                    PDF
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <Modal isOpen onClose={() => setSelectedInvoice(null)} title={`Detalle ${selectedInvoice.invoice.invoice_number}`} size="lg">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Procedimientos</h4>
              {selectedInvoice.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.description} x{item.quantity}</span>
                  <span className="font-medium">{formatMoney(item.total)}</span>
                </div>
              ))}
              <div className="border-t pt-2 text-right font-bold">Total: {formatMoney(selectedInvoice.invoice.total)}</div>
            </div>
            {selectedInvoice.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Pagos</h4>
                {selectedInvoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm text-gray-600">
                    <span>{new Date(p.created_at).toLocaleDateString("es-CO")} - {p.payment_method}</span>
                    <span className="font-medium text-green-600">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <Modal isOpen onClose={() => setShowPayment(null)} title="Registrar Pago" size="sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto ($)</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" min="1" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Método de pago</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Referencia (opcional)</label>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="No. transferencia, voucher, etc." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowPayment(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handlePayment} disabled={!payAmount || paying}>{paying ? "Registrando..." : "Registrar Pago"}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <Modal isOpen onClose={() => setShowCreate(false)} title="Nueva Factura" size="lg">
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Agregue los procedimientos o ítems a facturar.</p>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input type="text" placeholder="Descripción" value={item.description} onChange={(e) => { const n = [...items]; n[idx] = {...n[idx], description: e.target.value}; setItems(n); }} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
                <input type="number" placeholder="Cant" value={item.quantity} onChange={(e) => { const n = [...items]; n[idx] = {...n[idx], quantity: parseInt(e.target.value) || 1}; setItems(n); }} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm" min="1" />
                <input type="number" placeholder="Precio" value={item.unit_price || ""} onChange={(e) => { const n = [...items]; n[idx] = {...n[idx], unit_price: parseFloat(e.target.value) || 0}; setItems(n); }} className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm" min="0" />
              </div>
            ))}
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}>
              Agregar ítem
            </Button>
            <div className="text-right font-bold text-gray-800">
              Total: {formatMoney(items.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleCreateInvoice} disabled={creating}>{creating ? "Creando..." : "Crear Factura"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const textColor = color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : "text-gray-800";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
