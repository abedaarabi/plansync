import type { Annotation } from "@/store/viewerStore";
import { clamp01 } from "@/lib/coords";
import { dimensionPixelGeometry } from "@/lib/measureGeometry";
import { textBoxLayoutPx } from "@/lib/annotationResize";
import { computeRotationCenterPx, inverseRotateNorm } from "@/lib/annotationRotation";

const PAD = 10;
/** Extra hit padding for issue-linked markups (easier to grab small pins). */
const LINK_PAD = 14;

function distPointToSeg(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const projx = x1 + t * vx;
  const projy = y1 + t * vy;
  return Math.hypot(px - projx, py - projy);
}

function hitPolyline(
  px: number,
  py: number,
  pts: { x: number; y: number }[],
  cssW: number,
  cssH: number,
  tol: number,
): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i].x * cssW;
    const y1 = pts[i].y * cssH;
    const x2 = pts[i + 1].x * cssW;
    const y2 = pts[i + 1].y * cssH;
    if (distPointToSeg(px, py, x1, y1, x2, y2) < tol) return true;
  }
  return false;
}

export function hitTestAnnotation(
  a: Annotation,
  nx: number,
  ny: number,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): boolean {
  let nxT = nx;
  let nyT = ny;
  const deg = a.rotationDeg ?? 0;
  if (deg !== 0 && a.type !== "measurement") {
    const c = computeRotationCenterPx(a, cssW, cssH, pageW, pageH, scale);
    if (c) {
      const inv = inverseRotateNorm(nx, ny, c.cx, c.cy, cssW, cssH, deg);
      nxT = inv.nx;
      nyT = inv.ny;
    }
  }
  const px = nxT * cssW;
  const py = nyT * cssH;
  const tol = 10 + a.strokeWidth;
  switch (a.type) {
    case "rect":
    case "cloud":
    case "ellipse": {
      if (a.points.length < 2) return false;
      const [p1, p2] = a.points;
      const x = Math.min(p1.x, p2.x) * cssW;
      const y = Math.min(p1.y, p2.y) * cssH;
      const w = Math.abs(p2.x - p1.x) * cssW;
      const h = Math.abs(p2.y - p1.y) * cssH;
      const lp = a.linkedIssueId ? LINK_PAD : 0;
      return (
        px >= x - PAD - lp && px <= x + w + PAD + lp && py >= y - PAD - lp && py <= y + h + PAD + lp
      );
    }
    case "cross": {
      if (a.points.length < 2) return false;
      const [p1, p2] = a.points;
      const x1 = Math.min(p1.x, p2.x) * cssW;
      const y1 = Math.min(p1.y, p2.y) * cssH;
      const x2 = Math.max(p1.x, p2.x) * cssW;
      const y2 = Math.max(p1.y, p2.y) * cssH;
      return (
        distPointToSeg(px, py, x1, y1, x2, y2) < tol || distPointToSeg(px, py, x1, y2, x2, y1) < tol
      );
    }
    case "diamond":
    case "polygon": {
      if (a.type === "polygon" && a.points.length < 3) return false;
      if (a.type === "diamond" && a.points.length < 4) return false;
      if (a.points.length < 2) return false;
      const loop = [...a.points, a.points[0]];
      return hitPolyline(px, py, loop, cssW, cssH, tol);
    }
    case "highlight": {
      if (a.points.length < 2) return false;
      return hitPolyline(px, py, a.points, cssW, cssH, tol + 6);
    }
    case "line": {
      if (a.points.length < 2) return false;
      const [p1, p2] = a.points;
      return distPointToSeg(px, py, p1.x * cssW, p1.y * cssH, p2.x * cssW, p2.y * cssH) < tol;
    }
    case "polyline": {
      if (a.points.length < 2) return false;
      return hitPolyline(px, py, a.points, cssW, cssH, tol);
    }
    case "text": {
      if (a.points.length < 1 || !(a.text ?? "").length) return false;
      const t = textBoxLayoutPx(a, cssW, cssH);
      const x0 = t.px - t.pad;
      const y0 = t.py - t.pad;
      return px >= x0 && px <= x0 + t.boxW && py >= y0 && py <= y0 + t.boxH;
    }
    case "measurement": {
      const mk = a.measurementKind ?? "line";
      if (mk === "line" && a.points.length >= 2) {
        const [p1n, p2n] = a.points;
        const off = a.dimensionOffsetPdf ?? 0;
        const g = dimensionPixelGeometry(p1n, p2n, off, pageW, pageH, scale);
        if (!g) {
          return (
            distPointToSeg(px, py, p1n.x * cssW, p1n.y * cssH, p2n.x * cssW, p2n.y * cssH) < tol
          );
        }
        const xs = [g.p1.x, g.p2.x, g.d1.x, g.d2.x, g.mid.x + g.perpX * 14];
        const ys = [g.p1.y, g.p2.y, g.d1.y, g.d2.y, g.mid.y + g.perpY * 14];
        const minX = Math.min(...xs) - PAD;
        const maxX = Math.max(...xs) + PAD;
        const minY = Math.min(...ys) - PAD;
        const maxY = Math.max(...ys) + PAD;
        return px >= minX && px <= maxX && py >= minY && py <= maxY;
      }
      if (a.points.length < 2) return false;
      if (mk === "area" && a.points.length >= 3) {
        const pts = [...a.points, a.points[0]];
        return hitPolyline(px, py, pts, cssW, cssH, tol);
      }
      return hitPolyline(px, py, a.points, cssW, cssH, tol);
    }
    default:
      return false;
  }
}

export function pickAnnotationAt(
  annotations: Annotation[],
  nx: number,
  ny: number,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): string | null {
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (hitTestAnnotation(a, nx, ny, cssW, cssH, pageW, pageH, scale)) {
      return a.id;
    }
  }
  return null;
}

function aabbIntersectPx(a: AnnotationBoundsPx, b: AnnotationBoundsPx): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

/** Union of selection bounds for several annotations (SVG pixel space). */
export function unionAnnotationSelectionBounds(
  list: Annotation[],
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): AnnotationBoundsPx | null {
  let u: AnnotationBoundsPx | null = null;
  for (const a of list) {
    const b = annotationSelectionBounds(a, cssW, cssH, pageW, pageH, scale);
    if (!b) continue;
    if (!u) {
      u = { ...b };
    } else {
      u = {
        minX: Math.min(u.minX, b.minX),
        minY: Math.min(u.minY, b.minY),
        maxX: Math.max(u.maxX, b.maxX),
        maxY: Math.max(u.maxY, b.maxY),
      };
    }
  }
  return u;
}

/**
 * All annotations whose selection bounds intersect the marquee rectangle (pixel space, same as SVG).
 */
export function pickAnnotationsInMarquee(
  annotations: Annotation[],
  rect: AnnotationBoundsPx,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): string[] {
  const out: string[] = [];
  for (const a of annotations) {
    const b = annotationSelectionBounds(a, cssW, cssH, pageW, pageH, scale);
    if (b && aabbIntersectPx(b, rect)) out.push(a.id);
  }
  return out;
}

export function translateAnnotationPoints(
  points: { x: number; y: number }[],
  dxn: number,
  dyn: number,
): { x: number; y: number }[] {
  return points.map((p) => ({
    x: clamp01(p.x + dxn),
    y: clamp01(p.y + dyn),
  }));
}

export type AnnotationBoundsPx = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function expandSelectionBoundsForRotation(
  base: AnnotationBoundsPx | null,
  a: Annotation,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): AnnotationBoundsPx | null {
  if (!base) return null;
  const deg = a.rotationDeg ?? 0;
  if (deg === 0 || a.type === "measurement") return base;
  const c = computeRotationCenterPx(a, cssW, cssH, pageW, pageH, scale);
  if (!c) return base;
  const corners = [
    { x: base.minX, y: base.minY },
    { x: base.maxX, y: base.minY },
    { x: base.maxX, y: base.maxY },
    { x: base.minX, y: base.maxY },
  ];
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    const dx = p.x - c.cx;
    const dy = p.y - c.cy;
    const rx = dx * cos - dy * sin + c.cx;
    const ry = dx * sin + dy * cos + c.cy;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { minX, minY, maxX, maxY };
}

function annotationSelectionBoundsUnrotated(
  a: Annotation,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): AnnotationBoundsPx | null {
  const pad = 2;
  const linkPad = a.linkedIssueId ? LINK_PAD : 0;
  switch (a.type) {
    case "rect":
    case "cloud":
    case "ellipse":
    case "cross": {
      if (a.points.length < 2) return null;
      const [p1, p2] = a.points;
      const x = Math.min(p1.x, p2.x) * cssW;
      const y = Math.min(p1.y, p2.y) * cssH;
      const w = Math.abs(p2.x - p1.x) * cssW;
      const h = Math.abs(p2.y - p1.y) * cssH;
      const p = pad + linkPad;
      return { minX: x - p, minY: y - p, maxX: x + w + p, maxY: y + h + p };
    }
    case "diamond":
    case "polygon":
    case "highlight": {
      if (a.points.length < 1) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of a.points) {
        const x = p.x * cssW;
        const y = p.y * cssH;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }
    case "line": {
      if (a.points.length < 2) return null;
      const [p1, p2] = a.points;
      const x1 = p1.x * cssW;
      const y1 = p1.y * cssH;
      const x2 = p2.x * cssW;
      const y2 = p2.y * cssH;
      return {
        minX: Math.min(x1, x2) - pad,
        minY: Math.min(y1, y2) - pad,
        maxX: Math.max(x1, x2) + pad,
        maxY: Math.max(y1, y2) + pad,
      };
    }
    case "polyline": {
      if (a.points.length < 1) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of a.points) {
        const x = p.x * cssW;
        const y = p.y * cssH;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }
    case "text": {
      if (a.points.length < 1 || !(a.text ?? "").length) return null;
      const t = textBoxLayoutPx(a, cssW, cssH);
      const x0 = t.px - t.pad;
      const y0 = t.py - t.pad;
      return {
        minX: x0 - pad,
        minY: y0 - pad,
        maxX: x0 + t.boxW + pad,
        maxY: y0 + t.boxH + pad,
      };
    }
    case "measurement": {
      const mk = a.measurementKind ?? "line";
      if (mk === "line" && a.points.length >= 2) {
        const [p1n, p2n] = a.points;
        const off = a.dimensionOffsetPdf ?? 0;
        const g = dimensionPixelGeometry(p1n, p2n, off, pageW, pageH, scale);
        if (!g) {
          const x1 = p1n.x * cssW;
          const y1 = p1n.y * cssH;
          const x2 = p2n.x * cssW;
          const y2 = p2n.y * cssH;
          return {
            minX: Math.min(x1, x2) - pad,
            minY: Math.min(y1, y2) - pad,
            maxX: Math.max(x1, x2) + pad,
            maxY: Math.max(y1, y2) + pad,
          };
        }
        const xs = [g.p1.x, g.p2.x, g.d1.x, g.d2.x, g.mid.x + g.perpX * 14];
        const ys = [g.p1.y, g.p2.y, g.d1.y, g.d2.y, g.mid.y + g.perpY * 14];
        return {
          minX: Math.min(...xs) - pad,
          minY: Math.min(...ys) - pad,
          maxX: Math.max(...xs) + pad,
          maxY: Math.max(...ys) + pad,
        };
      }
      if (a.points.length < 1) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of a.points) {
        const x = p.x * cssW;
        const y = p.y * cssH;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }
    default:
      return null;
  }
}

/** Pixel-space bounding box for selection outline (in SVG coords). */
export function annotationSelectionBounds(
  a: Annotation,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): AnnotationBoundsPx | null {
  const base = annotationSelectionBoundsUnrotated(a, cssW, cssH, pageW, pageH, scale);
  return expandSelectionBoundsForRotation(base, a, cssW, cssH, pageW, pageH, scale);
}
