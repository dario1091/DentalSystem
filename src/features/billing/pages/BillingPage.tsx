import { useEffect, useState } from "react";
import { Receipt, Filter, TrendingUp, DollarSign, Clock } from "lucide-react";
import { Button, Badge } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useBilling } from "../hooks/useBilling";
import type { RevenueReport } from "../types";
import { INVOICE_STATUSES } from "../types";

export default function BillingPage() {
  const { toast } = useToast();
  const { getRevenueReport } = useBilling();

  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getRevenueReport(fromDate || null, toDate || null);
      setReport(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const formatMoney = (n: number) => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp size={24} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800">Reporte de Ingresos</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-gray-400" />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
        <span className="text-xs text-gray-400">—</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
        <Button variant="primary" size="sm" onClick={loadReport}>Consultar</Button>
        {(fromDate || toDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>Limpiar</Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando reporte...</div>
      ) : report ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-gray-500">
                <Receipt size={16} />
                <span className="text-xs">Total facturado</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-800">{formatMoney(report.total_invoiced)}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 text-green-600">
                <DollarSign size={16} />
                <span className="text-xs">Total cobrado</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-green-700">{formatMoney(report.total_paid)}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2 text-red-600">
                <Clock size={16} />
                <span className="text-xs">Pendiente por cobrar</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-700">{formatMoney(report.pending)}</p>
            </div>
          </div>

          {/* Invoice list */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">{report.invoices.length} facturas en el período</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {report.invoices.map((inv) => {
                const st = INVOICE_STATUSES[inv.status] ?? { label: inv.status, color: "neutral" };
                return (
                  <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{inv.invoice_number}</span>
                        <Badge variant={st.color as any}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{inv.patient_name} · {new Date(inv.created_at).toLocaleDateString("es-CO")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">{formatMoney(inv.total)}</p>
                      <p className="text-xs text-green-600">Pagado: {formatMoney(inv.amount_paid)}</p>
                    </div>
                  </div>
                );
              })}
              {report.invoices.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No hay facturas en el período seleccionado.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
