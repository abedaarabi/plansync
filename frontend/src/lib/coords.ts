/** Normalized page coords: x,y in [0,1] relative to page width/height. */

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Distance in PDF user units (same basis as viewport scale 1 width/height). */
export function pdfDistanceUnits(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  pageWidth: number,
  pageHeight: number,
) {
  const dx = (p2.x - p1.x) * pageWidth;
  const dy = (p2.y - p1.y) * pageHeight;
  return Math.hypot(dx, dy);
}

/** PDF default user space: 72 points per inch (PDF 32000-2). */
export const PDF_POINTS_PER_INCH = 72;

/** Convert a length in PDF user units (points) to millimeters for display formatting. */
export function pdfLengthPdfUnitsToMm(pdfLength: number): number {
  return (pdfLength / PDF_POINTS_PER_INCH) * 25.4;
}

/** Display unit for measured lengths (stored values stay in mm). */
export type MeasureUnit = "mm" | "cm" | "m" | "in" | "ft";

export function formatLengthMm(mm: number, unit: MeasureUnit): string {
  switch (unit) {
    case "cm":
      return `${(mm / 10).toFixed(2)} cm`;
    case "m":
      return `${(mm / 1000).toFixed(3)} m`;
    case "in":
      return `${(mm / 25.4).toFixed(2)} in`;
    case "ft":
      return `${(mm / 304.8).toFixed(3)} ft`;
    case "mm":
    default:
      return `${mm.toFixed(1)} mm`;
  }
}

/** Convert a length expressed in the UI unit to millimeters. */
export function displayLengthToMm(value: number, unit: MeasureUnit): number {
  switch (unit) {
    case "cm":
      return value * 10;
    case "m":
      return value * 1000;
    case "in":
      return value * 25.4;
    case "ft":
      return value * 304.8;
    case "mm":
    default:
      return value;
  }
}

/** Millimeters → numeric value in the chosen display unit (for inputs). */
export function mmToDisplayLength(mm: number, unit: MeasureUnit): number {
  switch (unit) {
    case "cm":
      return mm / 10;
    case "m":
      return mm / 1000;
    case "in":
      return mm / 25.4;
    case "ft":
      return mm / 304.8;
    case "mm":
    default:
      return mm;
  }
}

/** Signed delta in mm, formatted in the selected unit (e.g. Δ +12.3 mm). */
export function formatSignedDeltaMm(deltaMm: number, unit: MeasureUnit): string {
  if (Math.abs(deltaMm) < 1e-9) return `Δ ${formatLengthMm(0, unit)}`;
  const sign = deltaMm > 0 ? "+" : "−";
  return `Δ ${sign}${formatLengthMm(Math.abs(deltaMm), unit)}`;
}

/** Area in mm² with display conversion from square length units. */
export function formatAreaMm2(mm2: number, unit: MeasureUnit): string {
  switch (unit) {
    case "cm":
      return `${(mm2 / 100).toFixed(2)} cm²`;
    case "m":
      return `${(mm2 / 1_000_000).toFixed(4)} m²`;
    case "in":
      return `${(mm2 / 645.16).toFixed(2)} in²`;
    case "ft":
      return `${(mm2 / 92903.04).toFixed(3)} ft²`;
    case "mm":
    default:
      return `${mm2.toFixed(0)} mm²`;
  }
}

export function formatAngleDeg(deg: number): string {
  return `${deg.toFixed(1)}°`;
}
