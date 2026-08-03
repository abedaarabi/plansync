"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { buildRevisionDiffCanvas } from "@/lib/pdfRevisionDiff";

/** Debounced page raster diff for revision compare overlay. */
export function useRevisionDiffBitmap(
  docA: PDFDocumentProxy | null,
  docB: PDFDocumentProxy | null,
  pageNumber: number,
  enabled: boolean,
): { url: string | null; loading: boolean; error: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const maxPage = Math.min(docA.numPages, docB.numPages);
          const page = Math.min(pageNumber, maxPage);
          const result = await buildRevisionDiffCanvas(docA, docB, page);
          if (cancelled) return;
          const blob = await new Promise<Blob | null>((resolve) =>
            result.canvas.toBlob((b) => resolve(b), "image/png"),
          );
          if (cancelled || !blob) return;
          objectUrl = URL.createObjectURL(blob);
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
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, docA, docB, pageNumber]);

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
