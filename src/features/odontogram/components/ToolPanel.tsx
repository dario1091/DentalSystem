import { Undo2, Eraser } from "lucide-react";
import { Button } from "@shared/components/ui";
import { FINDING_TYPES } from "../utils/tooth-geometry";

interface ToolPanelProps {
  selectedTool: string | null;
  onSelectTool: (toolId: string | null) => void;
  onUndo: () => void;
  canUndo: boolean;
  readOnly?: boolean;
}

export default function ToolPanel({
  selectedTool,
  onSelectTool,
  onUndo,
  canUndo,
  readOnly = false,
}: ToolPanelProps) {
  if (readOnly) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 w-56">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-gray-500">Herramientas</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<Eraser size={14} />}
            onClick={() => onSelectTool(selectedTool === "__eraser" ? null : "__eraser")}
            className={selectedTool === "__eraser" ? "!bg-red-100 !text-red-700" : ""}
            title="Borrador"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<Undo2 size={14} />}
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer"
          />
        </div>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {FINDING_TYPES.map((finding) => {
          const isSelected = selectedTool === finding.id;
          return (
            <button
              key={finding.id}
              type="button"
              onClick={() => onSelectTool(isSelected ? null : finding.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                isSelected
                  ? "bg-blue-50 ring-1 ring-blue-300"
                  : "hover:bg-gray-50"
              }`}
            >
              <span
                className="h-3 w-3 rounded-sm shrink-0 border border-gray-300"
                style={{ backgroundColor: finding.color }}
              />
              <span className="truncate text-gray-700">{finding.label}</span>
              {finding.fullTooth && (
                <span className="ml-auto text-[10px] text-gray-400" title="Afecta diente completo">
                  ⬜
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected tool indicator */}
      {selectedTool && selectedTool !== "__eraser" && (
        <div className="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
          <strong>Activo:</strong> {FINDING_TYPES.find((f) => f.id === selectedTool)?.label}
          <br />
          <span className="text-blue-500">Click en una cara del diente para aplicar</span>
        </div>
      )}
      {selectedTool === "__eraser" && (
        <div className="rounded border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          <strong>Borrador activo</strong>
          <br />
          <span className="text-red-500">Click en una cara para eliminar el hallazgo</span>
        </div>
      )}
    </div>
  );
}
