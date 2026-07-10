import { ShieldCheck } from "lucide-react";

export default function ConsentListPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
      <ShieldCheck size={48} />
      <h2 className="text-xl font-semibold">Consentimientos Informados</h2>
      <p className="text-sm">Próximamente — Fase 10</p>
    </div>
  );
}
