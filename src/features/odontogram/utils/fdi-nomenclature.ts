/**
 * FDI (Fédération Dentaire Internationale) Two-Digit Notation System
 *
 * Quadrants:
 * - 1: Upper right (permanent)
 * - 2: Upper left (permanent)
 * - 3: Lower left (permanent)
 * - 4: Lower right (permanent)
 * - 5: Upper right (deciduous)
 * - 6: Upper left (deciduous)
 * - 7: Lower left (deciduous)
 * - 8: Lower right (deciduous)
 *
 * Teeth numbered 1-8 (permanent) or 1-5 (deciduous) from center.
 */

export type ToothFace = "vestibular" | "lingual" | "mesial" | "distal" | "oclusal" | "incisal" | "full";

export type DentitionType = "permanent" | "deciduous";

export interface ToothInfo {
  number: string;
  name: string;
  quadrant: number;
  position: number;
  type: "incisor" | "canine" | "premolar" | "molar";
  arch: "upper" | "lower";
  side: "right" | "left";
}

// Permanent teeth (32 total)
export const PERMANENT_TEETH: ToothInfo[] = [
  // Upper right (Q1): 18-11
  { number: "18", name: "3er Molar sup. der.", quadrant: 1, position: 8, type: "molar", arch: "upper", side: "right" },
  { number: "17", name: "2do Molar sup. der.", quadrant: 1, position: 7, type: "molar", arch: "upper", side: "right" },
  { number: "16", name: "1er Molar sup. der.", quadrant: 1, position: 6, type: "molar", arch: "upper", side: "right" },
  { number: "15", name: "2do Premolar sup. der.", quadrant: 1, position: 5, type: "premolar", arch: "upper", side: "right" },
  { number: "14", name: "1er Premolar sup. der.", quadrant: 1, position: 4, type: "premolar", arch: "upper", side: "right" },
  { number: "13", name: "Canino sup. der.", quadrant: 1, position: 3, type: "canine", arch: "upper", side: "right" },
  { number: "12", name: "Incisivo lateral sup. der.", quadrant: 1, position: 2, type: "incisor", arch: "upper", side: "right" },
  { number: "11", name: "Incisivo central sup. der.", quadrant: 1, position: 1, type: "incisor", arch: "upper", side: "right" },
  // Upper left (Q2): 21-28
  { number: "21", name: "Incisivo central sup. izq.", quadrant: 2, position: 1, type: "incisor", arch: "upper", side: "left" },
  { number: "22", name: "Incisivo lateral sup. izq.", quadrant: 2, position: 2, type: "incisor", arch: "upper", side: "left" },
  { number: "23", name: "Canino sup. izq.", quadrant: 2, position: 3, type: "canine", arch: "upper", side: "left" },
  { number: "24", name: "1er Premolar sup. izq.", quadrant: 2, position: 4, type: "premolar", arch: "upper", side: "left" },
  { number: "25", name: "2do Premolar sup. izq.", quadrant: 2, position: 5, type: "premolar", arch: "upper", side: "left" },
  { number: "26", name: "1er Molar sup. izq.", quadrant: 2, position: 6, type: "molar", arch: "upper", side: "left" },
  { number: "27", name: "2do Molar sup. izq.", quadrant: 2, position: 7, type: "molar", arch: "upper", side: "left" },
  { number: "28", name: "3er Molar sup. izq.", quadrant: 2, position: 8, type: "molar", arch: "upper", side: "left" },
  // Lower left (Q3): 38-31
  { number: "38", name: "3er Molar inf. izq.", quadrant: 3, position: 8, type: "molar", arch: "lower", side: "left" },
  { number: "37", name: "2do Molar inf. izq.", quadrant: 3, position: 7, type: "molar", arch: "lower", side: "left" },
  { number: "36", name: "1er Molar inf. izq.", quadrant: 3, position: 6, type: "molar", arch: "lower", side: "left" },
  { number: "35", name: "2do Premolar inf. izq.", quadrant: 3, position: 5, type: "premolar", arch: "lower", side: "left" },
  { number: "34", name: "1er Premolar inf. izq.", quadrant: 3, position: 4, type: "premolar", arch: "lower", side: "left" },
  { number: "33", name: "Canino inf. izq.", quadrant: 3, position: 3, type: "canine", arch: "lower", side: "left" },
  { number: "32", name: "Incisivo lateral inf. izq.", quadrant: 3, position: 2, type: "incisor", arch: "lower", side: "left" },
  { number: "31", name: "Incisivo central inf. izq.", quadrant: 3, position: 1, type: "incisor", arch: "lower", side: "left" },
  // Lower right (Q4): 41-48
  { number: "41", name: "Incisivo central inf. der.", quadrant: 4, position: 1, type: "incisor", arch: "lower", side: "right" },
  { number: "42", name: "Incisivo lateral inf. der.", quadrant: 4, position: 2, type: "incisor", arch: "lower", side: "right" },
  { number: "43", name: "Canino inf. der.", quadrant: 4, position: 3, type: "canine", arch: "lower", side: "right" },
  { number: "44", name: "1er Premolar inf. der.", quadrant: 4, position: 4, type: "premolar", arch: "lower", side: "right" },
  { number: "45", name: "2do Premolar inf. der.", quadrant: 4, position: 5, type: "premolar", arch: "lower", side: "right" },
  { number: "46", name: "1er Molar inf. der.", quadrant: 4, position: 6, type: "molar", arch: "lower", side: "right" },
  { number: "47", name: "2do Molar inf. der.", quadrant: 4, position: 7, type: "molar", arch: "lower", side: "right" },
  { number: "48", name: "3er Molar inf. der.", quadrant: 4, position: 8, type: "molar", arch: "lower", side: "right" },
];

// Deciduous teeth (20 total)
export const DECIDUOUS_TEETH: ToothInfo[] = [
  // Upper right (Q5): 55-51
  { number: "55", name: "2do Molar temp. sup. der.", quadrant: 5, position: 5, type: "molar", arch: "upper", side: "right" },
  { number: "54", name: "1er Molar temp. sup. der.", quadrant: 5, position: 4, type: "molar", arch: "upper", side: "right" },
  { number: "53", name: "Canino temp. sup. der.", quadrant: 5, position: 3, type: "canine", arch: "upper", side: "right" },
  { number: "52", name: "Incisivo lateral temp. sup. der.", quadrant: 5, position: 2, type: "incisor", arch: "upper", side: "right" },
  { number: "51", name: "Incisivo central temp. sup. der.", quadrant: 5, position: 1, type: "incisor", arch: "upper", side: "right" },
  // Upper left (Q6): 61-65
  { number: "61", name: "Incisivo central temp. sup. izq.", quadrant: 6, position: 1, type: "incisor", arch: "upper", side: "left" },
  { number: "62", name: "Incisivo lateral temp. sup. izq.", quadrant: 6, position: 2, type: "incisor", arch: "upper", side: "left" },
  { number: "63", name: "Canino temp. sup. izq.", quadrant: 6, position: 3, type: "canine", arch: "upper", side: "left" },
  { number: "64", name: "1er Molar temp. sup. izq.", quadrant: 6, position: 4, type: "molar", arch: "upper", side: "left" },
  { number: "65", name: "2do Molar temp. sup. izq.", quadrant: 6, position: 5, type: "molar", arch: "upper", side: "left" },
  // Lower left (Q7): 75-71
  { number: "75", name: "2do Molar temp. inf. izq.", quadrant: 7, position: 5, type: "molar", arch: "lower", side: "left" },
  { number: "74", name: "1er Molar temp. inf. izq.", quadrant: 7, position: 4, type: "molar", arch: "lower", side: "left" },
  { number: "73", name: "Canino temp. inf. izq.", quadrant: 7, position: 3, type: "canine", arch: "lower", side: "left" },
  { number: "72", name: "Incisivo lateral temp. inf. izq.", quadrant: 7, position: 2, type: "incisor", arch: "lower", side: "left" },
  { number: "71", name: "Incisivo central temp. inf. izq.", quadrant: 7, position: 1, type: "incisor", arch: "lower", side: "left" },
  // Lower right (Q8): 81-85
  { number: "81", name: "Incisivo central temp. inf. der.", quadrant: 8, position: 1, type: "incisor", arch: "lower", side: "right" },
  { number: "82", name: "Incisivo lateral temp. inf. der.", quadrant: 8, position: 2, type: "incisor", arch: "lower", side: "right" },
  { number: "83", name: "Canino temp. inf. der.", quadrant: 8, position: 3, type: "canine", arch: "lower", side: "right" },
  { number: "84", name: "1er Molar temp. inf. der.", quadrant: 8, position: 4, type: "molar", arch: "lower", side: "right" },
  { number: "85", name: "2do Molar temp. inf. der.", quadrant: 8, position: 5, type: "molar", arch: "lower", side: "right" },
];

/**
 * Get the faces available for a tooth type.
 * Anterior teeth (incisors, canines) have "incisal" instead of "oclusal".
 */
export function getToothFaces(toothType: ToothInfo["type"]): ToothFace[] {
  const occlusionFace: ToothFace = toothType === "incisor" || toothType === "canine" ? "incisal" : "oclusal";
  return ["vestibular", "lingual", "mesial", "distal", occlusionFace];
}

export function getTeethForDentition(type: DentitionType): ToothInfo[] {
  return type === "permanent" ? PERMANENT_TEETH : DECIDUOUS_TEETH;
}

export function getToothByNumber(number: string): ToothInfo | undefined {
  return [...PERMANENT_TEETH, ...DECIDUOUS_TEETH].find((t) => t.number === number);
}
