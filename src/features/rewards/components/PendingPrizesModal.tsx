import { useEffect, useState } from "react";
import { Clock, Gift } from "lucide-react";
import { Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useRewards } from "../hooks/useRewards";
import type { PatientPrize } from "../types";

interface PendingPrizesModalProps {
  onClose: () => void;
}

export default function PendingPrizesModal({ onClose }: PendingPrizesModalProps) {
  const { toast } = useToast();
  const { listPendingPrizes } = useRewards();
  const [prizes, setPrizes] = useState<PatientPrize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPendingPrizes()
      .then(setPrizes)
      .catch((err) => toast("error", String(err)))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-CO") : "Sin vencimiento");

  return (
    <Modal isOpen onClose={onClose} title="Premios pendientes por canjear" size="lg">
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
      ) : prizes.length === 0 ? (
        <div className="py-8 text-center">
          <Gift size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No hay premios pendientes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prizes.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.prize_name}</p>
                <p className="text-xs text-gray-500">{p.patient_name}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <Clock size={12} />
                Vence: {formatDate(p.expires_at)}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Para canjear un premio, entre a la ficha del paciente → pestaña Premios.
      </p>
    </Modal>
  );
}
