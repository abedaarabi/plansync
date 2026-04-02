import { pdfDistanceUnits } from "@/lib/coords";

export type MeasurementKindLite = "line" | "area" | "angle" | "perimeter";

/** Recompute numeric fields after points change (resize / edit). */
export function measurementDerivedFields(
  kind: MeasurementKindLite | undefined,
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number,
): Partial<{ lengthMm: number; areaMm2: number; angleDeg: number }> {
  const k = kind ?? "line";
  if (k === "line" && points.length >= 2) {
    const pdfD = pdfDistanceUnits(points[0], points[1], pageW, pageH);
    if (pdfD < 1e-9) return {};
    return { lengthMm: pdfD * mmPerPdfUnit };
  }
  if (k === "perimeter" && points.length >= 2) {
    return { lengthMm: polylineLengthMm(points, pageW, pageH, mmPerPdfUnit) };
  }
  if (k === "area" && points.length >= 3) {
    return { areaMm2: polygonAreaMm2(points, pageW, pageH, mmPerPdfUnit) };
  }
  if (k === "angle" && points.length === 3) {
    return { angleDeg: angleAtVertexDeg(points[0], points[1], points[2], pageW, pageH) };
  }
  return {};
}

/** Shoelace area in PDF user units² (viewport scale 1). */
export function polygonAreaPdfUnits(
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
): number {
  if (points.length < 3) return 0;
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = points[i].x * pageW;
    const yi = points[i].y * pageH;
    const xj = points[j].x * pageW;
    const yj = points[j].y * pageH;
    sum += xi * yj - xj * yi;
  }
  return Math.abs(sum) / 2;
}

export function polygonAreaMm2(
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number,
): number {
  const a = polygonAreaPdfUnits(points, pageW, pageH);
  return a * mmPerPdfUnit * mmPerPdfUnit;
}

export function polylineLengthMm(
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number,
): number {
  let lenPdf = 0;
  for (let i = 0; i < points.length - 1; i++) {
    lenPdf += pdfDistanceUnits(points[i], points[i + 1], pageW, pageH);
  }
  return lenPdf * mmPerPdfUnit;
}

/** Angle at `vertex` between segments vertex→a and vertex→b (degrees). */
export function angleAtVertexDeg(
  vertex: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  pageW: number,
  pageH: number,
): number {
  const vx = (a.x - vertex.x) * pageW;
  const vy = (a.y - vertex.y) * pageH;
  const wx = (b.x - vertex.x) * pageW;
  const wy = (b.y - vertex.y) * pageH;
  const len1 = Math.hypot(vx, vy);
  const len2 = Math.hypot(wx, wy);
  if (len1 < 1e-12 || len2 < 1e-12) return 0;
  const dot = vx * wx + vy * wy;
  const cos = Math.min(1, Math.max(-1, dot / (len1 * len2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Centroid of closed polygon in normalized coords. */
export function polygonCentroidNorm(points: { x: number; y: number }[]): { x: number; y: number } {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...points[0] };
  let twiceA = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    twiceA += cross;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }
  if (Math.abs(twiceA) < 1e-12) {
    const sx = points.reduce((s, p) => s + p.x, 0) / n;
    const sy = points.reduce((s, p) => s + p.y, 0) / n;
    return { x: sx, y: sy };
  }
  const inv = 1 / (3 * twiceA);
  return { x: cx * inv, y: cy * inv };
}
