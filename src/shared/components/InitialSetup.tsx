import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Building2, Upload, ArrowRight } from "lucide-react";
import { Button, Input } from "@shared/components/ui";

interface InitialSetupProps {
  onCompleted: () => void;
}

export default function InitialSetup({ onCompleted }: InitialSetupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleLogoSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
      setError("Solo se permiten imágenes PNG, JPG o WEBP.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async () => {
    if (!clinicName.trim()) {
      setError("El nombre del consultorio es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let logoData: number[] | null = null;
      let logoFileName: string | null = null;

      if (logoFile) {
        const buffer = await logoFile.arrayBuffer();
        logoData = Array.from(new Uint8Array(buffer));
        logoFileName = logoFile.name;
      }

      await invoke("initial_setup", {
        clinicName: clinicName.trim(),
        clinicAddress: clinicAddress.trim(),
        clinicPhone: clinicPhone.trim(),
        logoData,
        logoFileName,
      });

      onCompleted();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Building2 size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Configuración Inicial</h1>
          <p className="mt-2 text-sm text-gray-500">
            Configure los datos de su consultorio. Esta información aparecerá en los PDFs,
            recibos y consentimientos.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre del consultorio *
            </label>
            <Input
              placeholder="Ej: Consultorio Odontológico Sonrisa"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
            <Input
              placeholder="Ej: Calle 50 #30-20, Medellín"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
            <Input
              placeholder="Ej: 604 123 4567"
              value={clinicPhone}
              onChange={(e) => setClinicPhone(e.target.value)}
            />
          </div>

          {/* Logo upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Logo del consultorio (opcional)
            </label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  <Upload size={20} className="text-gray-400" />
                </div>
              )}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? "Cambiar logo" : "Seleccionar imagen"}
                </Button>
                <p className="mt-1 text-xs text-gray-400">PNG, JPG o WEBP. Recomendado: 200x200px</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => handleLogoSelect(e.target.files)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Submit */}
          <Button
            variant="primary"
            className="w-full"
            icon={<ArrowRight size={16} />}
            onClick={handleSubmit}
            disabled={saving || !clinicName.trim()}
          >
            {saving ? "Guardando..." : "Continuar"}
          </Button>

          <p className="text-center text-xs text-gray-400">
            Puede modificar estos datos más tarde en Configuración.
          </p>
        </div>
      </div>
    </div>
  );
}
