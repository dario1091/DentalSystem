import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DentitionType, ToothFace } from "../utils/fdi-nomenclature";
import {
  calculateLayout,
  getCanvasSize,
  hitTest,
} from "../utils/tooth-geometry";
import type { OdontogramFinding } from "../hooks/useOdontogram";

interface OdontogramCanvasProps {
  dentition: DentitionType;
  findings: OdontogramFinding[];
  selectedTool: string | null;
  onFaceClick: (toothNumber: string, face: ToothFace) => void;
  readOnly?: boolean;
}

export default function OdontogramCanvas({
  dentition,
  findings,
  selectedTool,
  onFaceClick,
  readOnly = false,
}: OdontogramCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredFace, setHoveredFace] = useState<{ tooth: string; face: ToothFace } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const layout = useMemo(() => calculateLayout(dentition), [dentition]);
  const canvasSize = useMemo(() => getCanvasSize(dentition), [dentition]);

  // Build findings map: tooth_number -> face -> finding
  const findingsMap = useMemo(() => {
    const map: Record<string, Record<string, OdontogramFinding>> = {};
    for (const f of findings) {
      if (!map[f.tooth_number]) map[f.tooth_number] = {};
      const key = f.face || "full";
      map[f.tooth_number][key] = f;
    }
    return map;
  }, [findings]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    for (const tooth of layout) {
      const toothFindings = findingsMap[tooth.number] || {};
      const hasFullTooth = !!toothFindings["full"];

      // Draw each face
      for (const faceGeo of tooth.faces) {
        const fx = tooth.x + faceGeo.x * tooth.size;
        const fy = tooth.y + faceGeo.y * tooth.size;
        const fw = faceGeo.width * tooth.size;
        const fh = faceGeo.height * tooth.size;

        // Determine fill color
        let fillColor = "#FFFFFF";
        if (hasFullTooth) {
          fillColor = toothFindings["full"].color;
        } else if (toothFindings[faceGeo.face]) {
          fillColor = toothFindings[faceGeo.face].color;
        }

        // Highlight on hover
        const isHovered =
          hoveredFace?.tooth === tooth.number && hoveredFace?.face === faceGeo.face;

        ctx.fillStyle = fillColor;
        ctx.fillRect(fx, fy, fw, fh);

        // Border
        ctx.strokeStyle = isHovered && !readOnly ? "#2563EB" : "#D1D5DB";
        ctx.lineWidth = isHovered && !readOnly ? 1.5 : 0.5;
        ctx.strokeRect(fx, fy, fw, fh);
      }

      // Draw tooth outer border
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 1;
      ctx.strokeRect(tooth.x, tooth.y, tooth.size, tooth.size);

      // Draw tooth number below/above
      ctx.fillStyle = "#4B5563";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      const isUpper = tooth.y < canvasSize.height / 2;
      const labelY = isUpper ? tooth.y + tooth.size + 12 : tooth.y - 4;
      ctx.fillText(tooth.number, tooth.x + tooth.size / 2, labelY);
    }
  }, [layout, canvasSize, findingsMap, hoveredFace, readOnly]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = hitTest(x, y, layout);
    if (hit) {
      setHoveredFace({ tooth: hit.toothNumber, face: hit.face });
      canvas.style.cursor = selectedTool ? "crosshair" : "pointer";

      // Tooltip
      const toothFindings = findingsMap[hit.toothNumber] || {};
      const finding = toothFindings["full"] || toothFindings[hit.face];
      if (finding) {
        setTooltip({
          x: e.clientX - rect.left + 10,
          y: e.clientY - rect.top - 20,
          text: `${hit.toothNumber} (${hit.face}): ${finding.finding_type}`,
        });
      } else {
        setTooltip(null);
      }
    } else {
      setHoveredFace(null);
      setTooltip(null);
      canvas.style.cursor = "default";
    }
  };

  const handleMouseLeave = () => {
    setHoveredFace(null);
    setTooltip(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = hitTest(x, y, layout);
    if (hit) {
      onFaceClick(hit.toothNumber, hit.face);
    }
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        style={{ width: canvasSize.width, height: canvasSize.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="rounded border border-gray-200 bg-white"
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded bg-gray-800 px-2 py-1 text-xs text-white shadow"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
