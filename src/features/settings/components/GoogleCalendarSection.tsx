import { useEffect, useState } from "react";
import { Calendar, Link2, Unlink, CheckCircle2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { Button, Badge, useToast, useConfirm } from "@shared/components/ui";
import { useGoogleCalendar, type GoogleStatus } from "../hooks/useGoogleCalendar";

export default function GoogleCalendarSection() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { getStatus, saveConfig, connect, disconnect } = useGoogleCalendar();

  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced config fields (optional — app ships with embedded credentials).
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [calendarId, setCalendarId] = useState("primary");
  const [timeZone, setTimeZone] = useState("America/Bogota");

  const refresh = async () => {
    try {
      const s = await getStatus();
      setStatus(s);
      if (s.calendar_id) setCalendarId(s.calendar_id);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await saveConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || null,
        calendarId: calendarId.trim() || "primary",
        timeZone: timeZone.trim() || "America/Bogota",
      });
      toast("success", "Configuración guardada.");
      await refresh();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const account = await connect();
      toast("success", `Conectado con Google (${account}).`);
      await refresh();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: "Desconectar Google Calendar",
      message:
        "Se revocará el acceso y las citas dejarán de sincronizarse con Google. ¿Continuar?",
      confirmLabel: "Sí, desconectar",
      danger: true,
    });
    if (!ok) return;
    try {
      await disconnect();
      toast("success", "Google Calendar desconectado.");
      await refresh();
    } catch (err) {
      toast("error", String(err));
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-400">
        Cargando integración con Google Calendar...
      </div>
    );
  }

  const connected = status?.connected ?? false;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Google Calendar</h3>
        </div>
        {connected ? (
          <Badge variant="success">
            <CheckCircle2 size={10} className="mr-1" />
            Conectado
          </Badge>
        ) : (
          <Badge variant="default">Sin conectar</Badge>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Conecta tu cuenta de Google para que las citas se sincronicen automáticamente con tu
        calendario. Al crear, modificar o cancelar una cita, el evento se refleja en Google Calendar.
      </p>

      {connected ? (
        <div className="space-y-4">
          <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Cuenta conectada: <strong>{status?.account_email || "cuenta de Google"}</strong>
            <br />
            Calendario: <strong>{status?.calendar_id || "primary"}</strong>
          </div>
          <Button variant="ghost" icon={<Unlink size={14} />} onClick={handleDisconnect}>
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            variant="primary"
            icon={<Link2 size={14} />}
            onClick={handleConnect}
            disabled={connecting || !status?.has_client_id}
          >
            {connecting ? "Esperando autorización..." : "Conectar con Google"}
          </Button>
          <p className="text-xs text-gray-400">
            {status?.has_client_id
              ? "Se abrirá tu navegador para iniciar sesión con tu cuenta de Google y autorizar el acceso a tu calendario."
              : "Esta versión no incluye credenciales de Google. Ingrésalas en Opciones avanzadas para poder conectar."}
          </p>

          {/* Opciones avanzadas: credenciales propias y calendario/zona horaria */}
          <div className="border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Opciones avanzadas
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                <p className="text-xs text-gray-400">
                  La app ya incluye credenciales por defecto. Solo completa esto si deseas usar tus
                  propias credenciales de Google Cloud.
                </p>
                <Field
                  label="Client ID de OAuth (opcional)"
                  value={clientId}
                  onChange={setClientId}
                  placeholder="xxxxxxxx.apps.googleusercontent.com"
                />
                <Field
                  label="Client Secret (opcional)"
                  value={clientSecret}
                  onChange={setClientSecret}
                  type="password"
                  placeholder="GOCSPX-..."
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="ID del calendario"
                    value={calendarId}
                    onChange={setCalendarId}
                    placeholder="primary"
                  />
                  <Field
                    label="Zona horaria"
                    value={timeZone}
                    onChange={setTimeZone}
                    placeholder="America/Bogota"
                  />
                </div>
                <Button
                  variant="secondary"
                  icon={<Save size={14} />}
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                >
                  {savingConfig ? "Guardando..." : "Guardar configuración"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
