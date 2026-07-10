import { useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal, Button, Input } from "@shared/components/ui";
import type { UserInfo } from "@store/auth-store";

interface ResetPasswordModalProps {
  user: UserInfo;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await invoke("reset_user_password", {
        userId: user.id,
        newPassword,
      });
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Restablecer contraseña — ${user.display_name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            onClick={() => (document.getElementById("reset-form") as HTMLFormElement)?.requestSubmit()}
          >
            Restablecer
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Se asignará una nueva contraseña al usuario{" "}
          <strong>{user.username}</strong>. Deberá cambiarla en su próximo
          ingreso.
        </p>
        <Input
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
          autoFocus
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repetir contraseña"
          required
          error={
            confirmPassword && newPassword !== confirmPassword
              ? "No coincide"
              : undefined
          }
        />
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
