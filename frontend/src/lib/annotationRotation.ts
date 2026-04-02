import type { Annotation } from "@/store/viewerStore";
import { boundsNormFromPoints, textBoxLayoutPx } from "@/lib/annotationResize";

/**
 * Pivot for SVG rotate() — midpoint for lines, bbox center otherwise (in pixel space).
 */
export function computeRotationCenterPx(
  a: Annotation,
  cssW: number,
  cssH: number,
  ..._page: [number, number, number]
): { cx: number; cy: number } | null {
  void _page;
  if (a.type === "measurement") return null;
  if (a.type === "line" && a.points.length >= 2) {
    const [p1, p2] = a.points;
    return {
      cx: ((p1.x + p2.x) / 2) * cssW,
      cy: ((p1.y + p2.y) / 2) * cssH,
    };
  }
  if (a.type === "text" && a.points.length >= 1 && (a.text ?? "").length > 0) {
    const t = textBoxLayoutPx(a, cssW, cssH);
    return {
      cx: t.px - t.pad + t.boxW / 2,
      cy: t.py - t.pad + t.boxH / 2,
    };
  }
  if (a.points.length < 1) return null;
  const b = boundsNormFromPoints(a.points);
  return {
    cx: ((b.minX + b.maxX) / 2) * cssW,
    cy: ((b.minY + b.maxY) / 2) * cssH,
  };
}

/** Pointer in normalized coords → inverse-rotate around pivot (undo visual rotation). */
export function inverseRotateNorm(
  nx: number,
  ny: number,
  cxPx: number,
  cyPx: number,
  cssW: number,
  cssH: number,
  rotationDeg: number,
): { nx: number; ny: number } {
  const rad = (-rotationDeg * Math.PI) / 180;
  const px = nx * cssW;
  const py = ny * cssH;
  const dx = px - cxPx;
  const dy = py - cyPx;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return {
    nx: (cxPx + rx) / cssW,
    ny: (cyPx + ry) / cssH,
  };
}

/** Resize / hit-test handles in unrotated space → screen space for drawing handles. */
export function forwardRotateHandlePx(
  cx: number,
  cy: number,
  pivot: { cx: number; cy: number },
  rotationDeg: number,
): { cx: number; cy: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = cx - pivot.cx;
  const dy = cy - pivot.cy;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    cx: dx * cos - dy * sin + pivot.cx,
    cy: dx * sin + dy * cos + pivot.cy,
  };
}
