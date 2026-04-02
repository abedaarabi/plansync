import type { SnapSegment } from "@/lib/pdfSnapGeometry";
import { PAGE_BORDER_LAYER_ID } from "@/lib/pageBorderSnap";

function layerAllowed(layerId: string, layerFilter: "all" | Set<string>): boolean {
  if (layerFilter === "all") return true;
  if (layerId === PAGE_BORDER_LAYER_ID) return true;
  return layerFilter.has(layerId);
}

function snapNearestVerticalLineXNorm(
  preferNx: number,
  segments: SnapSegment[],
  layerFilter: "all" | Set<string>,
  overlayW: number,
  overlayH: number,
  thresholdPx: number,
): number | null {
  if (segments.length === 0 || thresholdPx <= 0 || overlayW <= 0) return null;
  const px = preferNx * overlayW;
  const th2 = thresholdPx * thresholdPx;
  let bestX: number | null = null;
  let bestD2 = th2;
  for (const s of segments) {
    if (!layerAllowed(s.layerId, layerFilter)) continue;
    const x1 = s.nx1 * overlayW;
    const x2 = s.nx2 * overlayW;
    if (Math.abs(x1 - x2) > 2.5) continue;
    const xc = (x1 + x2) / 2;
    const d2 = (px - xc) * (px - xc);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestX = xc;
    }
  }
  return bestX !== null ? bestX / overlayW : null;
}

function snapNearestHorizontalLineYNorm(
  preferNy: number,
  segments: SnapSegment[],
  layerFilter: "all" | Set<string>,
  overlayW: number,
  overlayH: number,
  thresholdPx: number,
): number | null {
  if (segments.length === 0 || thresholdPx <= 0 || overlayH <= 0) return null;
  const py = preferNy * overlayH;
  const th2 = thresholdPx * thresholdPx;
  let bestY: number | null = null;
  let bestD2 = th2;
  for (const s of segments) {
    if (!layerAllowed(s.layerId, layerFilter)) continue;
    const y1 = s.ny1 * overlayH;
    const y2 = s.ny2 * overlayH;
    if (Math.abs(y1 - y2) > 2.5) continue;
    const yc = (y1 + y2) / 2;
    const d2 = (py - yc) * (py - yc);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestY = yc;
    }
  }
  return bestY !== null ? bestY / overlayH : null;
}

/**
 * For axis-aligned ruler lines (BIM-style): snap the free coordinate to the nearest
 * parallel grid stroke so a horizontal measure locks to vertical grid lines and vice versa.
 */
export function snapMeasureGridAxisAligned(
  measureStart: { x: number; y: number },
  endAfterOrtho: { x: number; y: number },
  rawCursorNorm: { x: number; y: number },
  segments: SnapSegment[],
  layerFilter: "all" | Set<string>,
  overlayW: number,
  overlayH: number,
  thresholdPx: number,
): { x: number; y: number } {
  const sx = measureStart.x * overlayW;
  const sy = measureStart.y * overlayH;
  const ex = endAfterOrtho.x * overlayW;
  const ey = endAfterOrtho.y * overlayH;
  if (Math.hypot(ex - sx, ey - sy) < 1) {
    return endAfterOrtho;
  }

  const epsPx = 0.75;
  const isHorizontal = Math.abs(measureStart.y - endAfterOrtho.y) * overlayH < epsPx;
  const isVertical = Math.abs(measureStart.x - endAfterOrtho.x) * overlayW < epsPx;

  if (isHorizontal && isVertical) {
    return endAfterOrtho;
  }

  if (isHorizontal) {
    const nx = snapNearestVerticalLineXNorm(
      rawCursorNorm.x,
      segments,
      layerFilter,
      overlayW,
      overlayH,
      thresholdPx,
    );
    if (nx !== null) {
      return { x: nx, y: measureStart.y };
    }
    return { x: endAfterOrtho.x, y: measureStart.y };
  }
  if (isVertical) {
    const ny = snapNearestHorizontalLineYNorm(
      rawCursorNorm.y,
      segments,
      layerFilter,
      overlayW,
      overlayH,
      thresholdPx,
    );
    if (ny !== null) {
      return { x: measureStart.x, y: ny };
    }
    return { x: measureStart.x, y: endAfterOrtho.y };
  }
  return endAfterOrtho;
}

/**
 * Snap the line end toward horizontal or vertical (screen axes) when the pointer
 * is within `thresholdDeg` of an axis — makes straight measures without Shift.
 * Uses PDF page aspect ratio via pageW/pageH so angles are correct on A1 / non-square pages.
 */
export function snapMeasureLineEndOrtho(
  start: { x: number; y: number },
  end: { x: number; y: number },
  pageW: number,
  pageH: number,
  thresholdDeg = 7,
): { x: number; y: number } {
  const sx = start.x * pageW;
  const sy = start.y * pageH;
  const ex = end.x * pageW;
  const ey = end.y * pageH;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return end;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const nearest90 = Math.round(angleDeg / 90) * 90;
  let delta = Math.abs(angleDeg - nearest90);
  if (delta > 180) delta = 360 - delta;
  if (delta > thresholdDeg) return end;
  const rad = (nearest90 * Math.PI) / 180;
  const nex = sx + Math.cos(rad) * len;
  const ney = sy + Math.sin(rad) * len;
  return { x: nex / pageW, y: ney / pageH };
}

/**
 * Signed perpendicular distance from cursor to chord P1–P2, in PDF user units
 * (same basis as viewport scale 1 width/height).
 */
export function signedPerpendicularOffsetPdf(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  cursor: { x: number; y: number },
  pageW: number,
  pageH: number,
): number {
  const x1 = p1.x * pageW;
  const y1 = p1.y * pageH;
  const x2 = p2.x * pageW;
  const y2 = p2.y * pageH;
  const cx = cursor.x * pageW;
  const cy = cursor.y * pageH;
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = cx - x1;
  const wy = cy - y1;
  const len = Math.hypot(vx, vy);
  if (len < 1e-12) return 0;
  return (wx * -vy + wy * vx) / len;
}

export type DimensionPixelGeom = {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  d1: { x: number; y: number };
  d2: { x: number; y: number };
  mid: { x: number; y: number };
  perpX: number;
  perpY: number;
};

/** Dimension line parallel to chord, offset perpendicular by offsetPdf * scale (pixels). */
export function dimensionPixelGeometry(
  p1n: { x: number; y: number },
  p2n: { x: number; y: number },
  offsetPdf: number,
  pageW: number,
  pageH: number,
  scale: number,
): DimensionPixelGeom | null {
  const cssW = pageW * scale;
  const cssH = pageH * scale;
  const P1 = { x: p1n.x * cssW, y: p1n.y * cssH };
  const P2 = { x: p2n.x * cssW, y: p2n.y * cssH };
  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const perpX = -dy / len;
  const perpY = dx / len;
  const offPx = offsetPdf * scale;
  const D1 = { x: P1.x + perpX * offPx, y: P1.y + perpY * offPx };
  const D2 = { x: P2.x + perpX * offPx, y: P2.y + perpY * offPx };
  const mid = { x: (D1.x + D2.x) / 2, y: (D1.y + D2.y) / 2 };
  return { p1: P1, p2: P2, d1: D1, d2: D2, mid, perpX, perpY };
}
