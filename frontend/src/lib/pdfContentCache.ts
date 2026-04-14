"use client";

const PDF_CACHE_NAME = "plansync-pdf-content-v1";
const MAX_CACHEABLE_BYTES = 200 * 1024 * 1024; // 200 MB guardrail

function cacheKeyUrl(fileId: string, versionParam: string | null): string {
  const v = versionParam && versionParam.trim() !== "" ? versionParam.trim() : "latest";
  return `/__pdf-cache/${encodeURIComponent(fileId)}?v=${encodeURIComponent(v)}`;
}

function cacheSupported(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined";
}

export function buildPdfCacheKey(fileId: string, versionParam: string | null): string {
  return cacheKeyUrl(fileId, versionParam);
}

export async function readCachedPdfBlob(cacheKey: string): Promise<Blob | null> {
  if (!cacheSupported()) return null;
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const hit = await cache.match(cacheKey);
    if (!hit || !hit.ok) return null;
    const b = await hit.blob();
    if (!b || b.size < 1) return null;
    return b;
  } catch {
    return null;
  }
}

export async function fetchAndCachePdfBlob(contentUrl: string, cacheKey: string): Promise<Blob> {
  const res = await fetch(contentUrl, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF bytes (${res.status})`);
  }
  const blob = await res.blob();
  if (!cacheSupported()) return blob;
  if (blob.size < 1 || blob.size > MAX_CACHEABLE_BYTES) return blob;
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    await cache.put(
      cacheKey,
      new Response(blob, { headers: { "Content-Type": "application/pdf" } }),
    );
  } catch {
    /* ignore cache write failures */
  }
  return blob;
}
