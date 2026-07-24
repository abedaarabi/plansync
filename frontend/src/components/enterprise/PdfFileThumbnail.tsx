"use client";

import { apiUrl } from "@/lib/api-url";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { isIfcFile, isImageThumbnailFile } from "@/lib/isPdfFile";
import { setupPdfWorker } from "@/lib/pdf";
import { fetchResolvedFileRevision } from "@/lib/api-client";
import { requestModelThumbnail } from "@/lib/bim/modelThumbnail";

type Props = {
  fileId: string;
  className?: string;
  /** When false, show a generic file tile (no PDF.js / no PDF glyph). */
  isPdf?: boolean;
  /** With `mimeType`, non-PDF images may show a real thumbnail. */
  fileName?: string;
  mimeType?: string | null;
  /** Latest revision — required for IFC 3D preview tiles. */
  fileVersionId?: string | null;
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

/** Raster image bytes via authenticated fetch (needed when the API is on another origin). */
function ImageFileThumbnailInner({ fileId, className }: { fileId: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    setPhase("loading");
    setObjectUrl(null);

    void (async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/files/${encodeURIComponent(fileId)}/content`), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("bad response");
        const blob = await res.blob();
        const u = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        blobUrl = u;
        setObjectUrl(u);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("fallback");
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
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

  if (phase === "fallback" || !objectUrl) {
    return <NonPdfPlaceholder className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch
    <img
      src={objectUrl}
      alt=""
      className={`h-full w-full object-cover object-center ${className ?? ""}`}
    />
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
        const doc = await pdfjs.getDocument({ url: pdfUrl, withCredentials: true }).promise;
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

// fallow-ignore-next-line complexity
function IfcFileThumbnailInner({
  fileId,
  fileVersionId,
  className,
}: {
  fileId: string;
  fileVersionId?: string | null;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    setPhase("loading");
    setDataUrl(null);

    // fallow-ignore-next-line complexity
    const tryRender = async (attempt: number) => {
      let versionId = fileVersionId?.trim() || null;
      if (!versionId) {
        try {
          const resolved = await fetchResolvedFileRevision(fileId);
          versionId = resolved.fileVersionId;
        } catch {
          if (!cancelled) setPhase("fallback");
          return;
        }
      }

      const url = await requestModelThumbnail(versionId, fileId);
      if (cancelled) return;
      if (url) {
        setDataUrl(url);
        setPhase("ready");
        return;
      }
      if (attempt < 4) {
        retryTimer = window.setTimeout(() => void tryRender(attempt + 1), 2500);
        return;
      }
      setPhase("fallback");
    };

    void tryRender(0);

    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
    };
  }, [fileId, fileVersionId]);

  if (phase === "loading") {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-200 text-indigo-400 ${className ?? ""}`}
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (phase === "fallback" || !dataUrl) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-50 to-slate-200 ${className ?? ""}`}
      >
        <IfcFileIcon className="h-12 w-12" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated JPEG data URL
    <img
      src={dataUrl}
      alt=""
      className={`h-full w-full object-cover object-center ${className ?? ""}`}
    />
  );
}

// fallow-ignore-next-line complexity
export function PdfFileThumbnail({
  fileId,
  className,
  isPdf = true,
  fileName,
  mimeType,
  fileVersionId,
}: Props) {
  if (isPdf) {
    return <PdfFileThumbnailInner fileId={fileId} className={className} />;
  }
  if (isIfcFile({ name: fileName ?? "", mimeType })) {
    return (
      <IfcFileThumbnailInner fileId={fileId} fileVersionId={fileVersionId} className={className} />
    );
  }
  if (isImageThumbnailFile({ name: fileName ?? "", mimeType })) {
    return <ImageFileThumbnailInner fileId={fileId} className={className} />;
  }
  return <NonPdfPlaceholder className={className} />;
}
