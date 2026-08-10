"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getPdfZoomSettleDelayMs } from "@/lib/pdfCanvasRenderScale";
import { buildRevisionDiffCanvas, quantizeRevisionDiffScale } from "@/lib/pdfRevisionDiff";

/** Debounced, zoom-aware page raster diff for revision compare overlay. */
export function useRevisionDiffBitmap(
  docA: PDFDocumentProxy | null,
  docB: PDFDocumentProxy | null,
  pageNumber: number,
  enabled: boolean,
  /** Live viewer scale — diff re-rasters after zoom settles. */
  scale: number,
): { url: string | null; loading: boolean; error: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diffScale = quantizeRevisionDiffScale(scale);

  useEffect(() => {
    if (!enabled || !docA || !docB || pageNumber < 1) {
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    let committedToState = false;
    setLoading(true);
    setError(null);

    /** Wait for zoom to settle, then a little extra for the heavier CPU diff. */
    const delay = getPdfZoomSettleDelayMs() + 120;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const maxPage = Math.min(docA.numPages, docB.numPages);
          const page = Math.min(pageNumber, maxPage);
          const result = await buildRevisionDiffCanvas(docA, docB, page, { scale: diffScale });
          if (cancelled) return;
          const blob = await new Promise<Blob | null>((resolve) =>
            result.canvas.toBlob((b) => resolve(b), "image/png"),
          );
          if (cancelled || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            if (objectUrl) {
              URL.revokeObjectURL(objectUrl);
              objectUrl = null;
            }
            return;
          }
          committedToState = true;
          setUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
          });
          setLoading(false);
        } catch (e) {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Diff failed");
          setLoading(false);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Keep the last committed URL visible while a higher-res diff builds.
      if (objectUrl && !committedToState) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [enabled, docA, docB, pageNumber, diffScale]);

  useEffect(() => {
    return () => {
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  return { url, loading, error };
}
