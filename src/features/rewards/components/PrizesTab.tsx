import { useEffect, useState } from "react";
import { Gift, Check, Clock } from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useRewards } from "../hooks/useRewards";
import type { PatientPrize } from "../types";
import { PRIZE_STATUSES } from "../types";

interface PrizesTabProps {
  patientId: number;
}

export default function PrizesTab({ patientId }: PrizesTabProps) {
  const { toast } = useToast();
  const { listPatientPrizes, redeemPrize } = useRewards();

  const [prizes, setPrizes] = useState<PatientPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<PatientPrize | null>(null);

  const load = async () => {
    try {
      setPrizes(await listPatientPrizes(patientId));
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const handleRedeem = async (p: PatientPrize) => {
    setRedeeming(p.id);
    try {
      await redeemPrize({ patient_prize_id: p.id });
      toast("success", "Premio canjeado.");
      setConfirming(null);
      await load();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setRedeeming(null);
    }
  };

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-CO") : "—");

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Cargando premios...</div>;

  if (prizes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <Gift size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">Este paciente no ha ganado premios todavía.</p>
      </div>
    );
  }

  const pending = prizes.filter((p) => p.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{prizes.length} premio(s) · {pending.length} pendiente(s)</p>
      </div>

      <div className="space-y-2">
        {prizes.map((p) => {
          const st = PRIZE_STATUSES[p.status] ?? { label: p.status, color: "neutral" };
          return (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-blue-500" />
                  <span className="text-sm font-medium text-gray-800">{p.prize_name}</span>
                  <Badge variant={st.color as any}>{st.label}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>Ganado: {formatDate(p.won_at)}</span>
                  {p.status === "pending" && p.expires_at && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock size={11} /> Vence: {formatDate(p.expires_at)}
                    </span>
                  )}
                  {p.status === "redeemed" && <span>Canjeado: {formatDate(p.redeemed_at)}</span>}
                </p>
              </div>
              {p.status === "pending" && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Check size={14} />}
                  onClick={() => setConfirming(p)}
                  disabled={redeeming === p.id}
                >
                  {redeeming === p.id ? "..." : "Canjear"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmación de canje */}
      {confirming && (
        <Modal isOpen onClose={() => setConfirming(null)} title="Confirmar canje" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              ¿Marcar <span className="font-semibold">{confirming.prize_name}</span> como canjeado?
            </p>
            <p className="text-xs text-gray-500">
              Esta acción registra que el paciente ya recibió el premio. No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Check size={14} />}
                onClick={() => handleRedeem(confirming)}
                disabled={redeeming === confirming.id}
              >
                {redeeming === confirming.id ? "Canjeando..." : "Sí, canjear"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
