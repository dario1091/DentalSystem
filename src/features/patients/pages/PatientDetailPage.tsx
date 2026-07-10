import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  UserX,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Activity,
  FileText,
  FolderOpen,
  Receipt,
  Download,
} from "lucide-react";
import { Button, Badge } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { usePatients } from "../hooks/usePatients";
import { invoke } from "@tauri-apps/api/core";
import type { Patient } from "../types";
import { DOCUMENT_TYPES, GENDERS, BLOOD_TYPES } from "../types";
import OdontogramPage from "@features/odontogram/pages/OdontogramPage";
import ClinicalHistoryTab from "@features/clinical-history/components/ClinicalHistoryTab";
import DocumentsTab from "@features/documents/components/DocumentsTab";
import ConsentsTab from "@features/consents/components/ConsentsTab";
import BillingTab from "@features/billing/components/BillingTab";

type Tab = "general" | "odontogram" | "history" | "documents" | "consents" | "billing";

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { getPatient, deactivatePatient } = usePatients();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const initialTab = (searchParams.get("tab") as Tab) || "general";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (id) {
      getPatient(Number(id))
        .then(setPatient)
        .catch((err) => toast("error", String(err)))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleDeactivate = async () => {
    if (!patient) return;
    if (!confirm(`¿Está seguro de desactivar a ${patient.first_name} ${patient.last_name}?`)) return;
    try {
      await deactivatePatient(patient.id);
      toast("success", "Paciente desactivado.");
      navigate("/patients");
    } catch (err) {
      toast("error", String(err));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>;
  }

  if (!patient) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Paciente no encontrado.</div>;
  }

  const age = Math.floor(
    (Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <FileText size={16} /> },
    { key: "odontogram", label: "Odontograma", icon: <Activity size={16} /> },
    { key: "history", label: "Historia Clínica", icon: <FileText size={16} /> },
    { key: "documents", label: "Documentos", icon: <FolderOpen size={16} /> },
    { key: "consents", label: "Consentimientos", icon: <FileText size={16} /> },
    { key: "billing", label: "Cuenta", icon: <Receipt size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">
                {patient.first_name} {patient.last_name}
              </h1>
              <Badge variant={patient.is_active ? "success" : "neutral"} dot>
                {patient.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {DOCUMENT_TYPES.find((d) => d.value === patient.document_type)?.label}{" "}
              {patient.document_number} · {age} años ·{" "}
              {GENDERS.find((g) => g.value === patient.gender)?.label}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={async () => {
              try {
                const path = await invoke<string>("export_patient_pdf", { id: patient.id });
                toast("success", `PDF generado: ${path}`);
              } catch (err) {
                toast("error", String(err));
              }
            }}
          >
            PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Edit size={14} />}
            onClick={() => navigate(`/patients/${patient.id}/edit`)}
          >
            Editar
          </Button>
          {patient.is_active && (
            <Button variant="danger" size="sm" icon={<UserX size={14} />} onClick={handleDeactivate}>
              Desactivar
            </Button>
          )}
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <InfoCard icon={<Phone size={16} />} label="Teléfono" value={patient.phone} />
        <InfoCard icon={<Mail size={16} />} label="Email" value={patient.email || "—"} />
        <InfoCard icon={<MapPin size={16} />} label="Dirección" value={patient.address || "—"} />
        <InfoCard
          icon={<Calendar size={16} />}
          label="Registro"
          value={new Date(patient.created_at).toLocaleDateString("es-CO")}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "general" && <GeneralTab patient={patient} />}
        {activeTab === "odontogram" && <OdontogramPage patientId={patient.id} />}
        {activeTab === "history" && <ClinicalHistoryTab patientId={patient.id} />}
        {activeTab === "documents" && <DocumentsTab patientId={patient.id} />}
        {activeTab === "consents" && <ConsentsTab patientId={patient.id} />}
        {activeTab === "billing" && <BillingTab patientId={patient.id} />}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function GeneralTab({ patient }: { patient: Patient }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Datos de Salud */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-700">Datos de Salud</h3>
        <dl className="space-y-3 text-sm">
          <DetailRow label="EPS" value={patient.eps} />
          <DetailRow
            label="Grupo sanguíneo"
            value={BLOOD_TYPES.find((b) => b.value === patient.blood_type)?.label}
          />
          <DetailRow label="Alergias" value={patient.allergies} />
          <DetailRow label="Medicamentos" value={patient.current_medications} />
          <DetailRow label="Antecedentes" value={patient.medical_history} />
        </dl>
      </div>

      {/* Acudiente */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-700">Acudiente</h3>
        <dl className="space-y-3 text-sm">
          <DetailRow label="Nombre" value={patient.guardian_name} />
          <DetailRow label="Parentesco" value={patient.guardian_relationship} />
          <DetailRow label="Teléfono" value={patient.guardian_phone} />
        </dl>
      </div>

      {/* Autorización */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-700">Autorización de Datos</h3>
        <p className="text-sm">
          {patient.data_consent ? (
            <Badge variant="success">Autorizado — {patient.data_consent_date}</Badge>
          ) : (
            <Badge variant="warning">Pendiente</Badge>
          )}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value || "—"}</dd>
    </div>
  );
}


