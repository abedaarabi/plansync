/**
 * Rasterize a PDF page canvas for Sheet AI (PNG base64, bounded size).
 */
/** Default 1536 limits vision-token cost; raise to 2048 if TOC regions feel imprecise. */
export function captureCanvasToPngBase64(
  canvas: HTMLCanvasElement | null,
  maxEdge = 1536,
): { base64: string; mimeType: "image/png" } | null {
  if (!canvas || canvas.width < 2 || canvas.height < 2) return null;
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0, tw, th);
  const dataUrl = c.toDataURL("image/png", 0.92);
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return { base64, mimeType: "image/png" };
}
