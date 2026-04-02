import type { TakeoffMeasurementType } from "@/lib/takeoffTypes";
import { pdfDistanceUnits } from "@/lib/coords";

/** Point in polygon (norm coords). Ray casting. */
export function pointInPolygonNorm(
  p: { x: number; y: number },
  poly: { x: number; y: number }[],
  pageW: number,
  pageH: number,
): boolean {
  if (poly.length < 3) return false;
  const x = p.x * pageW;
  const y = p.y * pageH;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x * pageW;
    const yi = poly[i].y * pageH;
    const xj = poly[j].x * pageW;
    const yj = poly[j].y * pageH;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-18) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distPointToSegmentNorm(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  pageW: number,
  pageH: number,
): number {
  return pdfDistanceUnits(p, closestOnSegment(p, a, b), pageW, pageH);
}

/** ~12 CSS px tolerance in PDF user units (viewport scale 1). */
function hitTolPdf(pageW: number, pageH: number): number {
  const ref = Math.min(pageW, pageH);
  return (14 / ref) * 1.2;
}

function closestOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return a;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function hitTakeoffZone(
  norm: { x: number; y: number },
  kind: TakeoffMeasurementType,
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
): boolean {
  if (points.length < 1) return false;
  const tol = hitTolPdf(pageW, pageH);
  if (kind === "area" && points.length >= 3) {
    return pointInPolygonNorm(norm, points, pageW, pageH);
  }
  if (kind === "linear" && points.length >= 2) {
    for (let i = 0; i < points.length - 1; i++) {
      const d = distPointToSegmentNorm(norm, points[i], points[i + 1], pageW, pageH);
      if (d <= tol) return true;
    }
    return false;
  }
  if (kind === "count") {
    const t = hitTolPdf(pageW, pageH) * 1.2;
    for (const pt of points) {
      if (pdfDistanceUnits(norm, pt, pageW, pageH) <= t) return true;
    }
  }
  return false;
}

/** Vertex hit for area polygon edit; ~14 CSS px. */
export function hitTakeoffAreaVertexIndex(
  norm: { x: number; y: number },
  poly: { x: number; y: number }[],
  pageW: number,
  pageH: number,
): number | null {
  if (poly.length < 3) return null;
  const t = hitTolPdf(pageW, pageH) * 1.35;
  for (let i = 0; i < poly.length; i++) {
    if (pdfDistanceUnits(norm, poly[i], pageW, pageH) <= t) return i;
  }
  return null;
}
