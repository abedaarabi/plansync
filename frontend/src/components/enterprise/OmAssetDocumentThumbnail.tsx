"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { fetchOmAssetDocumentReadUrl } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { setupPdfWorker } from "@/lib/pdf";

type Props = {
  projectId: string;
  assetId: string;
  documentId: string;
  mimeType: string;
  fileName: string;
  className?: string;
};

function extLabel(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0
    ? fileName
        .slice(i + 1)
        .toUpperCase()
        .slice(0, 5)
    : "FILE";
}

function isRasterImageMime(m: string): boolean {
  return /^image\/(jpe?g|png|gif|webp|bmp)$/i.test(m.trim());
}

function isPdfDoc(mimeType: string, fileName: string): boolean {
  const m = mimeType.trim().toLowerCase();
  if (m === "application/pdf" || m.endsWith("/pdf")) return true;
  return fileName.toLowerCase().endsWith(".pdf");
}

const ExtTile = memo(function ExtTile({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] ${className ?? ""}`}
    >
      <span className="select-none text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </div>
  );
});

const ImageThumb = memo(function ImageThumb({
  url,
  className,
  fallbackLabel,
}: {
  url: string;
  className?: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <ExtTile label={fallbackLabel} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover object-center ${className ?? ""}`}
    />
  );
});

const PdfPageThumb = memo(function PdfPageThumb({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<"loading" | "ready" | "fallback">("loading");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setDataUrl(null);

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        const doc = await pdfjs.getDocument({ url }).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const maxW = 160;
        const scale = Math.min(maxW / base.width, 1.5);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        const task = page.render({ canvasContext: ctx, viewport: vp, canvas });
        await task.promise;
        if (cancelled) return;
        setDataUrl(canvas.toDataURL("image/jpeg", 0.75));
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("fallback");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (phase === "loading") {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)] ${className ?? ""}`}
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (phase === "fallback" || !dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--enterprise-surface)] ${className ?? ""}`}
      >
        <PdfFileIcon className="h-8 w-8 opacity-80" />
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
});

export const OmAssetDocumentThumbnail = memo(function OmAssetDocumentThumbnail({
  projectId,
  assetId,
  documentId,
  mimeType,
  fileName,
  className = "",
}: Props) {
  const {
    data: readUrl,
    isPending,
    isError,
  } = useQuery({
    queryKey: qk.omAssetDocumentReadUrl(projectId, assetId, documentId),
    queryFn: () => fetchOmAssetDocumentReadUrl(projectId, assetId, documentId),
    staleTime: 4 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (isPending || !readUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)] ${className}`}
      >
        {isError ? (
          <FileText className="h-6 w-6 opacity-50" strokeWidth={1.5} aria-hidden />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        )}
      </div>
    );
  }

  if (isRasterImageMime(mimeType)) {
    return <ImageThumb url={readUrl} className={className} fallbackLabel={extLabel(fileName)} />;
  }

  if (isPdfDoc(mimeType, fileName)) {
    return <PdfPageThumb url={readUrl} className={className} />;
  }

  return <ExtTile label={extLabel(fileName)} className={className} />;
});
