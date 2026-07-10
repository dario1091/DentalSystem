/**
 * Tooth Geometry for Canvas Rendering
 *
 * Each tooth is rendered as a simplified diagram:
 * - A square divided into 5 regions (cross pattern):
 *   - Center: oclusal/incisal face
 *   - Top: vestibular (upper arch) or lingual (lower arch)
 *   - Bottom: lingual (upper arch) or vestibular (lower arch)
 *   - Left: mesial or distal depending on side
 *   - Right: distal or mesial depending on side
 *
 * Layout:
 * Upper arch: 18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
 * Lower arch: 48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
 */

import type { ToothFace, ToothInfo, DentitionType } from "./fdi-nomenclature";
import { getTeethForDentition } from "./fdi-nomenclature";

export const TOOTH_SIZE = 36; // px per tooth cell
export const TOOTH_GAP = 4;  // px between teeth
export const ARCH_GAP = 24;  // px between upper and lower arch
export const PADDING = 16;   // canvas padding

export interface ToothGeometry {
  number: string;
  x: number; // top-left x
  y: number; // top-left y
  size: number;
  faces: FaceGeometry[];
}

export interface FaceGeometry {
  face: ToothFace;
  path: Path2D | null; // Will be created at render time
  // Relative bounds within the tooth cell (0-1 normalized)
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Face layout within a tooth square (cross pattern):
 *
 *  ┌──────────────────┐
 *  │    top (vest/ling)│
 *  ├────┬────────┬────┤
 *  │left│ center │rght│
 *  ├────┴────────┴────┤
 *  │   bottom         │
 *  └──────────────────┘
 *
 * For faces we use a border=25% / center=50% split.
 */
const FACE_BORDER = 0.25; // 25% for border faces
const FACE_CENTER_START = FACE_BORDER;
const FACE_CENTER_SIZE = 1 - 2 * FACE_BORDER; // 50%

/**
 * Get the 5 face regions for a tooth.
 * Face mapping depends on arch and side:
 * - Upper arch: top=vestibular, bottom=lingual (palatino)
 * - Lower arch: top=lingual, bottom=vestibular
 * - Right side (Q1, Q4): left=distal, right=mesial
 * - Left side (Q2, Q3): left=mesial, right=distal
 */
export function getToothFaceLayout(
  tooth: ToothInfo,
): { face: ToothFace; x: number; y: number; width: number; height: number }[] {
  const isUpper = tooth.arch === "upper";
  const isRightSide = tooth.side === "right";

  const topFace: ToothFace = isUpper ? "vestibular" : "lingual";
  const bottomFace: ToothFace = isUpper ? "lingual" : "vestibular";
  const leftFace: ToothFace = isRightSide ? "distal" : "mesial";
  const rightFace: ToothFace = isRightSide ? "mesial" : "distal";
  const centerFace: ToothFace = tooth.type === "incisor" || tooth.type === "canine" ? "incisal" : "oclusal";

  return [
    // Top
    { face: topFace, x: FACE_BORDER, y: 0, width: FACE_CENTER_SIZE, height: FACE_BORDER },
    // Bottom
    { face: bottomFace, x: FACE_BORDER, y: 1 - FACE_BORDER, width: FACE_CENTER_SIZE, height: FACE_BORDER },
    // Left
    { face: leftFace, x: 0, y: FACE_BORDER, width: FACE_BORDER, height: FACE_CENTER_SIZE },
    // Right
    { face: rightFace, x: 1 - FACE_BORDER, y: FACE_BORDER, width: FACE_BORDER, height: FACE_CENTER_SIZE },
    // Center (oclusal/incisal)
    { face: centerFace, x: FACE_CENTER_START, y: FACE_CENTER_START, width: FACE_CENTER_SIZE, height: FACE_CENTER_SIZE },
  ];
}

/**
 * Calculate the full layout of teeth positions for a given dentition.
 * Returns array of ToothGeometry with absolute pixel positions.
 */
export function calculateLayout(dentition: DentitionType): ToothGeometry[] {
  const teeth = getTeethForDentition(dentition);
  const geometry: ToothGeometry[] = [];

  const upperTeeth = teeth.filter((t) => t.arch === "upper");
  const lowerTeeth = teeth.filter((t) => t.arch === "lower");

  // Layout upper arch (left to right as displayed: Q1 right to Q2 right)
  upperTeeth.forEach((tooth, index) => {
    const x = PADDING + index * (TOOTH_SIZE + TOOTH_GAP);
    const y = PADDING;

    const faces = getToothFaceLayout(tooth).map((f) => ({
      face: f.face,
      path: null,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
    }));

    geometry.push({ number: tooth.number, x, y, size: TOOTH_SIZE, faces });
  });

  // Layout lower arch
  lowerTeeth.forEach((tooth, index) => {
    const x = PADDING + index * (TOOTH_SIZE + TOOTH_GAP);
    const y = PADDING + TOOTH_SIZE + ARCH_GAP;

    const faces = getToothFaceLayout(tooth).map((f) => ({
      face: f.face,
      path: null,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
    }));

    geometry.push({ number: tooth.number, x, y, size: TOOTH_SIZE, faces });
  });

  return geometry;
}

/**
 * Calculate total canvas dimensions for a dentition layout.
 */
export function getCanvasSize(dentition: DentitionType): { width: number; height: number } {
  const teethPerArch = dentition === "permanent" ? 16 : 10;
  const width = PADDING * 2 + teethPerArch * TOOTH_SIZE + (teethPerArch - 1) * TOOTH_GAP;
  const height = PADDING * 2 + 2 * TOOTH_SIZE + ARCH_GAP;
  return { width, height };
}

/**
 * Hit test: given a mouse position, determine which tooth face was clicked.
 */
export function hitTest(
  mouseX: number,
  mouseY: number,
  layout: ToothGeometry[],
): { toothNumber: string; face: ToothFace } | null {
  for (const tooth of layout) {
    // Check if inside tooth bounds
    if (
      mouseX >= tooth.x &&
      mouseX <= tooth.x + tooth.size &&
      mouseY >= tooth.y &&
      mouseY <= tooth.y + tooth.size
    ) {
      // Find which face
      for (const faceGeo of tooth.faces) {
        const fx = tooth.x + faceGeo.x * tooth.size;
        const fy = tooth.y + faceGeo.y * tooth.size;
        const fw = faceGeo.width * tooth.size;
        const fh = faceGeo.height * tooth.size;

        if (mouseX >= fx && mouseX <= fx + fw && mouseY >= fy && mouseY <= fy + fh) {
          return { toothNumber: tooth.number, face: faceGeo.face };
        }
      }
      // If somehow in tooth but not in any face, return center
      return { toothNumber: tooth.number, face: tooth.faces[4].face };
    }
  }
  return null;
}

/**
 * Finding types with display colors.
 */
export const FINDING_TYPES: {
  id: string;
  label: string;
  color: string;
  fullTooth?: boolean;
}[] = [
  { id: "caries", label: "Caries", color: "#EF4444" },
  { id: "obturacion_resina", label: "Obturación resina", color: "#3B82F6" },
  { id: "obturacion_amalgama", label: "Obturación amalgama", color: "#6B7280" },
  { id: "obturacion_temporal", label: "Obturación temporal", color: "#8B5CF6" },
  { id: "corona", label: "Corona", color: "#F59E0B", fullTooth: true },
  { id: "ausente", label: "Ausente", color: "#111827", fullTooth: true },
  { id: "endodoncia", label: "Endodoncia", color: "#EC4899", fullTooth: true },
  { id: "fractura", label: "Fractura", color: "#DC2626" },
  { id: "implante", label: "Implante", color: "#14B8A6", fullTooth: true },
  { id: "protesis_fija", label: "Prótesis fija", color: "#F97316", fullTooth: true },
  { id: "protesis_removible", label: "Prótesis removible", color: "#A855F7", fullTooth: true },
  { id: "sellante", label: "Sellante", color: "#22C55E" },
  { id: "movilidad", label: "Movilidad", color: "#EAB308", fullTooth: true },
  { id: "retenido", label: "Retenido/Incluido", color: "#78716C", fullTooth: true },
  { id: "supernumerario", label: "Supernumerario", color: "#06B6D4", fullTooth: true },
  { id: "diastema", label: "Diastema", color: "#84CC16" },
  { id: "placa_bacteriana", label: "Placa bacteriana", color: "#FCA5A5" },
  { id: "calculo", label: "Cálculo dental", color: "#92400E" },
];

export function getFindingColor(findingType: string): string {
  return FINDING_TYPES.find((f) => f.id === findingType)?.color || "#9CA3AF";
}

export function isFindingFullTooth(findingType: string): boolean {
  return FINDING_TYPES.find((f) => f.id === findingType)?.fullTooth ?? false;
}
