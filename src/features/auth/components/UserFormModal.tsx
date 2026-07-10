import { useState, useEffect, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal, Button, Input, Select } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import type { UserInfo } from "@store/auth-store";

interface DoctorOption {
  id: number;
  first_name: string;
  last_name: string;
  specialty: string;
}

interface UserFormModalProps {
  user: UserInfo | null;
  onClose: () => void;
  onSuccess: () => void;
}

const roleOptions = [
  { value: "master", label: "Administrador" },
  { value: "doctor", label: "Doctor" },
  { value: "auxiliary", label: "Auxiliar" },
];

export default function UserFormModal({ user, onClose, onSuccess }: UserFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!user;

  const [username, setUsername] = useState(user?.username || "");
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [role, setRole] = useState<string>(user?.role || "auxiliary");
  const [password, setPassword] = useState("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load doctors list for association
    invoke<DoctorOption[]>("list_doctors", { activeOnly: true })
      .then(setDoctors)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isEditing) {
        await invoke("update_user", {
          request: {
            id: user.id,
            username: username !== user.username ? username : null,
            display_name: displayName !== user.display_name ? displayName : null,
            role: role !== user.role ? role : null,
            is_active: null,
            doctor_id: role === "doctor" && doctorId ? Number(doctorId) : null,
          },
        });
        toast("success", "Usuario actualizado exitosamente.");
      } else {
        if (!password) {
          setError("La contraseña es obligatoria.");
          setLoading(false);
          return;
        }
        await invoke("create_user", {
          request: {
            username,
            password,
            role,
            doctor_id: role === "doctor" && doctorId ? Number(doctorId) : null,
            display_name: displayName,
          },
        });
        toast("success", "Usuario creado exitosamente.");
      }
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const doctorOptions = doctors.map((d) => ({
    value: String(d.id),
    label: `Dr. ${d.first_name} ${d.last_name} — ${d.specialty}`,
  }));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? "Editar Usuario" : "Nuevo Usuario"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} onClick={() => (document.getElementById("user-form") as HTMLFormElement)?.requestSubmit()}>
            {isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ej: dr.garcia"
          required
          autoFocus
        />
        <Input
          label="Nombre para mostrar"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="ej: Dr. Carlos García"
          required
        />
        <Select
          label="Rol"
          options={roleOptions}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        />
        {role === "doctor" && doctorOptions.length > 0 && (
          <Select
            label="Doctor asociado"
            options={[{ value: "", label: "— Seleccionar doctor —" }, ...doctorOptions]}
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            hint="Vincula esta cuenta con un registro profesional."
          />
        )}
        {!isEditing && (
          <Input
            label="Contraseña inicial"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            hint="El usuario deberá cambiarla en su primer ingreso."
            required
          />
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
