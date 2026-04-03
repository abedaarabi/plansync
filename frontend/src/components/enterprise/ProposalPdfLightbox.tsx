"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, X } from "lucide-react";

type Props = {
  onClose: () => void;
  /** Object URL for the PDF blob; parent creates and revokes on close */
  pdfUrl: string;
  fileName: string;
};

export function ProposalPdfLightbox({ onClose, pdfUrl, fileName }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
  }, [pdfUrl]);

  if (typeof document === "undefined") return null;

  const openInNewTab = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const downloadPdf = () => {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName.replace(/[^\w.\-]+/g, "_") || "proposal.pdf";
    a.rel = "noopener";
    a.click();
  };

  return createPortal(
    <div
      ref={panelRef}
      className="fixed inset-0 z-[250] flex min-h-0 flex-col bg-black/90 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-pdf-lightbox-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <p
          id="proposal-pdf-lightbox-title"
          className="min-w-0 flex-1 truncate text-sm font-medium text-white"
          title={fileName}
        >
          {fileName}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
          >
            <Download className="h-4 w-4" aria-hidden />
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
        className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <iframe
          title={fileName}
          src={pdfUrl}
          className="h-full min-h-[70dvh] w-full max-w-5xl flex-1 self-center rounded-lg border border-white/10 bg-white"
        />
      </div>
    </div>,
    document.body,
  );
}
