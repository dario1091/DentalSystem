import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
      <Settings size={48} />
      <h2 className="text-xl font-semibold">Configuración</h2>
      <p className="text-sm">Próximamente — Fase 12</p>
    </div>
  );
}
