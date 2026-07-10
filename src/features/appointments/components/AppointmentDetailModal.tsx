import { useEffect, useState } from "react";
import { Clock, User, Stethoscope, FileText, Trash2 } from "lucide-react";
import { Modal, Button, Badge } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "../hooks/useAppointments";
import type { Appointment, AppointmentProcedure, AppointmentStatus } from "../types";
import { STATUS_CONFIG, VALID_TRANSITIONS, formatTime, formatDate } from "../types";
import { formatCurrency } from "@features/procedures/types";
import ProcedureSelector from "./ProcedureSelector";

interface AppointmentDetailModalProps {
  appointmentId: number;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AppointmentDetailModal({
  appointmentId,
  onClose,
  onUpdated,
}: AppointmentDetailModalProps) {
  const { toast } = useToast();
  const { getAppointment, changeStatus, getAppointmentProcedures, removeProcedure } =
    useAppointments();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [procedures, setProcedures] = useState<AppointmentProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProcedureSelector, setShowProcedureSelector] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [appt, procs] = await Promise.all([
        getAppointment(appointmentId),
        getAppointmentProcedures(appointmentId),
      ]);
      setAppointment(appt);
      setProcedures(procs);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [appointmentId]);

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    const label = STATUS_CONFIG[newStatus].label;
    if (!confirm(`¿Cambiar estado a "${label}"?`)) return;

    try {
      await changeStatus({ appointment_id: appointmentId, new_status: newStatus });
      toast("success", `Estado cambiado a: ${label}`);
      fetchData();
      onUpdated();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleRemoveProcedure = async (proc: AppointmentProcedure) => {
    if (!confirm(`¿Eliminar "${proc.procedure_name}" de esta cita?`)) return;
    try {
      await removeProcedure({
        appointment_procedure_id: proc.id,
        appointment_id: appointmentId,
      });
      toast("success", "Procedimiento eliminado.");
      fetchData();
    } catch (err) {
      toast("error", String(err));
    }
  };

  if (loading || !appointment) {
    return (
      <Modal isOpen onClose={onClose} title="Detalle de Cita">
        <div className="py-8 text-center text-gray-400">Cargando...</div>
      </Modal>
    );
  }

  const status = appointment.status as AppointmentStatus;
  const statusCfg = STATUS_CONFIG[status];
  const transitions = VALID_TRANSITIONS[status];
  const isTerminal = transitions.length === 0;

  return (
    <Modal isOpen onClose={onClose} title="Detalle de Cita" size="lg">
      <div className="space-y-6">
        {/* Status badge + actions */}
        <div className="flex items-center justify-between">
          <Badge variant={status === "completed" ? "success" : status === "cancelled" || status === "no_show" ? "danger" : "info"}>
            {statusCfg.label}
          </Badge>
          <div className="flex gap-2">
            {transitions.map((t) => {
              const cfg = STATUS_CONFIG[t];
              const isDanger = t === "cancelled" || t === "no_show";
              return (
                <Button
                  key={t}
                  size="sm"
                  variant={isDanger ? "danger" : "secondary"}
                  onClick={() => handleStatusChange(t)}
                >
                  {cfg.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Appointment info */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Paciente</p>
              <p className="text-sm font-medium">{appointment.patient_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Stethoscope size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Doctor</p>
              <p className="text-sm font-medium">{appointment.doctor_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Horario</p>
              <p className="text-sm font-medium">
                {formatDate(appointment.start_time)} · {formatTime(appointment.start_time)} -{" "}
                {formatTime(appointment.end_time)}
              </p>
            </div>
          </div>
          {appointment.reason && (
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Motivo</p>
                <p className="text-sm">{appointment.reason}</p>
              </div>
            </div>
          )}
        </div>

        {/* Procedures section */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">Procedimientos</h4>
            {!isTerminal && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowProcedureSelector(true)}
              >
                + Agregar
              </Button>
            )}
          </div>

          {procedures.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">
              No hay procedimientos asociados.
            </p>
          ) : (
            <div className="space-y-2">
              {procedures.map((proc) => (
                <div
                  key={proc.id}
                  className="flex items-center justify-between rounded border border-gray-100 px-3 py-2"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                        {proc.procedure_code}
                      </span>
                      <span className="text-sm font-medium">{proc.procedure_name}</span>
                      {proc.tooth_number && (
                        <Badge variant="neutral">D{proc.tooth_number}</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                      <span>Cant: {proc.quantity}</span>
                      <span>
                        Precio: {formatCurrency(proc.unit_price)}
                        {proc.discount_value > 0 && (
                          <span className="text-green-600">
                            {" "}(-{proc.discount_type === "percentage" ? `${proc.discount_value}%` : formatCurrency(proc.discount_value)})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatCurrency(proc.final_price)}
                    </span>
                    {!isTerminal && (
                      <button
                        onClick={() => handleRemoveProcedure(proc)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-end border-t border-gray-200 pt-2">
                <span className="text-sm text-gray-500">Total:</span>
                <span className="ml-2 text-base font-bold text-gray-900">
                  {formatCurrency(appointment.total_amount)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500 mb-1">Notas</p>
            <p className="text-sm text-gray-700">{appointment.notes}</p>
          </div>
        )}
      </div>

      {/* Procedure Selector Modal */}
      {showProcedureSelector && (
        <ProcedureSelector
          appointmentId={appointmentId}
          onClose={() => setShowProcedureSelector(false)}
          onAdded={() => {
            setShowProcedureSelector(false);
            fetchData();
          }}
        />
      )}
    </Modal>
  );
}
