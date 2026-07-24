import { buildAnnotationsSvgDocument } from "@/lib/annotationsSvgExport";
import { bimAnnotationToSheetAnnotation } from "@/lib/bim/bimAnnotationAdapter";
import type { BimAnnotation } from "@/store/bimMarkupStore";

// fallow-ignore-next-line complexity
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], fileName, { type: blob.type });
}

function svgDataUrlToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG raster failed"));
    img.src = url;
  });
}

function annotationBoundsNorm(
  annotations: BimAnnotation[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (const a of annotations) {
    for (const p of a.points) {
      any = true;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!any) return null;
  const pad = 0.04;
  return {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    maxX: Math.min(1, maxX + pad),
    maxY: Math.min(1, maxY + pad),
  };
}

/**
 * Composite Three.js viewport PNG with markup SVG overlay.
 * When markupIds provided, optionally crops to their bounding box.
 */
// fallow-ignore-next-line complexity
export async function compositeBimMarkupSnapshot(
  baseDataUrl: string,
  annotations: BimAnnotation[],
  opts?: { markupIds?: string[]; cropToBounds?: boolean; cssW?: number; cssH?: number },
): Promise<string | null> {
  if (!baseDataUrl) return null;
  const filterIds = opts?.markupIds?.length ? new Set(opts.markupIds) : null;
  const visible = filterIds ? annotations.filter((a) => filterIds.has(a.id)) : annotations;
  if (visible.length === 0) return baseDataUrl;

  const cssW = opts?.cssW ?? 1920;
  const cssH = opts?.cssH ?? 1080;
  const sheetAnnotations = visible.map(bimAnnotationToSheetAnnotation);
  const svg = buildAnnotationsSvgDocument(
    sheetAnnotations,
    cssW,
    cssH,
    cssW,
    cssH,
    1,
    "mm",
    "bim-markup-arrow",
  );

  const baseImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Base image failed"));
    img.src = baseDataUrl;
  });
  const overlayImg = svg ? await svgDataUrlToImage(svg) : null;

  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth || cssW;
  canvas.height = baseImg.naturalHeight || cssH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseDataUrl;

  const crop = opts?.cropToBounds !== false ? annotationBoundsNorm(visible) : null;
  if (crop && crop.maxX > crop.minX && crop.maxY > crop.minY) {
    const sx = Math.floor(crop.minX * canvas.width);
    const sy = Math.floor(crop.minY * canvas.height);
    const sw = Math.max(1, Math.ceil((crop.maxX - crop.minX) * canvas.width));
    const sh = Math.max(1, Math.ceil((crop.maxY - crop.minY) * canvas.height));
    ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
    if (overlayImg) ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
    const cropped = document.createElement("canvas");
    cropped.width = sw;
    cropped.height = sh;
    const cctx = cropped.getContext("2d");
    if (!cctx) return canvas.toDataURL("image/png");
    cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropped.toDataURL("image/png");
  }

  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
  if (overlayImg) ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
