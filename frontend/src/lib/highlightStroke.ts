/**
 * Highlighter markup uses a thick translucent stroke. The annotation stores the same 1–8
 * width as other tools; this converts to on-screen / export pixels.
 * Legacy sessions may have pre-scaled widths > 8 — treat those as pixel width directly.
 */
export function highlightStrokeWidthPx(storedWidth: number): number {
  if (storedWidth > 8.5) return Math.max(storedWidth, 10);
  return Math.max(10, storedWidth * 2.2);
}
