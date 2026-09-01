import { useMemo } from "react";
import type { Prize } from "../types";

interface SpinWheelProps {
  prizes: Prize[];
  rotation: number; // grados de rotación acumulados
  spinning: boolean;
  size?: number;
  onSpin?: () => void;
  canSpin?: boolean;
}

/**
 * Ruleta SVG estilo "premios": aro dorado con luces, puntero marcado y
 * botón central de girar. La probabilidad real la maneja el backend por peso.
 * El puntero fijo está arriba (12 en punto).
 */
export default function SpinWheel({
  prizes,
  rotation,
  spinning,
  size = 440,
  onSpin,
  canSpin = true,
}: SpinWheelProps) {
  const radius = size / 2;
  const wheelR = radius - 26; // deja espacio para el aro exterior con luces
  const n = Math.max(prizes.length, 1);
  const segAngle = 360 / n;

  const segments = useMemo(() => {
    return prizes.map((prize, i) => {
      const start = i * segAngle;
      const end = start + segAngle;
      const toXY = (angleDeg: number, r: number) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return { x: radius + r * Math.cos(rad), y: radius + r * Math.sin(rad) };
      };
      const p1 = toXY(start, wheelR);
      const p2 = toXY(end, wheelR);
      const largeArc = segAngle > 180 ? 1 : 0;
      const path = `M ${radius} ${radius} L ${p1.x} ${p1.y} A ${wheelR} ${wheelR} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
      const midAngle = start + segAngle / 2;
      const labelRad = ((midAngle - 90) * Math.PI) / 180;
      const lx = radius + wheelR * 0.6 * Math.cos(labelRad);
      const ly = radius + wheelR * 0.6 * Math.sin(labelRad);
      return { prize, path, lx, ly, midAngle };
    });
  }, [prizes, segAngle, radius, wheelR]);

  // Luces del aro exterior (bombillas tipo marquesina de casino).
  const lights = useMemo(() => {
    const count = 24;
    const lr = radius - 11;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI;
      return {
        x: radius + lr * Math.cos(angle),
        y: radius + lr * Math.sin(angle),
        idx: i,
      };
    });
  }, [radius]);

  // Parte el nombre en varias líneas (por palabras) para que entre en el segmento
  // sin recortar con puntos suspensivos.
  const wrapLabel = (name: string, maxPerLine = 12, maxLines = 3): string[] => {
    const words = name.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      if ((current + " " + w).trim().length <= maxPerLine) {
        current = (current + " " + w).trim();
      } else {
        if (current) lines.push(current);
        current = w;
      }
      if (lines.length === maxLines - 1 && current.length >= maxPerLine) {
        break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    // Si sobran palabras y llegamos al tope, truncar la última línea con …
    if (lines.length === maxLines) {
      const used = lines.join(" ").split(/\s+/).length;
      if (used < words.length) lines[maxLines - 1] = lines[maxLines - 1] + "…";
    }
    return lines;
  };

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      {/* Puntero superior */}
      <div className="absolute left-1/2 top-1 z-20 -translate-x-1/2 drop-shadow-lg">
        <svg width="40" height="44" viewBox="0 0 40 44">
          <path d="M20 44 L2 8 Q20 -4 38 8 Z" fill="#dc2626" stroke="#fff" strokeWidth="2" />
          <circle cx="20" cy="12" r="5" fill="#fff" />
        </svg>
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Aro exterior dorado */}
        <defs>
          <radialGradient id="goldRing" cx="50%" cy="50%" r="50%">
            <stop offset="82%" stopColor="#fbbf24" />
            <stop offset="92%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
          <filter id="bulbGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={radius} cy={radius} r={radius - 2} fill="url(#goldRing)" />

        {/* Bombillas del aro con resplandor y animación de marquesina */}
        {lights.map((l) => (
          <g key={l.idx}>
            {/* halo */}
            <circle
              cx={l.x}
              cy={l.y}
              r={7}
              fill="#fff7cc"
              filter="url(#bulbGlow)"
              className="wheel-bulb"
              style={{ animationDelay: `${(l.idx % 6) * 0.12}s`, animationDuration: spinning ? "0.5s" : "1.2s" }}
            />
            {/* bombilla */}
            <circle
              cx={l.x}
              cy={l.y}
              r={3.8}
              fill="#fffde7"
              className="wheel-bulb"
              style={{ animationDelay: `${(l.idx % 6) * 0.12}s`, animationDuration: spinning ? "0.5s" : "1.2s" }}
            />
          </g>
        ))}

        {/* Rueda giratoria */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${radius}px ${radius}px`,
            transition: spinning
              ? "transform 5.5s cubic-bezier(0.12, 0.8, 0.08, 1)"
              : "none",
          }}
        >
          {prizes.length === 0 ? (
            <circle cx={radius} cy={radius} r={wheelR} fill="#e5e7eb" />
          ) : (
            segments.map(({ prize, path, lx, ly, midAngle }) => (
              <g key={prize.id}>
                <path d={path} fill={prize.color} stroke="#ffffff" strokeWidth={3} />
                {(() => {
                  const lines = wrapLabel(prize.name);
                  const lineHeight = 15;
                  const startDy = -((lines.length - 1) * lineHeight) / 2;
                  return (
                    <text
                      x={lx}
                      y={ly}
                      fill="#ffffff"
                      fontSize={14}
                      fontWeight={700}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${midAngle} ${lx} ${ly})`}
                      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 2.5 }}
                    >
                      {lines.map((line, li) => (
                        <tspan key={li} x={lx} dy={li === 0 ? startDy : lineHeight}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                })()}
              </g>
            ))
          )}
        </g>

        {/* Botón central GIRAR */}
        <g
          onClick={!spinning && canSpin ? onSpin : undefined}
          style={{ cursor: !spinning && canSpin ? "pointer" : "default" }}
        >
          <circle cx={radius} cy={radius} r={48} fill="#ffffff" stroke="#f59e0b" strokeWidth={5} />
          <circle cx={radius} cy={radius} r={48} fill={spinning || !canSpin ? "rgba(0,0,0,0.05)" : "transparent"} />
          <text
            x={radius}
            y={radius}
            fill={canSpin && !spinning ? "#dc2626" : "#9ca3af"}
            fontSize={18}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {spinning ? "..." : "GIRAR"}
          </text>
        </g>
      </svg>
    </div>
  );
}
