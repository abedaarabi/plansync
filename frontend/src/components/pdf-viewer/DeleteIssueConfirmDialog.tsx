"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  issueTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

/**
 * Modal confirmation for deleting an issue (replaces {@link window.confirm}).
 * Renders in a portal above the issue slider (z-[130]).
 */
export function DeleteIssueConfirmDialog({
  open,
  issueTitle,
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
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm print:hidden"
      role="presentation"
      onClick={() => !isDeleting && onCancel()}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl ring-1 ring-white/5"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-issue-title"
        aria-describedby="delete-issue-desc"
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
            <h2 id="delete-issue-title" className="text-lg font-semibold tracking-tight text-white">
              Delete this issue?
            </h2>
            <p id="delete-issue-desc" className="mt-2 text-sm leading-relaxed text-slate-400">
              <span className="font-medium text-slate-300">
                &ldquo;{issueTitle || "Untitled"}&rdquo;
              </span>{" "}
              will be removed from the project and its pin will disappear from the sheet. This
              cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={isDeleting}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
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
            {isDeleting ? "Deleting…" : "Delete issue"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
