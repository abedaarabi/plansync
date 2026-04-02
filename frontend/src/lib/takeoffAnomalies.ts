import type { TakeoffAnomaly, TakeoffZone } from "@/lib/takeoffTypes";
import { pdfDistanceUnits } from "@/lib/coords";

/** Lightweight overlap hints (norm space). */
export function computeTakeoffAnomalies(
  zones: TakeoffZone[],
  pageSizeByIndex: Record<number, { w: number; h: number }>,
): TakeoffAnomaly[] {
  const out: TakeoffAnomaly[] = [];

  const byPage = new Map<number, TakeoffZone[]>();
  for (const z of zones) {
    if (z.measurementType !== "area" || z.points.length < 3) continue;
    const list = byPage.get(z.pageIndex) ?? [];
    list.push(z);
    byPage.set(z.pageIndex, list);
  }

  for (const [pageIdx, list] of byPage) {
    const sz = pageSizeByIndex[pageIdx];
    if (!sz) continue;
    const w = sz.w;
    const h = sz.h;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.itemId === b.itemId) continue;
        const ca = centroid(a.points);
        const cb = centroid(b.points);
        const d = pdfDistanceUnits(ca, cb, w, h);
        if (d < 0.002) {
          out.push({
            id: `overlap-${a.id}-${b.id}`,
            severity: "info",
            message: "Possible overlapping takeoff areas (similar centers).",
            zoneIds: [a.id, b.id],
          });
        }
      }
    }
  }

  return out.slice(0, 20);
}

function centroid(pts: { x: number; y: number }[]) {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  const n = pts.length || 1;
  return { x: sx / n, y: sy / n };
}

/** Calibration line length in mm — longer baseline = higher confidence heuristic. */
export function calibrationConfidenceLabel(mmLength: number): "good" | "ok" | "low" {
  if (mmLength >= 500) return "good";
  if (mmLength >= 150) return "ok";
  return "low";
}
