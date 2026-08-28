import { useEffect, useState } from "react";
import { Plus, Receipt, Download, CreditCard, PiggyBank, Wallet, History, Undo2 } from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useBilling } from "../hooks/useBilling";
import type { Invoice, InvoiceDetail, PatientBalance, CreateInvoiceItemRequest, CreditMovement } from "../types";
import { INVOICE_STATUSES, PAYMENT_METHODS, CREDIT_MOVEMENT_LABELS, REFUND_PENALTY_RATE } from "../types";

interface BillingTabProps {
  patientId: number;
}

export default function BillingTab({ patientId }: BillingTabProps) {
  const { toast } = useToast();
  const {
    listInvoicesByPatient, getInvoice, getPatientBalance, addPayment, createInvoice, exportInvoicePdf,
    addPatientCredit, listCreditMovements, applyCreditToInvoice, refundPatientCredit,
  } = useBilling();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [balance, setBalance] = useState<PatientBalance | null>(null);
  const [movements, setMovements] = useState<CreditMovement[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("efectivo");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);
  const [useCredit, setUseCredit] = useState(false); // aplicar saldo a favor en vez de pago normal

  // Deposit (abono) form
  const [depAmount, setDepAmount] = useState("");
  const [depMethod, setDepMethod] = useState("efectivo");
  const [depRef, setDepRef] = useState("");
  const [depNotes, setDepNotes] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Refund form
  const [refMethod, setRefMethod] = useState("efectivo");
  const [refunding, setRefunding] = useState(false);

  // Create form
  const [items, setItems] = useState<CreateInvoiceItemRequest[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [inv, bal, mov] = await Promise.all([
        listInvoicesByPatient(patientId),
        getPatientBalance(patientId),
        listCreditMovements(patientId),
      ]);
      setInvoices(inv);
      setBalance(bal);
      setMovements(mov);
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
    const amount = parseFloat(payAmount);
    const availableCredit = balance?.available_credit ?? 0;

    if (useCredit && amount > availableCredit) {
      toast("error", `Saldo a favor insuficiente. Disponible: ${formatMoney(availableCredit)}.`);
      return;
    }

    setPaying(true);
    try {
      if (useCredit) {
        // Aplicar saldo a favor a la factura (no es un pago externo).
        await applyCreditToInvoice({
          patient_id: patientId,
          invoice_id: showPayment,
          amount,
          notes: payRef || null,
        });
        toast("success", "Saldo a favor aplicado a la factura.");
      } else {
        await addPayment({
          invoice_id: showPayment,
          amount,
          payment_method: payMethod,
          reference: payRef || null,
        });
        toast("success", "Pago registrado.");
      }
      const invoiceId = showPayment;
      setShowPayment(null);
      setPayAmount("");
      setPayRef("");
      setUseCredit(false);
      await loadData();
      if (selectedInvoice?.invoice.id === invoiceId) {
        handleViewInvoice(invoiceId);
      }
    } catch (err) { toast("error", String(err)); }
    finally { setPaying(false); }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depAmount);
    if (!amount || amount <= 0) {
      toast("error", "Ingrese un monto válido.");
      return;
    }
    setDepositing(true);
    try {
      await addPatientCredit({
        patient_id: patientId,
        amount,
        payment_method: depMethod,
        reference: depRef || null,
        notes: depNotes || null,
      });
      toast("success", `Abono de ${formatMoney(amount)} registrado.`);
      setShowDeposit(false);
      setDepAmount("");
      setDepRef("");
      setDepNotes("");
      await loadData();
    } catch (err) { toast("error", String(err)); }
    finally { setDepositing(false); }
  };

  const handleRefund = async () => {
    setRefunding(true);
    try {
      const result = await refundPatientCredit({
        patient_id: patientId,
        payment_method: refMethod,
      });
      toast(
        "success",
        `Devolución: se entregaron ${formatMoney(result.refunded_amount)} (retención ${formatMoney(result.penalty_amount)}).`,
      );
      setShowRefund(false);
      await loadData();
    } catch (err) { toast("error", String(err)); }
    finally { setRefunding(false); }
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Total facturado" value={formatMoney(balance.total_invoiced)} />
          <StatCard label="Total pagado" value={formatMoney(balance.total_paid)} color="green" />
          <StatCard label="Saldo pendiente" value={formatMoney(balance.balance_due)} color={balance.balance_due > 0 ? "red" : "green"} />
          <StatCard label="Saldo a favor" value={formatMoney(balance.available_credit)} color={balance.available_credit > 0 ? "blue" : undefined} />
          <StatCard label="Facturas" value={String(balance.invoice_count)} />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{invoices.length} factura(s)</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<History size={14} />} onClick={() => setShowHistory(true)}>
            Movimientos
          </Button>
          {(balance?.available_credit ?? 0) > 0 && (
            <Button variant="ghost" size="sm" icon={<Undo2 size={14} />} onClick={() => setShowRefund(true)}>
              Devolver saldo
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<PiggyBank size={14} />} onClick={() => setShowDeposit(true)}>
            Registrar abono
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            Nueva Factura
          </Button>
        </div>
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
        <Modal isOpen onClose={() => { setShowPayment(null); setUseCredit(false); }} title="Registrar Pago" size="sm">
          <div className="space-y-4">
            {/* Usar saldo a favor (opcional) */}
            {(balance?.available_credit ?? 0) > 0 && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <input
                  type="checkbox"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-blue-800">
                  Usar saldo a favor
                  <span className="block text-xs text-blue-600">
                    Disponible: {formatMoney(balance!.available_credit)}
                  </span>
                </span>
              </label>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto ($)</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" min="1" />
            </div>
            {!useCredit && (
              <>
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
              </>
            )}
            {useCredit && (
              <p className="text-xs text-gray-500">Se descontará del saldo a favor del paciente y se registrará como pago de esta factura.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setShowPayment(null); setUseCredit(false); }}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handlePayment} disabled={!payAmount || paying}>
                {paying ? "Procesando..." : useCredit ? "Aplicar saldo" : "Registrar Pago"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deposit (abono) Modal */}
      {showDeposit && (
        <Modal isOpen onClose={() => setShowDeposit(false)} title="Registrar abono / anticipo" size="sm">
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              El dinero queda como saldo a favor del paciente y puede usarse en cualquier factura futura.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto ($)</label>
              <input type="number" value={depAmount} onChange={(e) => setDepAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" min="1" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Método de pago</label>
              <select value={depMethod} onChange={(e) => setDepMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Motivo / nota (opcional)</label>
              <input type="text" value={depNotes} onChange={(e) => setDepNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Ej: Prótesis fija" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Referencia (opcional)</label>
              <input type="text" value={depRef} onChange={(e) => setDepRef(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="No. transferencia, voucher, etc." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowDeposit(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleDeposit} disabled={!depAmount || depositing}>{depositing ? "Registrando..." : "Registrar abono"}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Refund Modal */}
      {showRefund && balance && (
        <Modal isOpen onClose={() => setShowRefund(false)} title="Devolver saldo a favor" size="sm">
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>Se devuelve el saldo completo con una retención del {Math.round(REFUND_PENALTY_RATE * 100)}%.</p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span>Saldo actual:</span><span className="font-medium">{formatMoney(balance.available_credit)}</span></div>
                <div className="flex justify-between"><span>Retención ({Math.round(REFUND_PENALTY_RATE * 100)}%):</span><span className="font-medium">- {formatMoney(balance.available_credit * REFUND_PENALTY_RATE)}</span></div>
                <div className="flex justify-between border-t border-amber-200 pt-1 text-sm font-bold"><span>A entregar:</span><span>{formatMoney(balance.available_credit * (1 - REFUND_PENALTY_RATE))}</span></div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Método de devolución</label>
              <select value={refMethod} onChange={(e) => setRefMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowRefund(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleRefund} disabled={refunding}>{refunding ? "Procesando..." : "Confirmar devolución"}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Credit movements history Modal */}
      {showHistory && (
        <Modal isOpen onClose={() => setShowHistory(false)} title="Movimientos de saldo a favor" size="lg">
          {movements.length === 0 ? (
            <div className="py-8 text-center">
              <Wallet size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">Sin movimientos de saldo a favor.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => {
                const lbl = CREDIT_MOVEMENT_LABELS[m.movement_type] ?? { label: m.movement_type, color: "neutral" };
                const isIncoming = m.movement_type === "deposit";
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={lbl.color as any}>{lbl.label}</Badge>
                        {m.invoice_number && <span className="text-xs text-gray-500">{m.invoice_number}</span>}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(m.created_at).toLocaleString("es-CO")}
                        {m.created_by_name ? ` · ${m.created_by_name}` : ""}
                        {m.notes ? ` · ${m.notes}` : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${isIncoming ? "text-green-600" : "text-gray-700"}`}>
                      {isIncoming ? "+" : "-"} {formatMoney(m.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
  const textColor =
    color === "green" ? "text-green-600"
    : color === "red" ? "text-red-600"
    : color === "blue" ? "text-blue-600"
    : "text-gray-800";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
