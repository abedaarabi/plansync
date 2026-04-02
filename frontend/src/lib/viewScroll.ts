/** Scroll / zoom helpers shared by the sheet view and minimap (same geometry). */

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Center the viewport on normalized page coordinates (0–1). */
export function scrollViewportToNorm(
  scrollEl: HTMLElement,
  pageEl: HTMLElement,
  nx: number,
  ny: number,
) {
  const pad = scrollEl.firstElementChild as HTMLElement | null;
  const pl = pageEl.offsetLeft + (pad?.offsetLeft ?? 0);
  const pt = pageEl.offsetTop + (pad?.offsetTop ?? 0);
  const pw = pageEl.offsetWidth;
  const ph = pageEl.offsetHeight;
  const targetLeft = pl + nx * pw - scrollEl.clientWidth / 2;
  const targetTop = pt + ny * ph - scrollEl.clientHeight / 2;
  const maxL = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
  const maxT = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  scrollEl.scrollLeft = clamp(targetLeft, 0, maxL);
  scrollEl.scrollTop = clamp(targetTop, 0, maxT);
}

/**
 * Scale factor so a normalized rect (rw × rh on the page) fits inside the scroll viewport
 * with a small margin. Uses PDF page dimensions in points × scale = CSS pixels.
 */
export function computeScaleToFitNormRect(
  rw: number,
  rh: number,
  clientW: number,
  clientH: number,
  pageWPt: number,
  pageHPt: number,
  margin = 0.92,
): number {
  const rwClamped = Math.max(rw, 1e-9);
  const rhClamped = Math.max(rh, 1e-9);
  const sW = (clientW * margin) / (rwClamped * pageWPt);
  const sH = (clientH * margin) / (rhClamped * pageHPt);
  return Math.min(sW, sH);
}
