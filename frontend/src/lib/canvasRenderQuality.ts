/** Upper bound for plan silhouettes and pick-pane canvases (memory vs sharpness). */
const MAX_PLAN_CANVAS_PX = 2048;

export const PLAN_REGISTRATION_BAKE_PX = 2048;

const MAX_PDF_RENDER_SCALE = 5;

function devicePixelRatioCap(max = 2.5): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, max);
}

/** Map a CSS layout size to canvas backing-store pixels. */
export function cssToCanvasPx(cssSize: number, maxPx = MAX_PLAN_CANVAS_PX): number {
  return Math.min(maxPx, Math.max(320, Math.floor(cssSize * devicePixelRatioCap())));
}

/** PDF.js viewport scale for a target CSS width (with optional zoom headroom). */
export function pdfRenderScale(
  pageWidthAtScale1: number,
  cssWidth: number,
  zoomHeadroom = 1.5,
): number {
  if (pageWidthAtScale1 <= 0) return 1.5;
  const targetPx = cssToCanvasPx(cssWidth, MAX_PLAN_CANVAS_PX * 2) * zoomHeadroom;
  return Math.min(MAX_PDF_RENDER_SCALE, Math.max(1.5, targetPx / pageWidthAtScale1));
}
