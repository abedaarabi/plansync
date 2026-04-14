/**
 * PDF.js renders to a 2D canvas. Browsers limit backing-store width/height (~8k–16k per edge
 * depending on GPU) and total pixels. Exceeding limits yields a blank/white canvas.
 *
 * We compute the largest render scale that fits, then the page is still displayed at the
 * requested zoom via CSS (bitmap upscale when needed).
 */

function readDeviceMemoryGb(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof dm === "number" && dm > 0 ? dm : undefined;
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
 * Max canvas edge length (px). Lower on touch-first / low-memory devices to avoid GPU failures.
 */
export function getPdfCanvasMaxBitmapEdge(): number {
  const mem = readDeviceMemoryGb();
  if (isCoarsePointer() && (mem === undefined || mem <= 4)) {
    return 8192;
  }
  if (mem !== undefined && mem <= 2) {
    return 8192;
  }
  return 16384;
}

/**
 * Max total backing-store pixels (width × height). Higher on desktop-class memory for sharper zoom.
 */
export function getPdfCanvasMaxBitmapPixelBudget(): number {
  const mem = readDeviceMemoryGb();
  if (mem !== undefined && mem >= 16) return 420_000_000;
  if (mem !== undefined && mem >= 8) return 340_000_000;
  if (mem !== undefined && mem >= 4) return 240_000_000;
  if (isCoarsePointer() && (mem === undefined || mem <= 4)) {
    return 160_000_000;
  }
  return 210_000_000;
}

/**
 * Max devicePixelRatio factor for PDF rasterization (before canvas caps). Higher = sharper zoom on
 * HiDPI displays when the bitmap budget allows.
 */
export function getMaxCanvasDpr(): number {
  if (typeof window === "undefined") return 3;
  const mem = readDeviceMemoryGb();
  const coarse = isCoarsePointer();
  if (coarse && (mem === undefined || mem < 4)) return 3;
  if (mem !== undefined && mem <= 2) return 2;
  if (mem !== undefined && mem >= 16) return 6;
  if (mem !== undefined && mem >= 8) return 5.5;
  return 4.5;
}

/**
 * Effective PDF viewport scale for rasterization (PDF user units → canvas pixels).
 * @param baseWidth - viewport width at scale 1 (pdf.js)
 * @param baseHeight - viewport height at scale 1
 * @param scale - viewer zoom multiplier
 * @param devicePixelRatio - typically min(window.devicePixelRatio, getMaxCanvasDpr())
 */
export function computePdfPageRenderScale(
  baseWidth: number,
  baseHeight: number,
  scale: number,
  devicePixelRatio: number,
): number {
  if (baseWidth < 1e-6 || baseHeight < 1e-6) return Math.max(scale, 1e-6);
  /**
   * Extra oversampling for high zoom:
   * - gentle boost at normal zoom
   * - stronger boost when users punch in very far
   */
  const detailBoost =
    scale <= 1
      ? 1
      : scale <= 2.5
        ? Math.min(1.35, 1 + Math.log2(scale) * 0.14)
        : Math.min(1.8, 1.25 + Math.log2(scale / 2.5) * 0.24);
  const ideal = scale * devicePixelRatio * detailBoost;
  const maxEdge = getPdfCanvasMaxBitmapEdge();
  const maxByEdge = Math.min(maxEdge / baseWidth, maxEdge / baseHeight);
  let renderScale = Math.min(ideal, maxByEdge);

  const maxPx = getPdfCanvasMaxBitmapPixelBudget();
  const px = baseWidth * renderScale * (baseHeight * renderScale);
  if (px > maxPx) {
    const maxByArea = Math.sqrt(maxPx / (baseWidth * baseHeight));
    renderScale = Math.min(renderScale, maxByArea);
  }

  return Math.max(renderScale, 1e-9);
}
