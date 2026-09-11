import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldCheck, Clock } from "lucide-react";

interface TrialStatus {
  is_expired: boolean;
  days_remaining: number;
  licensed: boolean;
  is_permanent: boolean;
  warning: boolean;
  license_expires: string | null;
}

/**
 * Small header pill showing the current license / trial status and days left.
 */
export default function LicenseIndicator() {
  const [status, setStatus] = useState<TrialStatus | null>(null);

  useEffect(() => {
    invoke<TrialStatus>("check_trial")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  // Permanent license: quiet green pill.
  if (status.is_permanent) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
        title="Licencia permanente activa"
      >
        <ShieldCheck size={12} />
        Licencia activa
      </span>
    );
  }

  const days = status.days_remaining;
  const isLicense = status.licensed;

  // Color by urgency.
  let cls = "bg-green-100 text-green-700";
  if (days <= 5) cls = "bg-red-100 text-red-700";
  else if (days <= 15) cls = "bg-amber-100 text-amber-700";

  const label = isLicense ? "Licencia" : "Prueba";
  const dayText = days === 1 ? "1 día" : `${days} días`;
  const tip = status.license_expires
    ? `Vence el ${new Date(status.license_expires).toLocaleDateString("es-CO")}`
    : "Días restantes del período";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
      title={tip}
    >
      <Clock size={12} />
      {label}: {dayText}
    </span>
  );
}
