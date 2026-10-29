/**
 * The engine stores paragraph measurements in twips (indents) and points
 * (space before/after). The Paragraph dialog shows them in whatever unit the
 * writer reads best, so every value crosses this table on its way in and out.
 *
 * Conversions go through points: it is the one unit both sides speak, and it
 * keeps the table to a single multiplier per unit. 字符 is the exception — it
 * is an em of the selection's font, so its multiplier is resolved per call.
 */
export type MeasureUnit = "pt" | "in" | "cm" | "mm" | "char";

export const MEASURE_UNITS: ReadonlyArray<{ value: MeasureUnit; label: string }> = [
  { value: "pt", label: "磅" },
  { value: "in", label: "英寸" },
  { value: "cm", label: "厘米" },
  { value: "mm", label: "毫米" },
  { value: "char", label: "字符" },
];

/** Points in one unit, for every unit whose size does not depend on the font. */
const POINTS_PER_UNIT = { pt: 1, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 } as const;

const TWIPS_PER_POINT = 20;

/** 五号 — the size a Chinese body paragraph starts at when nothing says otherwise. */
export const DEFAULT_CHAR_POINTS = 10.5;

export function pointsPerUnit(unit: MeasureUnit, charPoints: number): number {
  return unit === "char" ? charPoints : POINTS_PER_UNIT[unit];
}

/** A dialog value for a twips measurement (indents), rounded for display. */
export function twipsToUnit(twips: number, unit: MeasureUnit, charPoints: number): number {
  return roundForDisplay(twips / TWIPS_PER_POINT / pointsPerUnit(unit, charPoints));
}

export function unitToTwips(value: number, unit: MeasureUnit, charPoints: number): number {
  return Math.round(value * pointsPerUnit(unit, charPoints) * TWIPS_PER_POINT);
}

/** A dialog value for a points measurement (space before/after). */
export function pointsToUnit(points: number, unit: MeasureUnit, charPoints: number): number {
  return roundForDisplay(points / pointsPerUnit(unit, charPoints));
}

export function unitToPoints(value: number, unit: MeasureUnit, charPoints: number): number {
  return roundForDisplay(value * pointsPerUnit(unit, charPoints));
}

/** How much one arrow press moves the input, per unit. */
export function stepForUnit(unit: MeasureUnit): number {
  switch (unit) {
    case "mm":
      return 1;
    case "pt":
    case "char":
      return 0.5;
    default:
      return 0.1;
  }
}

/**
 * Two decimals, because that is the precision Word shows and the precision
 * these units need: 1 mm is 0.1 cm, and 1 twip is 0.0007 cm — anything finer
 * is noise the writer cannot act on.
 */
function roundForDisplay(value: number): number {
  return Math.round(value * 100) / 100;
}
