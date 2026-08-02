import type { ClashContextMode } from "./clashSessionStorage";

const cache = new Map<string, string>();
const MAX_ENTRIES = 48;

function cacheKey(clashId: string, contextMode: ClashContextMode): string {
  return `${clashId}:${contextMode}`;
}

function trimCache(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const oldest = cache.keys().next().value;
  if (oldest) cache.delete(oldest);
}

/** Session-only clash viewport previews (lost on reload). */
export function peekClashPreview(clashId: string, contextMode: ClashContextMode): string | null {
  return cache.get(cacheKey(clashId, contextMode)) ?? null;
}

function putClashPreview(clashId: string, contextMode: ClashContextMode, dataUrl: string): void {
  const key = cacheKey(clashId, contextMode);
  if (cache.has(key)) cache.delete(key);
  cache.set(key, dataUrl);
  trimCache();
}

export async function captureClashPreview(args: {
  clashId: string;
  contextMode: ClashContextMode;
  capture: () => Promise<string | null>;
  /** Wait for camera / material settle before capture. */
  settleMs?: number;
  signal?: AbortSignal;
}): Promise<string | null> {
  const cached = peekClashPreview(args.clashId, args.contextMode);
  if (cached) return cached;

  const settleMs = args.settleMs ?? 280;
  if (settleMs > 0) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, settleMs);
    });
  }
  if (args.signal?.aborted) return null;

  const dataUrl = await args.capture();
  if (!dataUrl || args.signal?.aborted) return null;

  // Prefer a lighter JPEG for the HUD.
  const jpeg = await compressPreviewJpeg(dataUrl);
  const stored = jpeg ?? dataUrl;
  putClashPreview(args.clashId, args.contextMode, stored);
  return stored;
}

async function compressPreviewJpeg(pngDataUrl: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("preview load failed"));
      el.src = pngDataUrl;
    });
    const maxW = 640;
    const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth || img.width));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}
