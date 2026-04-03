"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import { presignReadRfiAttachment } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

function viewerKind(mimeType: string, fileName: string): "image" | "pdf" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  const lower = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  return "other";
}

type Props = {
  onClose: () => void;
  projectId: string;
  rfiId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
};

export function RfiAttachmentLightbox({
  onClose,
  projectId,
  rfiId,
  attachmentId,
  fileName,
  mimeType,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const kind = viewerKind(mimeType, fileName);

  const urlQuery = useQuery({
    queryKey: qk.rfiAttachmentReadUrl(projectId, rfiId, attachmentId),
    queryFn: () => presignReadRfiAttachment(projectId, rfiId, attachmentId),
    enabled: Boolean(attachmentId),
    staleTime: 50 * 60 * 1000,
    retry: 1,
  });

  const url = urlQuery.data;

  useEffect(() => {
    setImgLoaded(false);
  }, [attachmentId, url]);

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
  }, [url]);

  if (typeof document === "undefined") return null;

  const openInNewTab = () => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div
      ref={panelRef}
      className="fixed inset-0 z-[250] flex min-h-0 flex-col bg-black/90 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rfi-lightbox-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <p
          id="rfi-lightbox-title"
          className="min-w-0 flex-1 truncate text-sm font-medium text-white"
          title={fileName}
        >
          {fileName}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {url ? (
            <button
              type="button"
              onClick={openInNewTab}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">New tab</span>
            </button>
          ) : null}
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
        {urlQuery.isPending ? (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <p className="text-sm">Loading…</p>
          </div>
        ) : urlQuery.isError ? (
          <div className="max-w-md px-4 text-center">
            <p className="text-sm text-red-200/90">
              {urlQuery.error instanceof Error ? urlQuery.error.message : "Could not load file."}
            </p>
            <button
              type="button"
              onClick={() => void urlQuery.refetch()}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        ) : url && kind === "image" ? (
          <>
            {!imgLoaded ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/60" />
            ) : null}
            <img
              src={url}
              alt={fileName}
              className={`max-h-[calc(100dvh-8rem)] max-w-full object-contain ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        ) : url && kind === "pdf" ? (
          <iframe
            title={fileName}
            src={url}
            className="h-full min-h-[70dvh] w-full max-w-5xl flex-1 rounded-lg border border-white/10 bg-white"
          />
        ) : url ? (
          <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
            <FileText className="h-14 w-14 text-white/50" aria-hidden />
            <p className="text-sm text-white/80">
              Preview isn’t available for this file type. Open in a new tab to view or download.
            </p>
            <button
              type="button"
              onClick={openInNewTab}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white/90"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open in new tab
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
