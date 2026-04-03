"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteRfiAttachmentConfirmDialog({
  open,
  fileName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, isDeleting]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px] print:hidden"
      role="presentation"
      onClick={() => !isDeleting && onCancel()}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-2xl shadow-black/20"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-rfi-attachment-title"
        aria-describedby="delete-rfi-attachment-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-950/50"
            aria-hidden
          >
            <AlertTriangle className="h-5 w-5 text-amber-200/90" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="delete-rfi-attachment-title"
              className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
            >
              Remove attachment?
            </h2>
            <p
              id="delete-rfi-attachment-desc"
              className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
            >
              <span className="font-medium text-[var(--enterprise-text)]">
                &ldquo;{fileName || "File"}&rdquo;
              </span>{" "}
              will be removed from this RFI and deleted from storage. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={isDeleting}
            className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-40"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            className="rounded-lg border border-red-800/80 bg-red-950/80 px-3 py-2 text-sm font-medium text-red-100 shadow-sm transition hover:bg-red-900/90 disabled:opacity-40"
            onClick={onConfirm}
          >
            {isDeleting ? "Removing…" : "Remove attachment"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
