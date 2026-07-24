function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Snapshot image failed to load"));
    img.src = dataUrl;
  });
}

function drawPlacementPin(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  pinColor: string,
): void {
  const r = size;
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, r * 0.35);
  ctx.fillStyle = pinColor;

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px, py + r * 0.85);
  ctx.lineTo(px - r * 0.55, py + r * 2.4);
  ctx.lineTo(px + r * 0.55, py + r * 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1.5, r * 0.2);
  ctx.moveTo(px - r * 1.8, py);
  ctx.lineTo(px + r * 1.8, py);
  ctx.moveTo(px, py - r * 1.8);
  ctx.lineTo(px, py + r * 1.8);
  ctx.stroke();
  ctx.restore();
}

/**
 * Composite a viewport PNG with an issue pin at normalized coords and crop around it.
 */
// fallow-ignore-next-line complexity
export async function compositeIssuePlacementSnapshot(
  baseDataUrl: string,
  normX: number,
  normY: number,
  opts?: { crop?: boolean; pinColor?: string; background?: string },
): Promise<string | null> {
  if (!baseDataUrl) return null;

  const nx = Math.min(1, Math.max(0, normX));
  const ny = Math.min(1, Math.max(0, normY));
  const baseImg = await loadImage(baseDataUrl);
  const w = baseImg.naturalWidth || baseImg.width;
  const h = baseImg.naturalHeight || baseImg.height;
  if (w <= 0 || h <= 0) return baseDataUrl;

  const px = nx * w;
  const py = ny * h;
  const pinR = Math.max(10, Math.min(w, h) * 0.022);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseDataUrl;

  if (opts?.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(baseImg, 0, 0, w, h);
  drawPlacementPin(ctx, px, py, pinR, opts?.pinColor ?? "#ef4444");

  if (opts?.crop === false) return canvas.toDataURL("image/png");

  const pad = 0.3;
  const minX = Math.max(0, nx - pad);
  const minY = Math.max(0, ny - pad);
  const maxX = Math.min(1, nx + pad);
  const maxY = Math.min(1, ny + pad);
  const sx = Math.floor(minX * w);
  const sy = Math.floor(minY * h);
  const sw = Math.max(1, Math.ceil((maxX - minX) * w));
  const sh = Math.max(1, Math.ceil((maxY - minY) * h));

  const cropped = document.createElement("canvas");
  cropped.width = sw;
  cropped.height = sh;
  const cctx = cropped.getContext("2d");
  if (!cctx) return canvas.toDataURL("image/png");
  cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return cropped.toDataURL("image/png");
}
