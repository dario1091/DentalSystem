import { useMemo } from "react";
import type { AppointmentSummary } from "../types";
import { STATUS_CONFIG } from "../types";

interface MonthViewProps {
  year: number;
  month: number; // 0-indexed
  appointments: AppointmentSummary[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentSummary) => void;
}

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function MonthView({
  year,
  month,
  appointments,
  onDayClick,
  onAppointmentClick,
}: MonthViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate calendar grid
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6 in our display
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: (Date | null)[] = [];

    // Padding before
    for (let i = 0; i < startDow; i++) cells.push(null);

    // Days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(new Date(year, month, d));
    }

    // Padding after to fill last row
    while (cells.length % 7 !== 0) cells.push(null);

    // Split into weeks
    const result: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  // Group appointments by date key
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, AppointmentSummary[]> = {};
    for (const appt of appointments) {
      const key = new Date(appt.start_time).toISOString().split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} className="min-h-[80px] border-r border-gray-50 bg-gray-25 last:border-r-0" />;
            }

            const dateKey = day.toISOString().split("T")[0];
            const dayAppts = appointmentsByDate[dateKey] || [];
            const isToday = day.getTime() === today.getTime();
            const isCurrentMonth = day.getMonth() === month;

            return (
              <div
                key={di}
                className={`min-h-[80px] border-r border-gray-50 p-1 last:border-r-0 cursor-pointer hover:bg-gray-50 ${
                  isToday ? "bg-blue-50/50" : ""
                } ${!isCurrentMonth ? "opacity-50" : ""}`}
                onClick={() => onDayClick(day)}
              >
                {/* Day number */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-blue-600 text-white font-bold"
                        : "text-gray-700"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayAppts.length > 0 && (
                    <span className="text-[10px] text-gray-400">{dayAppts.length}</span>
                  )}
                </div>

                {/* Appointments preview (max 3) */}
                <div className="space-y-0.5">
                  {dayAppts.slice(0, 3).map((appt) => {
                    const cfg = STATUS_CONFIG[appt.status];
                    return (
                      <div
                        key={appt.id}
                        className={`rounded px-1 py-0.5 text-[10px] leading-tight truncate cursor-pointer hover:opacity-80 ${cfg.bgColor}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(appt);
                        }}
                        title={`${appt.patient_name} - ${cfg.label}`}
                      >
                        <span className="truncate">{appt.patient_name}</span>
                      </div>
                    );
                  })}
                  {dayAppts.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center">
                      +{dayAppts.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
