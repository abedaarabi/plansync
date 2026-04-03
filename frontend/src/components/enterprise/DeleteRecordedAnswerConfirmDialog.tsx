"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteRecordedAnswerConfirmDialog({
  open,
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
        aria-labelledby="delete-recorded-answer-title"
        aria-describedby="delete-recorded-answer-desc"
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
              id="delete-recorded-answer-title"
              className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
            >
              Remove recorded answer?
            </h2>
            <p
              id="delete-recorded-answer-desc"
              className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
            >
              This removes the formal answer from the RFI. The discussion message stays in the
              thread. If the RFI was marked answered, it will return to{" "}
              <span className="font-medium text-[var(--enterprise-text)]">In review</span> until
              someone picks a new answer.
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
            {isDeleting ? "Removing…" : "Remove recorded answer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
