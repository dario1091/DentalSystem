import { useMemo } from "react";
import type { AppointmentSummary } from "../types";
import { STATUS_CONFIG, formatTime, addDays } from "../types";

interface WeekViewProps {
  weekStart: Date;
  appointments: AppointmentSummary[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentSummary) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function WeekView({
  weekStart,
  appointments,
  onDayClick,
  onAppointmentClick,
}: WeekViewProps) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group appointments by day + hour
  const grid = useMemo(() => {
    const map: Record<string, Record<number, AppointmentSummary[]>> = {};
    for (const appt of appointments) {
      const d = new Date(appt.start_time);
      const key = d.toISOString().split("T")[0];
      const hour = d.getHours();
      if (!map[key]) map[key] = {};
      if (!map[key][hour]) map[key][hour] = [];
      map[key][hour].push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
      {/* Header row with day names */}
      <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
        <div className="border-r border-gray-200" />
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          return (
            <div
              key={i}
              className={`border-r border-gray-100 px-2 py-2 text-center last:border-r-0 cursor-pointer hover:bg-gray-100 ${
                isToday ? "bg-blue-50" : ""
              }`}
              onClick={() => onDayClick(day)}
            >
              <div className="text-xs text-gray-500">{DAY_NAMES[i]}</div>
              <div
                className={`text-sm font-medium ${
                  isToday ? "text-blue-600" : "text-gray-700"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0"
        >
          {/* Hour label */}
          <div className="flex items-start justify-end border-r border-gray-100 pr-2 pt-1">
            <span className="text-xs text-gray-400">
              {String(hour).padStart(2, "0")}:00
            </span>
          </div>

          {/* Day cells */}
          {days.map((day, i) => {
            const dateKey = day.toISOString().split("T")[0];
            const cellAppts = grid[dateKey]?.[hour] || [];
            return (
              <div
                key={i}
                className="min-h-[48px] border-r border-gray-50 p-0.5 last:border-r-0 hover:bg-gray-50"
              >
                {cellAppts.map((appt) => {
                  const cfg = STATUS_CONFIG[appt.status];
                  return (
                    <div
                      key={appt.id}
                      className={`mb-0.5 cursor-pointer rounded border px-1 py-0.5 text-[10px] leading-tight hover:opacity-80 ${cfg.bgColor}`}
                      onClick={() => onAppointmentClick(appt)}
                      title={`${appt.patient_name} - ${formatTime(appt.start_time)}`}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className={`h-1 w-1 rounded-full ${cfg.dotColor}`} />
                        <span className="truncate font-medium">{appt.patient_name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
