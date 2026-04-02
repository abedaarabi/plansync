"use client";

import { useEffect, useRef } from "react";
import { useViewerStore } from "@/store/viewerStore";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ClearPersistedMarkupDialog({ open, onConfirm, onCancel }: Props) {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl ring-1 ring-white/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-persisted-title"
        aria-describedby="clear-persisted-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clear-persisted-title" className="text-lg font-semibold tracking-tight text-white">
          Clear saved markups?
        </h2>
        <p id="clear-persisted-desc" className="mt-2 text-sm leading-relaxed text-slate-400">
          {cloudFileVersionId
            ? "This removes all markups, measurements, and calibration saved for this file in your workspace (cloud). It cannot be undone."
            : "This removes all markups and calibration saved for this file in this browser’s local storage. It cannot be undone."}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-800/80 bg-red-950/80 px-3 py-2 text-sm font-medium text-red-100 shadow-sm transition hover:bg-red-900/90"
            onClick={onConfirm}
          >
            Clear markups &amp; calibration
          </button>
        </div>
      </div>
    </div>
  );
}
