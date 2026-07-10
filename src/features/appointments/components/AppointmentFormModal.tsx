import { useEffect, useState, type FormEvent } from "react";
import { Modal, Button, Input, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useAppointments } from "../hooks/useAppointments";
import { invoke } from "@tauri-apps/api/core";

interface PatientOption {
  id: number;
  label: string;
}

interface DoctorOption {
  id: number;
  label: string;
}

interface AppointmentFormModalProps {
  appointmentId?: number | null;
  defaultDate?: Date;
  defaultHour?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AppointmentFormModal({
  appointmentId,
  defaultDate,
  defaultHour,
  onClose,
  onSuccess,
}: AppointmentFormModalProps) {
  const { toast } = useToast();
  const { createAppointment, updateAppointment, getAppointment } = useAppointments();
  const isEditing = !!appointmentId;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  // Options
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Form state
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("08:30");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Set defaults
  useEffect(() => {
    if (defaultDate && !isEditing) {
      const pad = (n: number) => String(n).padStart(2, "0");
      setDate(
        `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}`,
      );
      if (defaultHour !== undefined) {
        setStartHour(`${pad(defaultHour)}:00`);
        setEndHour(`${pad(defaultHour)}:30`);
      }
    }
  }, [defaultDate, defaultHour]);

  // Load doctors
  useEffect(() => {
    invoke<{ id: number; first_name: string; last_name: string; professional_license: string; specialty: string; is_active: boolean }[]>("list_doctors", {
      activeOnly: true,
    }).then((docs) => {
      setDoctors(
        docs.map((d) => ({ id: d.id, label: `Dr. ${d.first_name} ${d.last_name}` })),
      );
      if (docs.length > 0 && !doctorId) setDoctorId(docs[0].id);
    });
  }, []);

  // Load existing appointment for editing
  useEffect(() => {
    if (isEditing && appointmentId) {
      getAppointment(appointmentId)
        .then((appt) => {
          setPatientId(appt.patient_id);
          setPatientLabel(appt.patient_name || "");
          setDoctorId(appt.doctor_id);
          setReason(appt.reason || "");
          setNotes(appt.notes || "");

          const start = new Date(appt.start_time);
          const end = new Date(appt.end_time);
          const pad = (n: number) => String(n).padStart(2, "0");
          setDate(
            `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
          );
          setStartHour(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
          setEndHour(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
        })
        .catch((err) => toast("error", String(err)))
        .finally(() => setFetching(false));
    }
  }, [appointmentId]);

  // Search patients
  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await invoke<
          { id: number; first_name: string; last_name: string; document_number: string; phone: string; is_active: boolean; document_type: string; created_at: string }[]
        >("search_patients", { request: { query: patientSearch, active_only: true, limit: 10 } });
        setPatients(
          results.map((p) => ({
            id: p.id,
            label: `${p.first_name} ${p.last_name} (${p.document_number})`,
          })),
        );
        setShowPatientDropdown(true);
      } catch {
        setPatients([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const selectPatient = (p: PatientOption) => {
    setPatientId(p.id);
    setPatientLabel(p.label);
    setPatientSearch("");
    setShowPatientDropdown(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!patientId) {
      toast("error", "Seleccione un paciente.");
      return;
    }
    if (!doctorId) {
      toast("error", "Seleccione un doctor.");
      return;
    }
    if (!date || !startHour || !endHour) {
      toast("error", "Complete fecha y hora.");
      return;
    }

    const startTime = `${date}T${startHour}:00`;
    const endTime = `${date}T${endHour}:00`;

    if (startTime >= endTime) {
      toast("error", "La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && appointmentId) {
        await updateAppointment({
          id: appointmentId,
          patient_id: patientId,
          doctor_id: doctorId,
          start_time: startTime,
          end_time: endTime,
          reason: reason || null,
          notes: notes || null,
        });
        toast("success", "Cita actualizada.");
      } else {
        await createAppointment({
          patient_id: patientId,
          doctor_id: doctorId,
          start_time: startTime,
          end_time: endTime,
          reason: reason || null,
          notes: notes || null,
        });
        toast("success", "Cita creada.");
      }
      onSuccess();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? "Editar Cita" : "Nueva Cita"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            onClick={() =>
              (document.getElementById("appointment-form") as HTMLFormElement)?.requestSubmit()
            }
          >
            {isEditing ? "Guardar" : "Agendar"}
          </Button>
        </>
      }
    >
      {fetching ? (
        <div className="py-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Patient selector with autocomplete */}
          <div className="relative">
            <Input
              label="Paciente"
              value={patientId ? patientLabel : patientSearch}
              onChange={(e) => {
                if (patientId) {
                  setPatientId(null);
                  setPatientLabel("");
                }
                setPatientSearch(e.target.value);
              }}
              placeholder="Buscar paciente por nombre o documento..."
              required
            />
            {patientId && (
              <button
                type="button"
                className="absolute right-2 top-7 text-xs text-red-500 hover:text-red-700"
                onClick={() => {
                  setPatientId(null);
                  setPatientLabel("");
                  setPatientSearch("");
                }}
              >
                Cambiar
              </button>
            )}
            {showPatientDropdown && patients.length > 0 && !patientId && (
              <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => selectPatient(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Doctor selector */}
          <Select
            label="Doctor"
            options={doctors.map((d) => ({ value: String(d.id), label: d.label }))}
            value={String(doctorId || "")}
            onChange={(e) => setDoctorId(Number(e.target.value))}
            required
          />

          {/* Date and time */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Hora inicio"
              type="time"
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              required
            />
            <Input
              label="Hora fin"
              type="time"
              value={endHour}
              onChange={(e) => setEndHour(e.target.value)}
              required
            />
          </div>

          {/* Reason */}
          <Input
            label="Motivo de la cita"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Control de ortodoncia, limpieza dental..."
          />

          {/* Notes */}
          <Input
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas sobre la cita"
          />
        </form>
      )}
    </Modal>
  );
}
