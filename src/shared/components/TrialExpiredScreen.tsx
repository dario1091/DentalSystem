import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Clock, Mail, Phone, MessageCircle, Key } from "lucide-react";
import { Button, Input } from "@shared/components/ui";

interface TrialExpiredScreenProps {
  daysUsed: number;
  trialEnd: string;
  installationId: string;
  onActivated: () => void;
}

export default function TrialExpiredScreen({ trialEnd, installationId, onActivated }: TrialExpiredScreenProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError("");
    try {
      const result = await invoke<boolean>("activate_license", { licenseKey });
      if (result) {
        onActivated();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <Clock size={40} className="text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-800">
          Período de prueba finalizado
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Tu versión de prueba de 40 días ha expirado el {new Date(trialEnd).toLocaleDateString("es-CO")}.
          <br />
          Para continuar usando DentalSystem, contacta al desarrollador.
        </p>

        {/* Installation ID - client shares this with developer */}
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 text-xs font-medium text-amber-800">Tu código de instalación (compártelo con el desarrollador):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-center font-mono text-sm font-bold text-gray-800 border border-amber-200">
              {installationId}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(installationId)}
              className="rounded bg-amber-200 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-300"
            >
              Copiar
            </button>
          </div>
        </div>

        {/* Developer info */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-blue-800">Contacto del desarrollador</h3>
          <div className="space-y-2.5">
            <ContactItem icon={<Phone size={16} />} label="Teléfono" value="+57 321 211 3690" />
            <ContactItem icon={<MessageCircle size={16} />} label="WhatsApp" value="+57 321 211 3690" />
            <ContactItem icon={<Mail size={16} />} label="Email" value="dario1091@gmail.com" />
          </div>
        </div>

        {/* Activation */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Key size={14} />
            ¿Ya tienes una licencia?
          </h4>
          <div className="flex gap-2">
            <Input
              placeholder="Ingresa tu clave de licencia"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleActivate}
              disabled={!licenseKey.trim() || activating}
            >
              {activating ? "..." : "Activar"}
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          DentalSystem v0.2.0 · Licencia requerida para uso continuo
        </p>
      </div>
    </div>
  );
}

function ContactItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-blue-600">{icon}</div>
      <div>
        <span className="text-xs text-blue-600">{label}: </span>
        <span className="text-sm font-medium text-blue-900">{value}</span>
      </div>
    </div>
  );
}
