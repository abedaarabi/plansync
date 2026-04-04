"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { downloadProjectFileVersion, projectFileContentUrl } from "@/lib/downloadProjectFile";

type Props = {
  onClose: () => void;
  fileId: string;
  fileName: string;
  version: number;
};

/**
 * Full-screen image preview for project files (cookie-auth `/content` → blob URL).
 */
export function ProjectFileImageLightbox({ onClose, fileId, fileName, version }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    setPhase("loading");
    setObjectUrl(null);
    setImgLoaded(false);

    void (async () => {
      try {
        const res = await fetch(projectFileContentUrl(fileId, version), { credentials: "include" });
        if (!res.ok) throw new Error("Could not load image.");
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
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileId, version, retryNonce]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const els = [...focusable].filter((el) => !el.hasAttribute("disabled"));
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    const onTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onTrap);
    return () => panel.removeEventListener("keydown", onTrap);
  }, [phase, objectUrl]);

  if (typeof document === "undefined") return null;

  const openInNewTab = () => {
    window.open(projectFileContentUrl(fileId, version), "_blank", "noopener,noreferrer");
  };

  const onDownload = () => {
    if (downloading) return;
    setDownloading(true);
    void (async () => {
      try {
        await downloadProjectFileVersion({ fileId, fileName, version });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Download failed.");
      } finally {
        setDownloading(false);
      }
    })();
  };

  return createPortal(
    <div
      ref={panelRef}
      className="fixed inset-0 z-[250] flex min-h-0 flex-col bg-black/90 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-file-image-lightbox-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <p
          id="project-file-image-lightbox-title"
          className="min-w-0 flex-1 truncate text-sm font-medium text-white"
          title={fileName}
        >
          {fileName}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">New tab</span>
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/90 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {phase === "loading" ? (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <p className="text-sm">Loading…</p>
          </div>
        ) : phase === "error" ? (
          <div className="max-w-md px-4 text-center">
            <p className="text-sm text-red-200/90">Could not load this image.</p>
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        ) : objectUrl ? (
          <>
            {!imgLoaded ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/60" />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch */}
            <img
              src={objectUrl}
              alt={fileName}
              className={`max-h-[calc(100dvh-8rem)] max-w-full object-contain ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
