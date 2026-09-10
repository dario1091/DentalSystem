import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
} from "lucide-react";
import { RefreshCw } from "lucide-react";
import { Button } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "../hooks/useAppointments";
import { useGoogleCalendar } from "@features/settings/hooks/useGoogleCalendar";
import type { AppointmentSummary, CalendarView } from "../types";
import {
  formatDateFull,
  startOfWeek,
  addDays,
  toISOLocal,
  startOfDay,
  endOfDay,
} from "../types";
import DayView from "../components/DayView";
import WeekView from "../components/WeekView";
import MonthView from "../components/MonthView";
import AppointmentDetailModal from "../components/AppointmentDetailModal";
import AppointmentFormModal from "../components/AppointmentFormModal";
import AppointmentListView from "../components/AppointmentListView";

export default function AppointmentCalendarPage() {
  const { toast } = useToast();
  const { listAppointments } = useAppointments();
  const { listExternalEvents } = useGoogleCalendar();

  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [externalEvents, setExternalEvents] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showListView, setShowListView] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState<{ date?: Date; hour?: number }>({});
  const [detailId, setDetailId] = useState<number | null>(null);

  const getDateRange = useCallback(() => {
    if (view === "day") {
      return {
        from: toISOLocal(startOfDay(currentDate)),
        to: toISOLocal(endOfDay(currentDate)),
      };
    }
    if (view === "week") {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 7);
      return {
        from: toISOLocal(startOfDay(start)),
        to: toISOLocal(endOfDay(end)),
      };
    }
    // month
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return {
      from: toISOLocal(startOfDay(start)),
      to: toISOLocal(endOfDay(end)),
    };
  }, [view, currentDate]);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const range = getDateRange();
      const data = await listAppointments({
        date_from: range.from,
        date_to: range.to,
      });
      setAppointments(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  // Pull external (e.g. WhatsApp-created) events from Google for the visible
  // range and expose them as synthetic "external" appointments (negative ids).
  const syncGoogle = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        setSyncing(true);
        const range = getDateRange();
        // Google requires RFC3339 UTC instants for the range bounds.
        const fromISO = new Date(range.from).toISOString();
        const toISO = new Date(range.to).toISOString();
        const events = await listExternalEvents(fromISO, toISO);

        const external: AppointmentSummary[] = events
          .filter((e) => e.is_external)
          .map((e, idx) => ({
            id: -1 * (idx + 1), // negative id => synthetic, not a DB row
            patient_name: e.summary || "Evento externo",
            doctor_name: "",
            start_time: e.start_time,
            end_time: e.end_time,
            status: "external",
            reason: null,
            total_amount: 0,
          }));
        setExternalEvents(external);
        if (!opts?.silent && external.length > 0) {
          toast("success", `${external.length} evento(s) externo(s) sincronizado(s).`);
        }
      } catch (err) {
        if (!opts?.silent) toast("error", String(err));
      } finally {
        setSyncing(false);
      }
    },
    [getDateRange, listExternalEvents, toast],
  );

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Auto-pull external events whenever the visible range changes (silent).
  useEffect(() => {
    syncGoogle({ silent: true });
  }, [syncGoogle]);

  // Combined list handed to the calendar views: real appointments + externals.
  const allEvents = [...appointments, ...externalEvents];

  const navigate = (direction: number) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + 7 * direction);
    else d.setMonth(d.getMonth() + direction);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    if (view === "day") return formatDateFull(currentDate);
    if (view === "week") {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  };

  const handleSlotClick = (hour: number) => {
    setFormDefaults({ date: currentDate, hour });
    setShowForm(true);
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleAppointmentClick = (appt: AppointmentSummary) => {
    // External (synthetic) events have negative ids and no DB record.
    if (appt.id < 0) {
      toast("info", "Evento externo (creado fuera de la app, p. ej. WhatsApp). No editable aquí.");
      return;
    }
    setDetailId(appt.id);
  };

  const handleNewAppointment = () => {
    setFormDefaults({ date: currentDate });
    setShowForm(true);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* List View */}
      {showListView ? (
        <>
          <AppointmentListView
            onAppointmentClick={(id) => setDetailId(id)}
            onSwitchToCalendar={() => setShowListView(false)}
          />
          {detailId !== null && (
            <AppointmentDetailModal
              appointmentId={detailId}
              onClose={() => setDetailId(null)}
              onUpdated={() => {
                setDetailId(null);
                fetchAppointments();
              }}
            />
          )}
        </>
      ) : (
      <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(1)}>
            <ChevronRight size={16} />
          </Button>
          <h2 className="text-lg font-semibold text-gray-800 capitalize">{getTitle()}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            icon={<RefreshCw size={14} className={syncing ? "animate-spin" : ""} />}
            variant="secondary"
            onClick={() => syncGoogle()}
            disabled={syncing}
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button size="sm" icon={<List size={14} />} variant="secondary" onClick={() => setShowListView(true)}>
            Lista
          </Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={handleNewAppointment}>
            Nueva Cita
          </Button>
        </div>
      </div>

      {/* Calendar content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          Cargando citas...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {view === "day" && (
            <DayView
              date={currentDate}
              appointments={allEvents}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {view === "week" && (
            <WeekView
              weekStart={startOfWeek(currentDate)}
              appointments={allEvents}
              onDayClick={handleDayClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {view === "month" && (
            <MonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              appointments={allEvents}
              onDayClick={handleDayClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-2">
        {[
          { label: "Programada", color: "bg-blue-500" },
          { label: "Confirmada", color: "bg-indigo-500" },
          { label: "En progreso", color: "bg-amber-500" },
          { label: "Completada", color: "bg-green-500" },
          { label: "Cancelada", color: "bg-red-500" },
          { label: "No asistió", color: "bg-gray-500" },
          { label: "WhatsApp / Externo", color: "bg-emerald-500" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${item.color}`} />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showForm && (
        <AppointmentFormModal
          defaultDate={formDefaults.date}
          defaultHour={formDefaults.hour}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchAppointments();
          }}
        />
      )}

      {detailId !== null && (
        <AppointmentDetailModal
          appointmentId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={() => {
            setDetailId(null);
            fetchAppointments();
          }}
        />
      )}
      </>
      )}
    </div>
  );
}
