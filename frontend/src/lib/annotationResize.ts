import type { Annotation } from "@/store/viewerStore";
import { clamp01, pdfDistanceUnits } from "@/lib/coords";
import { measurementDerivedFields } from "@/lib/measureCompute";
import { computeRotationCenterPx, inverseRotateNorm } from "@/lib/annotationRotation";
import { dimensionPixelGeometry, signedPerpendicularOffsetPdf } from "@/lib/measureGeometry";

export type ResizeHandleKey = "nw" | "ne" | "sw" | "se" | "p1" | "p2" | "dm";

export type ResizeHandleHit = {
  key: ResizeHandleKey;
  nx: number;
  ny: number;
  cx: number;
  cy: number;
};

export type TextLayoutPx = {
  px: number;
  py: number;
  pad: number;
  lh: number;
  boxW: number;
  boxH: number;
  fontSize: number;
};

/** Fill for the text comment rounded rect: paper or tinted with frame {@link Annotation.color}. */
export function textBoxRectFillAttrs(a: Annotation): { fill: string; fillOpacity: number } {
  if (a.type === "text" && a.textBoxFillFromFrame) {
    return { fill: a.color, fillOpacity: 0.32 };
  }
  return { fill: "#ffffff", fillOpacity: 0.92 };
}

export function textBoxLayoutPx(a: Annotation, cssW: number, cssH: number): TextLayoutPx {
  const p = a.points[0];
  const px = p.x * cssW;
  const py = p.y * cssH;
  const fontSize = a.fontSize ?? 12;
  const lh = Math.round(fontSize * 1.17);
  const pad = Math.max(4, Math.round(6 * (fontSize / 12)));
  const lines = (a.text ?? "").split("\n");
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const boxW = Math.min(cssW * 0.45, maxChars * (fontSize * 0.58) + pad * 2);
  const boxH = lines.length * lh + pad * 2;
  return { px, py, pad, lh, boxW, boxH, fontSize };
}

export function boundsNormFromPoints(points: { x: number; y: number }[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function getResizeHandles(
  a: Annotation,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
): ResizeHandleHit[] {
  if (a.locked) return [];
  if (a.type === "rect" || a.type === "cloud" || a.type === "ellipse" || a.type === "cross") {
    if (a.points.length < 2) return [];
    const { minX, minY, maxX, maxY } = boundsNormFromPoints(a.points);
    return [
      { key: "nw", nx: minX, ny: minY, cx: minX * cssW, cy: minY * cssH },
      { key: "ne", nx: maxX, ny: minY, cx: maxX * cssW, cy: minY * cssH },
      { key: "sw", nx: minX, ny: maxY, cx: minX * cssW, cy: maxY * cssH },
      { key: "se", nx: maxX, ny: maxY, cx: maxX * cssW, cy: maxY * cssH },
    ];
  }
  if (a.type === "line") {
    if (a.points.length < 2) return [];
    const [q1, q2] = a.points;
    return [
      { key: "p1", nx: q1.x, ny: q1.y, cx: q1.x * cssW, cy: q1.y * cssH },
      { key: "p2", nx: q2.x, ny: q2.y, cx: q2.x * cssW, cy: q2.y * cssH },
    ];
  }
  if (a.type === "measurement") {
    const kind = a.measurementKind ?? "line";
    if (kind === "line" && a.points.length >= 2) {
      const [q1, q2] = a.points;
      const off = a.dimensionOffsetPdf ?? 0;
      const g = dimensionPixelGeometry(q1, q2, off, pageW, pageH, scale);
      const endpoints: ResizeHandleHit[] = [
        { key: "p1", nx: q1.x, ny: q1.y, cx: q1.x * cssW, cy: q1.y * cssH },
        { key: "p2", nx: q2.x, ny: q2.y, cx: q2.x * cssW, cy: q2.y * cssH },
      ];
      if (!g) return endpoints;
      const midX = (g.d1.x + g.d2.x) / 2;
      const midY = (g.d1.y + g.d2.y) / 2;
      return [...endpoints, { key: "dm", nx: midX / cssW, ny: midY / cssH, cx: midX, cy: midY }];
    }
    if (a.points.length >= 2) {
      const { minX, minY, maxX, maxY } = boundsNormFromPoints(a.points);
      return [
        { key: "nw", nx: minX, ny: minY, cx: minX * cssW, cy: minY * cssH },
        { key: "ne", nx: maxX, ny: minY, cx: maxX * cssW, cy: minY * cssH },
        { key: "sw", nx: minX, ny: maxY, cx: minX * cssW, cy: maxY * cssH },
        { key: "se", nx: maxX, ny: maxY, cx: maxX * cssW, cy: maxY * cssH },
      ];
    }
  }
  if (
    (a.type === "polyline" ||
      a.type === "highlight" ||
      a.type === "polygon" ||
      a.type === "diamond") &&
    a.points.length >= 2
  ) {
    const { minX, minY, maxX, maxY } = boundsNormFromPoints(a.points);
    return [
      { key: "nw", nx: minX, ny: minY, cx: minX * cssW, cy: minY * cssH },
      { key: "ne", nx: maxX, ny: minY, cx: maxX * cssW, cy: minY * cssH },
      { key: "sw", nx: minX, ny: maxY, cx: minX * cssW, cy: maxY * cssH },
      { key: "se", nx: maxX, ny: maxY, cx: maxX * cssW, cy: maxY * cssH },
    ];
  }
  if (a.type === "text" && a.points.length >= 1 && (a.text ?? "").length > 0) {
    const t = textBoxLayoutPx(a, cssW, cssH);
    const maxX = (t.px - t.pad + t.boxW) / cssW;
    const maxY = (t.py - t.pad + t.boxH) / cssH;
    return [{ key: "se", nx: maxX, ny: maxY, cx: maxX * cssW, cy: maxY * cssH }];
  }
  return [];
}

export function hitResizeHandle(
  handles: ResizeHandleHit[],
  nx: number,
  ny: number,
  cssW: number,
  cssH: number,
  tolPx = 12,
): ResizeHandleKey | null {
  const px = nx * cssW;
  const py = ny * cssH;
  let best: ResizeHandleKey | null = null;
  let bestD = Infinity;
  for (const h of handles) {
    const d = Math.hypot(px - h.cx, py - h.cy);
    if (d <= tolPx && d < bestD) {
      bestD = d;
      best = h.key;
    }
  }
  return best;
}

const EPS = 0.001;

function rectPatchFromBounds(minX: number, minY: number, maxX: number, maxY: number) {
  return {
    points: [
      { x: clamp01(minX), y: clamp01(minY) },
      { x: clamp01(maxX), y: clamp01(maxY) },
    ],
  };
}

/** Live resize from pointer (normalized); uses snapshot startPoints + startBounds. */
export function computeResizePatch(
  ann: Annotation,
  handle: ResizeHandleKey,
  startPoints: { x: number; y: number }[],
  startBounds: { minX: number; minY: number; maxX: number; maxY: number },
  nx: number,
  ny: number,
  opts: {
    pageW: number;
    pageH: number;
    mmPerPdfUnit?: number;
    startFontSize?: number;
    startTextLayout?: TextLayoutPx;
    cssW: number;
    cssH: number;
    /** Viewport scale (same as PDF page view); used for rotation pivot. */
    scale?: number;
  },
): Partial<Annotation> | null {
  if (ann.locked) return null;
  const sc = opts.scale ?? 1;
  const { nx: nxR, ny: nyR } = (() => {
    const deg = ann.rotationDeg ?? 0;
    if (deg === 0 || ann.type === "measurement") return { nx, ny };
    const c = computeRotationCenterPx(ann, opts.cssW, opts.cssH, opts.pageW, opts.pageH, sc);
    if (!c) return { nx, ny };
    return inverseRotateNorm(nx, ny, c.cx, c.cy, opts.cssW, opts.cssH, deg);
  })();
  const nxC = clamp01(nxR);
  const nyC = clamp01(nyR);
  const { minX: x0, minY: y0, maxX: x1, maxY: y1 } = startBounds;

  if (ann.type === "line") {
    if (startPoints.length < 2) return null;
    const [a0, b0] = startPoints;
    if (handle === "p1") {
      return { points: [{ x: nxC, y: nyC }, { ...b0 }] };
    }
    if (handle === "p2") {
      return { points: [{ ...a0 }, { x: nxC, y: nyC }] };
    }
    return null;
  }

  if (ann.type === "measurement") {
    const kind = ann.measurementKind ?? "line";
    if (kind === "line") {
      if (startPoints.length < 2 || opts.mmPerPdfUnit === undefined) return null;
      const [a0, b0] = startPoints;
      if (handle === "dm") {
        const off = signedPerpendicularOffsetPdf(
          a0,
          b0,
          { x: nxC, y: nyC },
          opts.pageW,
          opts.pageH,
        );
        return { dimensionOffsetPdf: off };
      }
      let p1 = a0;
      let p2 = b0;
      if (handle === "p1") p1 = { x: nxC, y: nyC };
      if (handle === "p2") p2 = { x: nxC, y: nyC };
      const pdfD = pdfDistanceUnits(p1, p2, opts.pageW, opts.pageH);
      if (pdfD < 1e-9) return null;
      return {
        points: [p1, p2],
        lengthMm: pdfD * opts.mmPerPdfUnit,
      };
    }
    if (startPoints.length < 2 || opts.mmPerPdfUnit === undefined) return null;
    const mm = opts.mmPerPdfUnit;
    const withDerived = (pts: { x: number; y: number }[]) => ({
      points: pts,
      ...measurementDerivedFields(kind, pts, opts.pageW, opts.pageH, mm),
    });
    if (handle === "se") {
      const maxX = clamp01(Math.max(nxC, x0 + EPS));
      const maxY = clamp01(Math.max(nyC, y0 + EPS));
      const sx = (maxX - x0) / (x1 - x0);
      const sy = (maxY - y0) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return withDerived(
        startPoints.map((p) => ({
          x: clamp01(x0 + (p.x - x0) * sx),
          y: clamp01(y0 + (p.y - y0) * sy),
        })),
      );
    }
    if (handle === "nw") {
      const minX = clamp01(Math.min(nxC, x1 - EPS));
      const minY = clamp01(Math.min(nyC, y1 - EPS));
      const sx = (x1 - minX) / (x1 - x0);
      const sy = (y1 - minY) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return withDerived(
        startPoints.map((p) => ({
          x: clamp01(x1 - (x1 - p.x) * sx),
          y: clamp01(y1 - (y1 - p.y) * sy),
        })),
      );
    }
    if (handle === "ne") {
      const maxX = clamp01(Math.max(nxC, x0 + EPS));
      const minY = clamp01(Math.min(nyC, y1 - EPS));
      const sx = (maxX - x0) / (x1 - x0);
      const sy = (y1 - minY) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return withDerived(
        startPoints.map((p) => ({
          x: clamp01(x0 + (p.x - x0) * sx),
          y: clamp01(y1 - (y1 - p.y) * sy),
        })),
      );
    }
    if (handle === "sw") {
      const minX = clamp01(Math.min(nxC, x1 - EPS));
      const maxY = clamp01(Math.max(nyC, y0 + EPS));
      const sx = (x1 - minX) / (x1 - x0);
      const sy = (maxY - y0) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return withDerived(
        startPoints.map((p) => ({
          x: clamp01(x1 - (x1 - p.x) * sx),
          y: clamp01(y0 + (p.y - y0) * sy),
        })),
      );
    }
    return null;
  }

  if (
    ann.type === "rect" ||
    ann.type === "cloud" ||
    ann.type === "ellipse" ||
    ann.type === "cross"
  ) {
    let minX = x0;
    let minY = y0;
    let maxX = x1;
    let maxY = y1;
    if (handle === "nw") {
      minX = clamp01(Math.min(nxC, x1 - EPS));
      minY = clamp01(Math.min(nyC, y1 - EPS));
    } else if (handle === "ne") {
      maxX = clamp01(Math.max(nxC, x0 + EPS));
      minY = clamp01(Math.min(nyC, y1 - EPS));
    } else if (handle === "sw") {
      minX = clamp01(Math.min(nxC, x1 - EPS));
      maxY = clamp01(Math.max(nyC, y0 + EPS));
    } else if (handle === "se") {
      maxX = clamp01(Math.max(nxC, x0 + EPS));
      maxY = clamp01(Math.max(nyC, y0 + EPS));
    } else return null;
    if (maxX - minX < EPS || maxY - minY < EPS) return null;
    return rectPatchFromBounds(minX, minY, maxX, maxY);
  }

  if (
    ann.type === "polyline" ||
    ann.type === "highlight" ||
    ann.type === "polygon" ||
    ann.type === "diamond"
  ) {
    if (handle === "se") {
      const maxX = clamp01(Math.max(nxC, x0 + EPS));
      const maxY = clamp01(Math.max(nyC, y0 + EPS));
      const sx = (maxX - x0) / (x1 - x0);
      const sy = (maxY - y0) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return {
        points: startPoints.map((p) => ({
          x: clamp01(x0 + (p.x - x0) * sx),
          y: clamp01(y0 + (p.y - y0) * sy),
        })),
      };
    }
    if (handle === "nw") {
      const minX = clamp01(Math.min(nxC, x1 - EPS));
      const minY = clamp01(Math.min(nyC, y1 - EPS));
      const sx = (x1 - minX) / (x1 - x0);
      const sy = (y1 - minY) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return {
        points: startPoints.map((p) => ({
          x: clamp01(x1 - (x1 - p.x) * sx),
          y: clamp01(y1 - (y1 - p.y) * sy),
        })),
      };
    }
    if (handle === "ne") {
      const maxX = clamp01(Math.max(nxC, x0 + EPS));
      const minY = clamp01(Math.min(nyC, y1 - EPS));
      const sx = (maxX - x0) / (x1 - x0);
      const sy = (y1 - minY) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return {
        points: startPoints.map((p) => ({
          x: clamp01(x0 + (p.x - x0) * sx),
          y: clamp01(y1 - (y1 - p.y) * sy),
        })),
      };
    }
    if (handle === "sw") {
      const minX = clamp01(Math.min(nxC, x1 - EPS));
      const maxY = clamp01(Math.max(nyC, y0 + EPS));
      const sx = (x1 - minX) / (x1 - x0);
      const sy = (maxY - y0) / (y1 - y0);
      if (sx < 1e-4 || sy < 1e-4) return null;
      return {
        points: startPoints.map((p) => ({
          x: clamp01(x1 - (x1 - p.x) * sx),
          y: clamp01(y0 + (p.y - y0) * sy),
        })),
      };
    }
    return null;
  }

  if (
    ann.type === "text" &&
    handle === "se" &&
    opts.startTextLayout &&
    opts.startFontSize !== undefined
  ) {
    const L = opts.startTextLayout;
    const nwX = L.px - L.pad;
    const nwY = L.py - L.pad;
    const seNewX = nxC * opts.cssW;
    const seNewY = nyC * opts.cssH;
    const w = Math.max(L.boxW * 0.12, seNewX - nwX);
    const h = Math.max(L.boxH * 0.12, seNewY - nwY);
    const sx = w / L.boxW;
    const sy = h / L.boxH;
    const scale = Math.min(Math.max(Math.min(sx, sy), 0.3), 4);
    const newFs = Math.round(Math.min(48, Math.max(8, opts.startFontSize * scale)));
    return { fontSize: newFs };
  }

  return null;
}
