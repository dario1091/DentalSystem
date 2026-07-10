import { useMemo } from "react";
import type { AppointmentSummary } from "../types";
import { STATUS_CONFIG, formatTime } from "../types";

interface DayViewProps {
  date: Date;
  appointments: AppointmentSummary[];
  onSlotClick: (hour: number) => void;
  onAppointmentClick: (appointment: AppointmentSummary) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00

export default function DayView({
  date: _date,
  appointments,
  onSlotClick,
  onAppointmentClick,
}: DayViewProps) {
  const appointmentsByHour = useMemo(() => {
    const map: Record<number, AppointmentSummary[]> = {};
    for (const appt of appointments) {
      const hour = new Date(appt.start_time).getHours();
      if (!map[hour]) map[hour] = [];
      map[hour].push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div className="overflow-y-auto rounded-lg border border-gray-200 bg-white">
      {HOURS.map((hour) => {
        const hourAppts = appointmentsByHour[hour] || [];
        return (
          <div
            key={hour}
            className="flex min-h-[64px] border-b border-gray-100 last:border-b-0"
          >
            {/* Time label */}
            <div className="flex w-16 shrink-0 items-start justify-end border-r border-gray-100 pr-2 pt-1">
              <span className="text-xs text-gray-400">
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>

            {/* Slot area */}
            <div
              className="flex flex-1 flex-col gap-1 p-1 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                if (hourAppts.length === 0) onSlotClick(hour);
              }}
            >
              {hourAppts.map((appt) => {
                const cfg = STATUS_CONFIG[appt.status];
                return (
                  <div
                    key={appt.id}
                    className={`rounded border px-2 py-1 text-xs cursor-pointer transition-opacity hover:opacity-80 ${cfg.bgColor}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(appt);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
                      <span className="font-medium truncate">{appt.patient_name}</span>
                      <span className="ml-auto text-gray-500">
                        {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                      </span>
                    </div>
                    {appt.reason && (
                      <p className="mt-0.5 truncate text-gray-600">{appt.reason}</p>
                    )}
                  </div>
                );
              })}
              {hourAppts.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <span className="text-xs text-gray-300 opacity-0 hover:opacity-100 transition-opacity">
                    + Agendar
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
