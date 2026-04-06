"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ProposalLetterPreviewBlock } from "@/components/enterprise/ProposalLetterPreviewBlock";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  letterMarkdown: string;
  letterHtml: string | null;
  takeoffTableHtml: string;
};

/**
 * Renders via portal so it sits above the enterprise shell (sticky top bar is z-50).
 * Backdrop click and Escape close the dialog.
 */
export function ProposalLetterPreviewDialog({
  open,
  onClose,
  title,
  description,
  letterMarkdown,
  letterHtml,
  takeoffTableHtml,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const titleId = "proposal-letter-preview-dialog-title";

  return createPortal(
    <div
      className="fixed inset-0 z-220 flex items-center justify-center bg-[#0c1222]/55 p-3 backdrop-blur-[2px] sm:p-4 print:hidden"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(90dvh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-base font-semibold text-[#0F172A]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-auto px-4 py-4 sm:px-5 sm:py-5">
          <ProposalLetterPreviewBlock
            letterMarkdown={letterMarkdown}
            letterHtml={letterHtml}
            takeoffTableHtml={takeoffTableHtml}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
