import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Edit, Save, X, FileText } from "lucide-react";
import { Button, Badge } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";

interface ConsentTemplate {
  id: number;
  key: string;
  name: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}

export default function TemplateEditor() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    try {
      const data = await invoke<ConsentTemplate[]>("list_consent_templates_full");
      setTemplates(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEdit = (template: ConsentTemplate) => {
    setEditing(template);
    setEditName(template.name);
    setEditContent(template.content);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await invoke("update_consent_template", {
        request: {
          id: editing.id,
          name: editName !== editing.name ? editName : null,
          content: editContent !== editing.content ? editContent : null,
        },
      });
      toast("success", "Plantilla actualizada.");
      setEditing(null);
      await loadTemplates();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template: ConsentTemplate) => {
    try {
      await invoke("update_consent_template", {
        request: {
          id: template.id,
          is_active: !template.is_active,
        },
      });
      toast("success", template.is_active ? "Plantilla desactivada." : "Plantilla activada.");
      await loadTemplates();
    } catch (err) {
      toast("error", String(err));
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">Cargando plantillas...</div>;
  }

  // Editing view
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Editar plantilla</h3>
          <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => setEditing(null)}>
            Cancelar
          </Button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de la plantilla</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Contenido (texto que aparecerá en el PDF)
          </label>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm leading-relaxed"
            placeholder="Escriba el contenido del consentimiento..."
          />
          <p className="mt-1 text-xs text-gray-400">
            Cada línea se imprime tal cual en el PDF. Use líneas vacías para separar párrafos.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Plantillas de Consentimiento</h3>
          <p className="text-xs text-gray-500">
            Edite el contenido de cada plantilla. Los cambios se reflejan en futuros consentimientos generados.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <FileText size={16} className="shrink-0 text-blue-500" />
                <p className="text-sm font-medium text-gray-800">{template.name}</p>
                <Badge variant={template.is_active ? "success" : "neutral"}>
                  {template.is_active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <p className="mt-1 truncate pl-6 text-xs text-gray-400">
                {template.content.substring(0, 100)}...
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleActive(template)}
              >
                {template.is_active ? "Desactivar" : "Activar"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit size={14} />}
                onClick={() => handleEdit(template)}
              >
                Editar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
