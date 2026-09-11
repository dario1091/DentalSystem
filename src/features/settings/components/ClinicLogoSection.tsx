import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Image as ImageIcon, Upload } from "lucide-react";
import { Button, useToast } from "@shared/components/ui";

interface ClinicLogoSectionProps {
  onUpdated?: () => void;
}

export default function ClinicLogoSection({ onUpdated }: ClinicLogoSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadLogo = async () => {
    try {
      const bytes = await invoke<number[] | null>("get_clinic_logo");
      if (bytes && bytes.length > 0) {
        const blob = new Blob([new Uint8Array(bytes)]);
        setLogoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } else {
        setLogoUrl(null);
      }
    } catch {
      setLogoUrl(null);
    }
  };

  useEffect(() => {
    loadLogo();
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast("error", "Seleccione un archivo de imagen (PNG, JPG o WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("error", "La imagen no debe superar 5 MB.");
      return;
    }

    setSaving(true);
    try {
      const buffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      await invoke<string>("save_clinic_logo", { data, fileName: file.name });
      toast("success", "Logo actualizado.");
      await loadLogo();
      onUpdated?.();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Logo del Consultorio</h3>
      <p className="mb-4 text-sm text-gray-500">
        Este logo aparece en el encabezado del PDF del plan de tratamiento. Recomendado: PNG con
        fondo transparente, aprox. 400×400px.
      </p>

      <div className="flex items-center gap-5">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon size={28} className="text-gray-300" />
          )}
        </div>

        <div>
          <Button
            variant="secondary"
            icon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            {saving ? "Guardando..." : logoUrl ? "Cambiar logo" : "Subir logo"}
          </Button>
          <p className="mt-1 text-xs text-gray-400">PNG, JPG o WEBP · máx. 5 MB</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files)}
        />
      </div>
    </div>
  );
}
