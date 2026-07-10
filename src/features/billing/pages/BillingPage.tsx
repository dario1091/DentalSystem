import { Receipt } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
      <Receipt size={48} />
      <h2 className="text-xl font-semibold">Facturación</h2>
      <p className="text-sm">Próximamente — Fase 11</p>
    </div>
  );
}
