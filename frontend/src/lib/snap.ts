import type { SnapSegment } from "@/lib/pdfSnapGeometry";
import { PAGE_BORDER_LAYER_ID } from "@/lib/pageBorderSnap";

/** Closest point on segment AB to P; returns squared distance in the same units as coordinates. */
export function closestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-18) {
    const dx = px - ax;
    const dy = py - ay;
    return { x: ax, y: ay, d2: dx * dx + dy * dy };
  }
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * abx;
  const y = ay + t * aby;
  const dx = px - x;
  const dy = py - y;
  return { x, y, d2: dx * dx + dy * dy };
}

function layerAllowed(layerId: string, layerFilter: "all" | Set<string>): boolean {
  if (layerFilter === "all") return true;
  if (layerId === PAGE_BORDER_LAYER_ID) return true;
  return layerFilter.has(layerId);
}

export type SnapBlendMode = "hard" | "soft";

/**
 * Snap to nearest geometry using pixel distance (correct for A1 / non-square pages).
 * `thresholdPx` is the max distance in CSS pixels (same sense as snap radius in the UI).
 * - **hard**: binary — inside threshold, cursor sits on geometry (good for measure / clicks).
 * - **soft**: pull strength falls off with distance (smoother freehand / polygon strokes).
 */
export function snapNormalizedPoint(
  nx: number,
  ny: number,
  segments: SnapSegment[],
  thresholdPx: number,
  overlayW: number,
  overlayH: number,
  layerFilter: "all" | Set<string>,
  opts?: { blend?: SnapBlendMode },
): { x: number; y: number; snapped: boolean } {
  const blend = opts?.blend ?? "hard";
  if (segments.length === 0 || thresholdPx <= 0 || overlayW <= 0 || overlayH <= 0) {
    return { x: nx, y: ny, snapped: false };
  }
  if (layerFilter !== "all" && layerFilter.size === 0) {
    return { x: nx, y: ny, snapped: false };
  }
  const px = nx * overlayW;
  const py = ny * overlayH;
  const th2 = thresholdPx * thresholdPx;
  let bestD2 = Infinity;
  let bestX = px;
  let bestY = py;

  for (const s of segments) {
    if (!layerAllowed(s.layerId, layerFilter)) continue;
    const { x, y, d2 } = closestOnSegment(
      px,
      py,
      s.nx1 * overlayW,
      s.ny1 * overlayH,
      s.nx2 * overlayW,
      s.ny2 * overlayH,
    );
    if (d2 < bestD2) {
      bestD2 = d2;
      bestX = x;
      bestY = y;
    }
  }

  if (bestD2 === Infinity) {
    return { x: nx, y: ny, snapped: false };
  }

  if (blend === "soft") {
    const d = Math.sqrt(Math.max(0, bestD2));
    if (d >= thresholdPx) {
      return { x: nx, y: ny, snapped: false };
    }
    const t = d / thresholdPx;
    const pull = (1 - t) * (1 - t);
    const mixX = px + (bestX - px) * pull;
    const mixY = py + (bestY - py) * pull;
    return {
      x: mixX / overlayW,
      y: mixY / overlayH,
      snapped: pull > 0.35,
    };
  }

  const outX = bestX / overlayW;
  const outY = bestY / overlayH;
  return { x: outX, y: outY, snapped: bestD2 < th2 };
}

/** Nearest segment within max distance in CSS pixels. Used for hover highlight. */
export function findNearestSegment(
  nx: number,
  ny: number,
  segments: SnapSegment[],
  layerFilter: "all" | Set<string>,
  maxDistPx: number,
  overlayW: number,
  overlayH: number,
): SnapSegment | null {
  if (segments.length === 0 || maxDistPx <= 0 || overlayW <= 0 || overlayH <= 0) return null;
  if (layerFilter !== "all" && layerFilter.size === 0) return null;
  const px = nx * overlayW;
  const py = ny * overlayH;
  const maxD2 = maxDistPx * maxDistPx;
  let best: SnapSegment | null = null;
  let bestD2 = maxD2;
  for (const s of segments) {
    if (!layerAllowed(s.layerId, layerFilter)) continue;
    const { d2 } = closestOnSegment(
      px,
      py,
      s.nx1 * overlayW,
      s.ny1 * overlayH,
      s.nx2 * overlayW,
      s.ny2 * overlayH,
    );
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}
