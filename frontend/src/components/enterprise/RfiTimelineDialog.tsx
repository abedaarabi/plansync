"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional count for subtitle, e.g. number of events */
  eventCount?: number;
};

/**
 * Full-height-friendly overlay for RFI activity / timeline. Bottom sheet on small screens, centered on desktop.
 */
export function RfiTimelineDialog({ open, onClose, children, eventCount }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
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
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[190] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 print:hidden"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-2xl sm:max-h-[min(85dvh,680px)] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rfi-timeline-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--enterprise-border)] px-4 py-3 sm:px-5">
          <div className="min-w-0 pt-0.5">
            <h2
              id="rfi-timeline-dialog-title"
              className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]"
            >
              Timeline
            </h2>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              {eventCount != null && eventCount > 0
                ? `${eventCount} event${eventCount === 1 ? "" : "s"} · newest first`
                : "Edits, review, responses, and file changes."}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
            aria-label="Close timeline"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
