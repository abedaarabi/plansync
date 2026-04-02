"use client";

import { apiUrl } from "@/lib/api-url";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { setupPdfWorker } from "@/lib/pdf";

type Props = {
  fileId: string;
  className?: string;
  /** When false, show a generic file tile (no PDF.js / no PDF glyph). */
  isPdf?: boolean;
};

function NonPdfPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-100 to-slate-200 ${className ?? ""}`}
    >
      <FileText className="h-12 w-12 text-slate-400" strokeWidth={1.25} aria-hidden />
    </div>
  );
}

/** Renders first-page JPEG thumbnail from cloud PDF (same-origin `/content` stream). */
function PdfFileThumbnailInner({ fileId, className }: { fileId: string; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setDataUrl(null);

    (async () => {
      try {
        const pdfUrl = apiUrl(`/api/v1/files/${encodeURIComponent(fileId)}/content`);
        const pdfjs = await import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const maxW = 200;
        const scale = Math.min(maxW / base.width, 1.2);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        const task = page.render({ canvasContext: ctx, viewport: vp, canvas });
        await task.promise;
        if (cancelled) return;
        setDataUrl(canvas.toDataURL("image/jpeg", 0.72));
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("fallback");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (phase === "loading") {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className ?? ""}`}
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (phase === "fallback" || !dataUrl) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-100 to-slate-200 ${className ?? ""}`}
      >
        <PdfFileIcon className="h-12 w-12" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL from canvas
    <img
      src={dataUrl}
      alt=""
      className={`h-full w-full object-cover object-top ${className ?? ""}`}
    />
  );
}

export function PdfFileThumbnail({ fileId, className, isPdf = true }: Props) {
  if (!isPdf) {
    return <NonPdfPlaceholder className={className} />;
  }
  return <PdfFileThumbnailInner fileId={fileId} className={className} />;
}
