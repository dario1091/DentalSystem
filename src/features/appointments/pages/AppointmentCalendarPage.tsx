import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
} from "lucide-react";
import { Button } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "../hooks/useAppointments";
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

  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

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
              appointments={appointments}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {view === "week" && (
            <WeekView
              weekStart={startOfWeek(currentDate)}
              appointments={appointments}
              onDayClick={handleDayClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {view === "month" && (
            <MonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              appointments={appointments}
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
