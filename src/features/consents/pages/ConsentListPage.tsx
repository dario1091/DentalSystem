import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, ArrowRight, Settings } from "lucide-react";
import { Button, Input } from "@shared/components/ui";
import { usePatients } from "@features/patients/hooks/usePatients";
import type { PatientSummary } from "@features/patients/types";
import TemplateEditor from "../components/TemplateEditor";

type View = "search" | "templates";

export default function ConsentListPage() {
  const navigate = useNavigate();
  const { searchPatients } = usePatients();
  const [view, setView] = useState<View>("search");
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
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Consentimientos Informados</h1>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          <button
            onClick={() => setView("search")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              view === "search"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Por Paciente
          </button>
          <button
            onClick={() => setView("templates")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              view === "templates"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings size={14} />
            Editar Plantillas
          </button>
        </nav>
      </div>

      {/* Content */}
      {view === "templates" ? (
        <TemplateEditor />
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          <p className="text-sm text-gray-500">
            Busque un paciente para gestionar sus consentimientos informados.
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
                  onClick={() => navigate(`/patients/${patient.id}?tab=consents`)}
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
      )}
    </div>
  );
}
