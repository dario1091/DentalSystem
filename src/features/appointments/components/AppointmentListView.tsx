import { useEffect, useState } from "react";
import { Calendar, Search } from "lucide-react";
import { Button, Badge, Input, Select, Table, type Column } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "../hooks/useAppointments";
import type { AppointmentSummary, AppointmentStatus, ListAppointmentsFilter } from "../types";
import { STATUS_CONFIG, formatTime, formatDate } from "../types";
import { formatCurrency } from "@features/procedures/types";
import { invoke } from "@tauri-apps/api/core";

interface AppointmentListViewProps {
  onAppointmentClick: (id: number) => void;
  onSwitchToCalendar: () => void;
}

export default function AppointmentListView({
  onAppointmentClick,
  onSwitchToCalendar,
}: AppointmentListViewProps) {
  const { toast } = useToast();
  const { listAppointments } = useAppointments();

  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  // Doctors list
  const [doctors, setDoctors] = useState<{ id: number; label: string }[]>([]);

  // Indicators
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    invoke<{ id: number; first_name: string; last_name: string }[]>("list_doctors", {
      activeOnly: true,
    }).then((docs) => {
      setDoctors(docs.map((d) => ({ id: d.id, label: `Dr. ${d.first_name} ${d.last_name}` })));
    });
  }, []);

  // Count today's appointments
  useEffect(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    listAppointments({
      date_from: `${todayStr}T00:00:00`,
      date_to: `${todayStr}T23:59:59`,
    }).then((data) => {
      setTodayCount(data.filter((a) => a.status !== "cancelled" && a.status !== "no_show").length);
    });
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const filter: ListAppointmentsFilter = {};
      if (doctorFilter) filter.doctor_id = Number(doctorFilter);
      if (statusFilter) filter.status = statusFilter as AppointmentStatus;
      if (dateFrom) filter.date_from = `${dateFrom}T00:00:00`;
      if (dateTo) filter.date_to = `${dateTo}T23:59:59`;

      let data = await listAppointments(filter);

      // Client-side patient name filter
      if (patientSearch.trim()) {
        const q = patientSearch.toLowerCase();
        data = data.filter((a) => a.patient_name.toLowerCase().includes(q));
      }

      setAppointments(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [doctorFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(fetchAppointments, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const columns: Column<AppointmentSummary & Record<string, unknown>>[] = [
    {
      key: "start_time",
      header: "Fecha/Hora",
      sortable: true,
      render: (item) => (
        <div>
          <p className="text-sm font-medium">{formatDate(item.start_time)}</p>
          <p className="text-xs text-gray-500">
            {formatTime(item.start_time)} - {formatTime(item.end_time)}
          </p>
        </div>
      ),
    },
    {
      key: "patient_name",
      header: "Paciente",
      sortable: true,
      render: (item) => <span className="font-medium">{item.patient_name}</span>,
    },
    {
      key: "doctor_name",
      header: "Doctor",
      sortable: true,
    },
    {
      key: "reason",
      header: "Motivo",
      render: (item) => (
        <span className="text-sm text-gray-600 truncate max-w-[150px] block">
          {item.reason || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      render: (item) => {
        const cfg = STATUS_CONFIG[item.status];
        return (
          <Badge
            variant={
              item.status === "completed"
                ? "success"
                : item.status === "cancelled" || item.status === "no_show"
                  ? "danger"
                  : item.status === "in_progress"
                    ? "warning"
                    : "info"
            }
            dot
          >
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      key: "total_amount",
      header: "Total",
      sortable: true,
      render: (item) => (
        <span className="text-sm font-medium">
          {item.total_amount > 0 ? formatCurrency(item.total_amount) : "—"}
        </span>
      ),
    },
  ];

  const statusOptions = [
    { value: "", label: "Todos" },
    { value: "scheduled", label: "Programada" },
    { value: "confirmed", label: "Confirmada" },
    { value: "in_progress", label: "En progreso" },
    { value: "completed", label: "Completada" },
    { value: "cancelled", label: "Cancelada" },
    { value: "no_show", label: "No asistió" },
  ];

  return (
    <div className="space-y-4">
      {/* Header with indicators */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Citas — Vista Lista</h1>
          <div className="mt-1 flex gap-4 text-sm text-gray-500">
            <span>
              📅 Citas hoy: <strong className="text-gray-700">{todayCount}</strong>
            </span>
            <span>
              📋 Resultados: <strong className="text-gray-700">{appointments.length}</strong>
            </span>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Calendar size={14} />}
          onClick={onSwitchToCalendar}
        >
          Ver Calendario
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="flex-1 min-w-[180px]">
          <Input
            label="Paciente"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            leftIcon={<Search size={14} />}
          />
        </div>
        <div className="w-44">
          <Select
            label="Doctor"
            options={[{ value: "", label: "Todos" }, ...doctors.map((d) => ({ value: String(d.id), label: d.label }))]}
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          />
        </div>
        <div className="w-36">
          <Select
            label="Estado"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <div className="w-36">
          <Input
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="w-36">
          <Input
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(doctorFilter || statusFilter || dateFrom || dateTo || patientSearch) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDoctorFilter("");
              setStatusFilter("");
              setDateFrom("");
              setDateTo("");
              setPatientSearch("");
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          Cargando citas...
        </div>
      ) : (
        <Table
          columns={columns}
          data={appointments as (AppointmentSummary & Record<string, unknown>)[]}
          keyExtractor={(item) => item.id}
          emptyMessage="No se encontraron citas con los filtros seleccionados."
          onRowClick={(item) => onAppointmentClick(item.id)}
        />
      )}
    </div>
  );
}
