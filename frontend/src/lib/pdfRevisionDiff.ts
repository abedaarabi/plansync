import type { PDFDocumentProxy } from "pdfjs-dist";
import { computePdfPageRenderScale, getPdfRenderDpr } from "@/lib/pdfCanvasRenderScale";

/** Rev A only (older / removed). */
export const REVISION_DIFF_COLOR_A = "#E11D48";
/** Rev B only (newer / added) — bright sky so it stays visible on light sheets. */
export const REVISION_DIFF_COLOR_B = "#38BDF8";

const PAPER_LUMA = 248;
const CHANGE_RGB = 36;
const INK_LUMA = 236;
/** Shared-ink veil alpha — mutes Rev B underneath without replacing glyph shapes. */
const SHARED_MUTE_ALPHA = 150;

export type RevisionDiffResult = {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
};

export type BuildRevisionDiffOptions = {
  /** Viewer zoom (PDF user units → CSS px). Diff raster tracks this after settle. */
  scale?: number;
};

type PixelClass = 0 | 1 | 2 | 3; // paper | shared | aOnly | bOnly

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgbDist(r0: number, g0: number, b0: number, r1: number, g1: number, b1: number): number {
  const dr = r0 - r1;
  const dg = g0 - g1;
  const db = b0 - b1;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function isPaper(r: number, g: number, b: number): boolean {
  return luma(r, g, b) >= PAPER_LUMA;
}

function isInk(r: number, g: number, b: number): boolean {
  return luma(r, g, b) < INK_LUMA;
}

function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * Diff classify/cleanup is CPU-bound — tighter bitmap budget than the on-screen PDF canvas.
 */
function clampDiffRenderScale(baseW: number, baseH: number, renderScale: number): number {
  const maxEdge = isCoarsePointer() ? 4096 : 8192;
  const maxPx = isCoarsePointer() ? 10_000_000 : 28_000_000;
  let scale = Math.min(renderScale, maxEdge / baseW, maxEdge / baseH);
  const px = baseW * scale * (baseH * scale);
  if (px > maxPx) {
    scale = Math.min(scale, Math.sqrt(maxPx / (baseW * baseH)));
  }
  return Math.max(scale, 1e-9);
}

/** Quantize zoom so tiny wheel/pinch deltas do not thrash full-page diffs. */
export function quantizeRevisionDiffScale(scale: number): number {
  const s = Math.max(0.05, scale);
  if (s <= 1) return Math.round(s * 20) / 20;
  if (s <= 2.5) return Math.round(s * 10) / 10;
  return Math.round(s * 4) / 4;
}

async function renderPageToImageData(
  doc: PDFDocumentProxy,
  pageNumber: number,
  targetW: number,
  targetH: number,
): Promise<ImageData> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  /** Render at the destination pixel density — avoid soft hi→lo downscale. */
  const scale = Math.min(targetW / base.width, targetH / base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: false });
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  if (canvas.width === targetW && canvas.height === targetH) {
    return ctx.getImageData(0, 0, targetW, targetH);
  }

  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const octx = out.getContext("2d", { willReadFrequently: true, alpha: false });
  if (!octx) throw new Error("Could not create canvas context");
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, targetW, targetH);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  const scaleFit = Math.min(targetW / canvas.width, targetH / canvas.height);
  const dw = Math.max(1, Math.round(canvas.width * scaleFit));
  const dh = Math.max(1, Math.round(canvas.height * scaleFit));
  octx.drawImage(canvas, Math.floor((targetW - dw) / 2), Math.floor((targetH - dh) / 2), dw, dh);
  return octx.getImageData(0, 0, targetW, targetH);
}

// fallow-ignore-next-line complexity
function classifyPixel(
  ar: number,
  ag: number,
  ab: number,
  br: number,
  bg: number,
  bb: number,
): PixelClass {
  const paperA = isPaper(ar, ag, ab);
  const paperB = isPaper(br, bg, bb);
  const inkA = isInk(ar, ag, ab);
  const inkB = isInk(br, bg, bb);
  const dist = rgbDist(ar, ag, ab, br, bg, bb);
  const la = luma(ar, ag, ab);
  const lb = luma(br, bg, bb);

  if (paperA && paperB) return 0;
  if (inkB && paperA) return 3;
  if (inkA && paperB) return 2;
  if (inkB && !inkA && lb + 12 < la) return 3;
  if (inkA && !inkB && la + 12 < lb) return 2;
  if (dist < CHANGE_RGB) return inkA || inkB ? 1 : 0;
  if (lb + 8 < la) return 3;
  if (la + 8 < lb) return 2;
  if (inkB && !inkA) return 3;
  if (inkA && !inkB) return 2;
  return inkB ? 3 : inkA ? 2 : 1;
}

function classifyPages(a: Uint8ClampedArray, b: Uint8ClampedArray, n: number): Uint8Array {
  const cls = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    cls[p] = classifyPixel(a[i]!, a[i + 1]!, a[i + 2]!, b[i]!, b[i + 1]!, b[i + 2]!);
  }
  return cls;
}

// fallow-ignore-next-line complexity
function cleanupClasses(cls: Uint8Array, width: number, height: number): Uint8Array {
  const n = width * height;
  const cleaned = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const cur = cls[p]!;
      if (cur === 0 || cur === 1) {
        cleaned[p] = cur;
        continue;
      }
      let aN = 0;
      let bN = 0;
      let sN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const c = cls[yy * width + xx]!;
          if (c === 2) aN++;
          else if (c === 3) bN++;
          else if (c === 1) sN++;
        }
      }
      if (cur === 2 && aN >= 2) cleaned[p] = 2;
      else if (cur === 3 && bN >= 2) cleaned[p] = 3;
      else if (aN > bN && aN >= 3) cleaned[p] = 2;
      else if (bN > aN && bN >= 3) cleaned[p] = 3;
      else if (sN >= 4) cleaned[p] = 1;
      else cleaned[p] = cur;
    }
  }
  return cleaned;
}

/**
 * Transparent paper + shared veil so the live PDF canvas stays sharp under the tint.
 * Only A/B-only pixels are opaque color.
 */
function paintComposite(cleaned: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  const dest = ctx.createImageData(width, height);
  const d = dest.data;
  const colA = parseHex(REVISION_DIFF_COLOR_A);
  const colB = parseHex(REVISION_DIFF_COLOR_B);
  const n = width * height;

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const c = cleaned[p]! as PixelClass;
    if (c === 2) {
      d[i] = colA.r;
      d[i + 1] = colA.g;
      d[i + 2] = colA.b;
      d[i + 3] = 255;
    } else if (c === 3) {
      d[i] = colB.r;
      d[i + 1] = colB.g;
      d[i + 2] = colB.b;
      d[i + 3] = 255;
    } else if (c === 1) {
      d[i] = 248;
      d[i + 1] = 250;
      d[i + 2] = 252;
      d[i + 3] = SHARED_MUTE_ALPHA;
    } else {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
    }
  }

  ctx.putImageData(dest, 0, 0);
  return out;
}

/** Raster-diff two PDF pages into a composite canvas (letterboxed if sizes differ). */
export async function buildRevisionDiffCanvas(
  docA: PDFDocumentProxy,
  docB: PDFDocumentProxy,
  pageNumber: number,
  options?: BuildRevisionDiffOptions,
): Promise<RevisionDiffResult> {
  const viewerScale = Math.max(0.05, options?.scale ?? 1);
  const pageA = await docA.getPage(pageNumber);
  const pageB = await docB.getPage(pageNumber);
  const vpA = pageA.getViewport({ scale: 1 });
  const vpB = pageB.getViewport({ scale: 1 });
  const maxW = Math.max(vpA.width, vpB.width);
  const maxH = Math.max(vpA.height, vpB.height);

  const baseDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr = getPdfRenderDpr(baseDpr, "final");
  const ideal = computePdfPageRenderScale(maxW, maxH, viewerScale, dpr, "final");
  const renderScale = clampDiffRenderScale(maxW, maxH, ideal);
  const width = Math.max(1, Math.round(maxW * renderScale));
  const height = Math.max(1, Math.round(maxH * renderScale));

  const [imgA, imgB] = await Promise.all([
    renderPageToImageData(docA, pageNumber, width, height),
    renderPageToImageData(docB, pageNumber, width, height),
  ]);

  const n = width * height;
  const cls = classifyPages(imgA.data, imgB.data, n);
  const cleaned = cleanupClasses(cls, width, height);
  const canvas = paintComposite(cleaned, width, height);
  return { width, height, canvas };
}
