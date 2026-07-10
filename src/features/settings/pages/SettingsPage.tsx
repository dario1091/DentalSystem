import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Save, Download, Upload, Clock, AlertTriangle } from "lucide-react";
import { Button, Badge } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";

interface BackupInfo {
  file_name: string;
  path: string;
  size: number;
  created_at: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);

  const loadData = async () => {
    try {
      const [settingsData, backupsList, lastDate] = await Promise.all([
        invoke<[string, string][]>("get_settings"),
        invoke<BackupInfo[]>("list_backups"),
        invoke<string | null>("get_last_backup_date"),
      ]);

      const map: Record<string, string> = {};
      settingsData.forEach(([k, v]) => { map[k] = v; });
      setSettings(map);
      setBackups(backupsList);
      setLastBackup(lastDate);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: [string, string][] = Object.entries(settings);
      await invoke("update_settings", { settings: entries });
      toast("success", "Configuración guardada.");
    } catch (err) {
      toast("error", String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setCreatingBackup(true);
    try {
      const path = await invoke<string>("create_backup");
      toast("success", `Backup creado: ${path.split(/[\\/]/).pop()}`);
      await loadData();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestore = async (path: string) => {
    if (!confirm("⚠️ ADVERTENCIA: Restaurar un backup reemplazará TODOS los datos actuales. ¿Está seguro?")) return;
    if (!confirm("Esta acción NO se puede deshacer. ¿Confirma la restauración?")) return;

    try {
      await invoke("restore_backup", { zipPath: path });
      toast("success", "Backup restaurado. Reinicie la aplicación para aplicar los cambios.");
    } catch (err) {
      toast("error", String(err));
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const daysSinceLastBackup = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Cargando configuración...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        </div>
        <Button variant="primary" icon={<Save size={14} />} onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {/* Datos del consultorio */}
      <Section title="Datos del Consultorio">
        <Field label="Nombre del consultorio" value={settings.clinic_name || ""} onChange={(v) => updateSetting("clinic_name", v)} />
        <Field label="NIT / Identificación" value={settings.clinic_nit || ""} onChange={(v) => updateSetting("clinic_nit", v)} />
        <Field label="Dirección" value={settings.clinic_address || ""} onChange={(v) => updateSetting("clinic_address", v)} />
        <Field label="Teléfono" value={settings.clinic_phone || ""} onChange={(v) => updateSetting("clinic_phone", v)} />
      </Section>

      {/* Seguridad */}
      <Section title="Seguridad">
        <Field label="Timeout de sesión (minutos)" value={settings.session_timeout_minutes || "30"} onChange={(v) => updateSetting("session_timeout_minutes", v)} type="number" />
        <Field label="Intentos máximos de login" value={settings.max_login_attempts || "5"} onChange={(v) => updateSetting("max_login_attempts", v)} type="number" />
      </Section>

      {/* Backup */}
      <Section title="Backup">
        {/* Last backup indicator */}
        <div className="mb-4 flex items-center gap-3">
          <Clock size={16} className="text-gray-400" />
          <span className="text-sm text-gray-600">
            Último backup:{" "}
            {lastBackup ? (
              <>
                {lastBackup}
                {daysSinceLastBackup !== null && daysSinceLastBackup > 7 && (
                  <Badge variant="warning" className="ml-2">
                    <AlertTriangle size={10} className="mr-1" />
                    Hace más de 7 días
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-red-500">Nunca</span>
            )}
          </span>
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            icon={<Download size={14} />}
            onClick={handleBackup}
            disabled={creatingBackup}
          >
            {creatingBackup ? "Creando backup..." : "Backup Ahora"}
          </Button>
        </div>

        {/* Backup list */}
        {backups.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500">Backups disponibles ({backups.length}):</p>
            {backups.slice(0, 10).map((b) => (
              <div key={b.file_name} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">{b.file_name}</p>
                  <p className="text-xs text-gray-400">{b.created_at} · {formatSize(b.size)}</p>
                </div>
                <Button variant="ghost" size="sm" icon={<Upload size={12} />} onClick={() => handleRestore(b.path)}>
                  Restaurar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
