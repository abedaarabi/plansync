import type { Annotation } from "@/store/viewerStore";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Normalized axis-aligned bounds around markup points (0–1), with minimum size for focus. */
export function normRectFromAnnotationPoints(points: { x: number; y: number }[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (points.length === 0) {
    return { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.025;
  const x0 = clamp(minX - pad, 0, 1);
  const y0 = clamp(minY - pad, 0, 1);
  const wRaw = Math.max(maxX - minX + 2 * pad, 0.06);
  const hRaw = Math.max(maxY - minY + 2 * pad, 0.06);
  const w = clamp(wRaw, 0.06, 1 - x0);
  const h = clamp(hRaw, 0.06, 1 - y0);
  return { x: x0, y: y0, w, h };
}

export function findAnnotationById(annotations: Annotation[], id: string): Annotation | undefined {
  return annotations.find((a) => a.id === id);
}
