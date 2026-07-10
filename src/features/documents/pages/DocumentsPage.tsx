import { FolderOpen } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
      <FolderOpen size={48} />
      <h2 className="text-xl font-semibold">Documentos</h2>
      <p className="text-sm">Próximamente — Fase 9</p>
    </div>
  );
}
