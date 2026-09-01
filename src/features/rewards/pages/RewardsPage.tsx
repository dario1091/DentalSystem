import { useEffect, useMemo, useState } from "react";
import { Gift, Search, Settings2, Clock, Sparkles } from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAuthStore } from "@store/auth-store";
import { usePatients } from "@features/patients/hooks/usePatients";
import type { PatientSummary } from "@features/patients/types";
import { useRewards } from "../hooks/useRewards";
import type { Prize, PatientPrize } from "../types";
import { PRIZE_STATUSES } from "../types";
import SpinWheel from "../components/SpinWheel";
import PrizesAdmin from "../components/PrizesAdmin";
import PendingPrizesModal from "../components/PendingPrizesModal";

export default function RewardsPage() {
  const { toast } = useToast();
  const isMaster = useAuthStore((s) => s.user?.role === "master");
  const { searchPatients } = usePatients();
  const { listPrizes, spinWheel } = useRewards();

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);

  // Selección de paciente
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);

  // Ruleta
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<PatientPrize | null>(null);

  // Tamaño responsive: la ruleta ocupa el máximo espacio vertical disponible.
  const [wheelSize, setWheelSize] = useState(520);
  useEffect(() => {
    const computeSize = () => {
      // Deja margen para header, paddings y el panel lateral.
      const byHeight = window.innerHeight - 220;
      const byWidth = window.innerWidth - 460;
      setWheelSize(Math.max(360, Math.min(byHeight, byWidth, 640)));
    };
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

  // Modales
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPending, setShowPending] = useState(false);

  const segAngle = useMemo(() => (prizes.length ? 360 / prizes.length : 0), [prizes.length]);

  const loadPrizes = async () => {
    try {
      setPrizes(await listPrizes(true));
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPrizes(); }, []);

  // Búsqueda de pacientes (debounce simple)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const found = await searchPatients({ query, active_only: true, limit: 8 });
        setResults(found);
      } catch (err) {
        toast("error", String(err));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleSpin = async () => {
    if (!selectedPatient) {
      toast("error", "Seleccione un paciente antes de girar.");
      return;
    }
    if (prizes.length === 0) {
      toast("error", "No hay premios configurados.");
      return;
    }
    setSpinning(true);
    setWonPrize(null);
    try {
      const result = await spinWheel({ patient_id: selectedPatient.id });

      // Encontrar el índice del premio ganado en la ruleta visible.
      const idx = prizes.findIndex((p) => p.id === result.prize_id);
      const targetIdx = idx >= 0 ? idx : 0;

      // Ángulo del centro del segmento; rotamos para que quede arriba (bajo el puntero).
      const center = targetIdx * segAngle + segAngle / 2;
      const spins = 7; // vueltas completas para más suspenso
      const finalRotation = 360 * spins - center;

      // Reiniciar a una base múltiplo de 360 para que siempre gire hacia adelante.
      setRotation((prev) => {
        const base = Math.ceil(prev / 360) * 360;
        return base + finalRotation;
      });

      // Mostrar el resultado cuando termina la animación (coincide con el transition de 5.5s).
      setTimeout(() => {
        setWonPrize(result);
        setSpinning(false);
      }, 5600);
    } catch (err) {
      toast("error", String(err));
      setSpinning(false);
    }
  };

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("es-CO") : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gift size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Ruleta de Premios</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={<Clock size={14} />} onClick={() => setShowPending(true)}>
            Premios pendientes
          </Button>
          {isMaster && (
            <Button variant="secondary" size="sm" icon={<Settings2 size={14} />} onClick={() => setShowAdmin(true)}>
              Administrar premios
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando ruleta...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Ruleta */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-6">
            <SpinWheel
              prizes={prizes}
              rotation={rotation}
              spinning={spinning}
              onSpin={handleSpin}
              canSpin={!!selectedPatient && prizes.length > 0}
              size={wheelSize}
            />
            {!selectedPatient && (
              <p className="mt-3 text-xs text-gray-400">Seleccione un paciente para habilitar el giro.</p>
            )}
          </div>

          {/* Panel lateral: paciente + resultado */}
          <div className="space-y-4">
            {/* Selección de paciente */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Paciente</h3>
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-xs text-blue-600">
                      {selectedPatient.document_type} {selectedPatient.document_number}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient(null); setWonPrize(null); }}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nombre o documento..."
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                    />
                  </div>
                  {results.length > 0 && (
                    <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                      {results.map((p) => (
                        <li key={p.id}>
                          <button
                            onClick={() => { setSelectedPatient(p); setResults([]); setQuery(""); }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100"
                          >
                            <span className="font-medium text-gray-800">{p.first_name} {p.last_name}</span>
                            <span className="block text-xs text-gray-500">{p.document_type} {p.document_number}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Resultado */}
            {wonPrize && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <Sparkles size={28} className="mx-auto mb-2 text-green-600" />
                <p className="text-xs uppercase tracking-wide text-green-600">¡Felicidades!</p>
                <p className="mt-1 text-lg font-bold text-green-800">{wonPrize.prize_name}</p>
                <p className="mt-2 text-xs text-gray-600">
                  Asignado a {wonPrize.patient_name}
                </p>
                <p className="text-xs text-gray-500">
                  Válido hasta: {formatDate(wonPrize.expires_at)}
                </p>
                <Badge variant={PRIZE_STATUSES[wonPrize.status]?.color as any} className="mt-2">
                  {PRIZE_STATUSES[wonPrize.status]?.label ?? wonPrize.status}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdmin && (
        <Modal isOpen onClose={() => { setShowAdmin(false); loadPrizes(); }} title="Administrar premios" size="xl">
          <PrizesAdmin onChanged={loadPrizes} />
        </Modal>
      )}

      {showPending && (
        <PendingPrizesModal onClose={() => setShowPending(false)} />
      )}
    </div>
  );
}
