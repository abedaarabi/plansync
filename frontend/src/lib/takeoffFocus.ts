import type { TakeoffZone } from "@/lib/takeoffTypes";

export type NormRect = { x: number; y: number; w: number; h: number };

function bboxNormPoints(points: { x: number; y: number }[]): NormRect {
  if (points.length === 0) return { x: 0.35, y: 0.35, w: 0.3, h: 0.3 };
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.028;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(1 - x, maxX - minX + 2 * pad);
  const h = Math.min(1 - y, maxY - minY + 2 * pad);
  return { x, y, w, h };
}

function unionNorm(a: NormRect, b: NormRect): NormRect {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Page and normalized rect to zoom/scroll to when focusing a takeoff item from the sidebar.
 * Uses the lowest page index that has zones for this item; unions all zones on that page.
 */
export function takeoffFocusRectForItem(
  zones: TakeoffZone[],
  itemId: string,
): { pageIndex0: number; rectNorm: NormRect; primaryZoneId: string } | null {
  const zs = zones.filter((z) => z.itemId === itemId);
  if (zs.length === 0) return null;

  const pageIndex0 = Math.min(...zs.map((z) => z.pageIndex));
  const onPage = zs.filter((z) => z.pageIndex === pageIndex0);

  let rect = bboxNormPoints(onPage[0].points);
  for (let i = 1; i < onPage.length; i++) {
    rect = unionNorm(rect, bboxNormPoints(onPage[i].points));
  }

  rect.x = Math.max(0, Math.min(1, rect.x));
  rect.y = Math.max(0, Math.min(1, rect.y));
  rect.w = Math.max(0.05, Math.min(1 - rect.x, rect.w));
  rect.h = Math.max(0.05, Math.min(1 - rect.y, rect.h));

  return { pageIndex0, rectNorm: rect, primaryZoneId: onPage[0].id };
}

/** Focus a single zone (sidebar “Edit zone”). */
export function takeoffFocusRectForZone(z: TakeoffZone): {
  pageIndex0: number;
  rectNorm: NormRect;
} {
  const rect = bboxNormPoints(z.points);
  return { pageIndex0: z.pageIndex, rectNorm: rect };
}

/** Union bbox on the lowest page index among the given zones (multi-select fit). */
export function takeoffFocusRectForZoneIds(
  allZones: TakeoffZone[],
  zoneIds: string[],
): { pageIndex0: number; rectNorm: NormRect } | null {
  const zs = allZones.filter((z) => zoneIds.includes(z.id));
  if (zs.length === 0) return null;
  const pageIndex0 = Math.min(...zs.map((z) => z.pageIndex));
  const onPage = zs.filter((z) => z.pageIndex === pageIndex0);
  let rect = bboxNormPoints(onPage[0].points);
  for (let i = 1; i < onPage.length; i++) {
    rect = unionNorm(rect, bboxNormPoints(onPage[i].points));
  }
  rect.x = Math.max(0, Math.min(1, rect.x));
  rect.y = Math.max(0, Math.min(1, rect.y));
  rect.w = Math.max(0.05, Math.min(1 - rect.x, rect.w));
  rect.h = Math.max(0.05, Math.min(1 - rect.y, rect.h));
  return { pageIndex0, rectNorm: rect };
}

/** Slightly tighter than default search (0.85) so takeoff focus zooms in a bit more. */
export const TAKEOFF_FOCUS_FIT_MARGIN = 0.72;
