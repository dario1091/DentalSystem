import { useEffect, useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useRewards } from "../hooks/useRewards";
import type { Prize } from "../types";
import { PRIZE_COLORS } from "../types";

interface PrizesAdminProps {
  onChanged: () => void;
}

interface DraftPrize {
  name: string;
  color: string;
  weight: number;
  validity_days: number;
  active: boolean;
}

const emptyDraft: DraftPrize = { name: "", color: PRIZE_COLORS[0], weight: 1, validity_days: 30, active: true };

export default function PrizesAdmin({ onChanged }: PrizesAdminProps) {
  const { toast } = useToast();
  const { listPrizes, createPrize, updatePrize, deletePrize } = useRewards();

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftPrize>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Prize | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setPrizes(await listPrizes(false));
    } catch (err) {
      toast("error", String(err));
    }
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const startEdit = (p: Prize) => {
    setEditingId(p.id);
    setCreating(false);
    setDraft({ name: p.name, color: p.color, weight: p.weight, validity_days: p.validity_days, active: p.active });
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast("error", "El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        await createPrize({
          name: draft.name,
          color: draft.color,
          weight: draft.weight,
          validity_days: draft.validity_days,
        });
        toast("success", "Premio creado.");
      } else if (editingId != null) {
        await updatePrize({
          id: editingId,
          name: draft.name,
          color: draft.color,
          weight: draft.weight,
          validity_days: draft.validity_days,
          active: draft.active,
        });
        toast("success", "Premio actualizado.");
      }
      cancel();
      await load();
      onChanged();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Prize) => {
    setDeleting(true);
    try {
      await deletePrize(p.id);
      toast("success", "Premio eliminado.");
      setConfirmDelete(null);
      await load();
      onChanged();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setDeleting(false);
    }
  };

  const isEditingRow = creating || editingId != null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        El "peso" define la probabilidad relativa: un premio con peso 2 sale el doble de seguido que uno con peso 1.
        La "validez" son los días que dura el premio antes de vencer.
      </p>

      {/* Lista */}
      <div className="space-y-2">
        {prizes.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <span className="h-6 w-6 rounded-full" style={{ backgroundColor: p.color }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{p.name}</span>
                  {!p.active && <Badge variant="neutral">Inactivo</Badge>}
                </div>
                <span className="text-xs text-gray-500">Peso: {p.weight} · Validez: {p.validity_days} días</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>Editar</Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(p)} />
            </div>
          </div>
        ))}
        {prizes.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">No hay premios. Agregue el primero.</p>
        )}
      </div>

      {/* Editor */}
      {isEditingRow ? (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-gray-700">{creating ? "Nuevo premio" : "Editar premio"}</h4>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Nombre</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej: 10% descuento en calzas"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Peso (probabilidad)</label>
              <input
                type="number"
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.5"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Validez (días)</label>
              <input
                type="number"
                value={draft.validity_days}
                onChange={(e) => setDraft({ ...draft, validity_days: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRIZE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`h-7 w-7 rounded-full border-2 ${draft.color === c ? "border-gray-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {!creating && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Activo (entra en la ruleta)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={cancel}>Cancelar</Button>
            <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={startCreate}>
          Agregar premio
        </Button>
      )}

      {/* Confirmación de eliminación */}
      {confirmDelete && (
        <Modal isOpen onClose={() => setConfirmDelete(null)} title="Eliminar premio" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              ¿Eliminar el premio <span className="font-semibold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-gray-500">
              Los premios que los pacientes ya ganaron se conservan en su historial. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => remove(confirmDelete)}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
