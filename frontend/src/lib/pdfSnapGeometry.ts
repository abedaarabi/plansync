import type { PDFPageProxy } from "pdfjs-dist";
import type { PageViewport } from "pdfjs-dist";
import { OPS, Util } from "pdfjs-dist";

/** Flat array ops — matches pdf.js DrawOPS / path buffer. */
const D = { moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 };

/** Stroked paths plus fill-only paths (outline is still snap geometry). */
const SNAP_GEOMETRY_PAINT_OPS = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

export type SnapSegment = {
  nx1: number;
  ny1: number;
  nx2: number;
  ny2: number;
  layerId: string;
  /** Stroking operation index — segments from the same PDF path share this id. */
  pathIndex: number;
  /** Approximate PDF stroke width in CSS pixels (viewport); fill-only edges use a hairline. */
  strokeWidthPx?: number;
};

export type PageSnapLayers = { id: string; label: string }[];

function layerIdFromOC(oc: unknown): string {
  if (!oc || typeof oc !== "object") return "default";
  const o = oc as { type?: string; id?: unknown; ids?: unknown[] };
  if (o.type === "OCG" && o.id != null) return `OCG:${String(o.id)}`;
  if (o.type === "OCMD" && Array.isArray(o.ids) && o.ids.length)
    return `OCMD:${o.ids.map(String).join(",")}`;
  if (o.type === "OCMD" && o.id != null) return `OCMD:${String(o.id)}`;
  return "OC";
}

function applyMatrix(m: number[], x: number, y: number) {
  return {
    x: x * m[0] + y * m[2] + m[4],
    y: x * m[1] + y * m[3] + m[5],
  };
}

function toNorm(vp: PageViewport, x: number, y: number) {
  const [vx, vy] = vp.convertToViewportPoint(x, y);
  return { nx: vx / vp.width, ny: vy / vp.height };
}

/** Map PDF user-space line width + CTM to approximate CSS stroke width on the viewport. */
function lineWidthUserToViewportPx(lineWidthUser: number, ctm: number[], vp: PageViewport): number {
  const w = lineWidthUser > 0 ? lineWidthUser : 0.2;
  const [a, b, c, d] = ctm;
  const wx = Math.hypot(a * w, b * w);
  const wy = Math.hypot(c * w, d * w);
  const pageDist = (wx + wy) / 2;
  const p0 = vp.convertToViewportPoint(0, 0);
  const p1 = vp.convertToViewportPoint(pageDist, 0);
  const px = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  return Math.max(0.35, Math.min(64, px));
}

/** Thin edge for fill-only geometry (no stroke in PDF). */
function hairlineViewportPx(ctm: number[], vp: PageViewport): number {
  const p0 = vp.convertToViewportPoint(0, 0);
  const p1 = vp.convertToViewportPoint(0.35, 0);
  const base = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  return Math.max(0.35, Math.min(2, base));
}

const STROKE_PAINT_OPS = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

function pushSeg(
  vp: PageViewport,
  a: { x: number; y: number },
  b: { x: number; y: number },
  layerId: string,
  pathIndex: number,
  out: SnapSegment[],
  minNormLen: number,
  strokeWidthPx: number,
) {
  const p = toNorm(vp, a.x, a.y);
  const q = toNorm(vp, b.x, b.y);
  const dx = q.nx - p.nx;
  const dy = q.ny - p.ny;
  if (dx * dx + dy * dy < minNormLen * minNormLen) return;
  out.push({
    nx1: p.nx,
    ny1: p.ny,
    nx2: q.nx,
    ny2: q.ny,
    layerId,
    pathIndex,
    strokeWidthPx,
  });
}

function cubicPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function flattenCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  steps: number,
) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(cubicPoint(i / steps, p0, p1, p2, p3));
  }
  return pts;
}

function quadToCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  return {
    c1: { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
    c2: { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
    p3: p2,
  };
}

function parsePathBuffer(
  data: Float32Array,
  ctm: number[],
  vp: PageViewport,
  layerId: string,
  pathIndex: number,
  out: SnapSegment[],
  maxSeg: number,
  minNormLen: number,
  strokeWidthPx: number,
) {
  let i = 0;
  let cur = { x: 0, y: 0 };
  let subStart = { x: 0, y: 0 };

  while (i < data.length && out.length < maxSeg) {
    const op = data[i++];
    if (op === D.moveTo) {
      const x = data[i++];
      const y = data[i++];
      cur = applyMatrix(ctm, x, y);
      subStart = { ...cur };
    } else if (op === D.lineTo) {
      const x = data[i++];
      const y = data[i++];
      const next = applyMatrix(ctm, x, y);
      pushSeg(vp, cur, next, layerId, pathIndex, out, minNormLen, strokeWidthPx);
      cur = next;
    } else if (op === D.curveTo) {
      const x1 = data[i++];
      const y1 = data[i++];
      const x2 = data[i++];
      const y2 = data[i++];
      const x3 = data[i++];
      const y3 = data[i++];
      const p0 = cur;
      const p1 = applyMatrix(ctm, x1, y1);
      const p2 = applyMatrix(ctm, x2, y2);
      const p3 = applyMatrix(ctm, x3, y3);
      const pts = flattenCubic(p0, p1, p2, p3, 14);
      for (let k = 0; k < pts.length - 1 && out.length < maxSeg; k++) {
        pushSeg(vp, pts[k], pts[k + 1], layerId, pathIndex, out, minNormLen, strokeWidthPx);
      }
      cur = p3;
    } else if (op === D.quadraticCurveTo) {
      const x1 = data[i++];
      const y1 = data[i++];
      const x2 = data[i++];
      const y2 = data[i++];
      const p0 = cur;
      const q1 = applyMatrix(ctm, x1, y1);
      const p2 = applyMatrix(ctm, x2, y2);
      const { c1, c2, p3 } = quadToCubic(p0, q1, p2);
      const pts = flattenCubic(p0, c1, c2, p3, 12);
      for (let k = 0; k < pts.length - 1 && out.length < maxSeg; k++) {
        pushSeg(vp, pts[k], pts[k + 1], layerId, pathIndex, out, minNormLen, strokeWidthPx);
      }
      cur = p3;
    } else if (op === D.closePath) {
      pushSeg(vp, cur, subStart, layerId, pathIndex, out, minNormLen, strokeWidthPx);
      cur = { ...subStart };
    } else {
      break;
    }
  }
}

/**
 * Extract path outlines from the page content stream for snapping (strokes and fills).
 * Respects optional content (layer) markers when present.
 */
export async function extractPageSnapGeometry(
  page: PDFPageProxy,
  viewport: PageViewport,
  options?: { maxSegments?: number; minNormSegmentLength?: number },
): Promise<{ segments: SnapSegment[]; layers: PageSnapLayers }> {
  const maxSeg = options?.maxSegments ?? 120_000;
  const minNormLen = options?.minNormSegmentLength ?? 1e-5;

  const opList = await page.getOperatorList({ intent: "display" });
  const { fnArray, argsArray } = opList;

  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const ctmStack: number[][] = [];
  let lineWidthUser = 1;
  const lineWidthStack: number[] = [];
  const layerStack: string[] = ["default"];

  const segments: SnapSegment[] = [];
  const layerSet = new Map<string, string>();
  let nextPathIndex = 0;

  for (let i = 0; i < fnArray.length && segments.length < maxSeg; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    if (fn === OPS.save) {
      ctmStack.push([...ctm]);
      lineWidthStack.push(lineWidthUser);
      continue;
    }
    if (fn === OPS.restore) {
      const prev = ctmStack.pop();
      if (prev) ctm = prev;
      const lw = lineWidthStack.pop();
      if (lw !== undefined) lineWidthUser = lw;
      continue;
    }
    if (fn === OPS.setLineWidth && args?.length >= 1) {
      lineWidthUser = Number(args[0]);
      continue;
    }
    if (fn === OPS.transform && args?.length >= 6) {
      const [a, b, c, d, e, f] = args as number[];
      ctm = Util.transform(ctm, [a, b, c, d, e, f]);
      continue;
    }
    if (fn === OPS.beginMarkedContentProps && args?.[0] === "OC") {
      const id = layerIdFromOC(args[1]);
      layerStack.push(id);
      if (!layerSet.has(id)) layerSet.set(id, id);
      continue;
    }
    if (fn === OPS.endMarkedContent) {
      if (layerStack.length > 1) layerStack.pop();
      continue;
    }
    if (fn === OPS.constructPath) {
      const paintOp = args[0] as number;
      if (!SNAP_GEOMETRY_PAINT_OPS.has(paintOp)) continue;
      const pathData = args[1]?.[0] as Float32Array | null | undefined;
      if (!pathData?.length) continue;
      const layerId = layerStack[layerStack.length - 1] ?? "default";
      const pathIndex = nextPathIndex++;
      const strokeWidthPx = STROKE_PAINT_OPS.has(paintOp)
        ? lineWidthUserToViewportPx(lineWidthUser, ctm, viewport)
        : hairlineViewportPx(ctm, viewport);
      parsePathBuffer(
        pathData,
        ctm,
        viewport,
        layerId,
        pathIndex,
        segments,
        maxSeg,
        minNormLen,
        strokeWidthPx,
      );
    }
  }

  const layers: PageSnapLayers = Array.from(layerSet.entries()).map(([id]) => ({
    id,
    label: id.startsWith("OCG:") ? `Layer ${id.slice(4)}` : id,
  }));
  if (layers.length === 0) layers.push({ id: "default", label: "Content" });

  return { segments, layers };
}
