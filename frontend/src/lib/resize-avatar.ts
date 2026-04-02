/**
 * Downscale and JPEG-compress an image for storing as a data URL on the user record.
 * Keeps payload bounded so cookies and requests stay reasonable.
 */
export async function resizeImageToDataUrl(
  file: File,
  opts?: { maxEdge?: number; maxChars?: number },
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 160;
  const maxChars = opts?.maxChars ?? 48_000;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(maxEdge / bitmap.width, maxEdge / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.drawImage(bitmap, 0, 0, w, h);

  let quality = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > maxChars && quality > 0.45) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > maxChars) {
    throw new Error(
      "That photo is still too large after compression. Try a smaller image, or paste an image URL instead.",
    );
  }
  return dataUrl;
}
