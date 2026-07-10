import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Search, ArrowRight } from "lucide-react";
import { Button, Input } from "@shared/components/ui";
import { usePatients } from "@features/patients/hooks/usePatients";
import type { PatientSummary } from "@features/patients/types";

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { searchPatients } = usePatients();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const patients = await searchPatients({ query, active_only: true, limit: 20 });
      setResults(patients);
      setSearched(true);
    } catch {
      setResults([]);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <FolderOpen size={24} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800">Documentos</h1>
      </div>

      <p className="text-sm text-gray-500">
        Busque un paciente para gestionar sus documentos. También puede acceder desde la vista
        de detalle del paciente, pestaña "Documentos".
      </p>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nombre, documento o teléfono..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="primary" icon={<Search size={14} />} onClick={handleSearch}>
          Buscar
        </Button>
      </div>

      {searched && results.length === 0 && (
        <p className="text-sm text-gray-400">No se encontraron pacientes.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((patient) => (
            <button
              key={patient.id}
              onClick={() => navigate(`/patients/${patient.id}?tab=documents`)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {patient.first_name} {patient.last_name}
                </p>
                <p className="text-xs text-gray-500">
                  {patient.document_type} {patient.document_number} · {patient.phone}
                </p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
