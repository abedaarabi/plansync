"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { buildPdfCacheKey, fetchAndCachePdfBlob, readCachedPdfBlob } from "@/lib/pdfContentCache";
import { buildPdfOpenOptions, setupPdfWorker } from "@/lib/pdf";

/**
 * Load a second PDFDocumentProxy for revision compare (by fileVersionId).
 * Caller destroys nothing — this hook owns destroy on change/unmount.
 */
export function useRevisionComparePdf(
  fileId: string | null,
  fileVersionId: string | null,
  versionNumber: number | null,
  enabled: boolean,
): { doc: PDFDocumentProxy | null; error: string | null; loading: boolean } {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !fileId || !fileVersionId) {
      setDoc(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    let opened: PDFDocumentProxy | null = null;
    let loadingTask: { destroy?: () => void } | null = null;

    setLoading(true);
    setError(null);
    setDoc(null);

    void (async () => {
      try {
        const contentUrl = `/api/v1/files/${encodeURIComponent(fileId)}/content?fileVersionId=${encodeURIComponent(fileVersionId)}`;
        const cacheKey = buildPdfCacheKey(
          fileId,
          versionNumber != null ? String(versionNumber) : fileVersionId,
        );
        let blob = await readCachedPdfBlob(cacheKey);
        if (!blob) {
          blob = await fetchAndCachePdfBlob(contentUrl, cacheKey);
        }
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const pdfjs = await import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        loadingTask = pdfjs.getDocument(buildPdfOpenOptions(objectUrl));
        const next = await (loadingTask as { promise: Promise<PDFDocumentProxy> }).promise;
        if (cancelled) {
          next.destroy?.();
          return;
        }
        opened = next;
        setDoc(next);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load compare revision");
        setDoc(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
      opened?.destroy?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, fileId, fileVersionId, versionNumber]);

  return { doc, error, loading };
}
