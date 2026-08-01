"use client";

import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { BimKeyboardShortcutsPanel } from "./BimKeyboardShortcutsPanel";

/** Full-viewport shortcuts help — opened via ? or toolbar. */
export function BimShortcutsOverlay(props: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      props.onClose();
    };
    // Capture so Esc closes help before the engine clears selection.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      className="bim-shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        className="bim-shortcuts-overlay__backdrop"
        aria-label="Close shortcuts"
        onClick={props.onClose}
      />
      <div className="bim-shortcuts-overlay__panel bim-glass-surface">
        <div className="bim-shortcuts-overlay__header">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
            <Keyboard className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--bim-text)]">Keyboard shortcuts</p>
            <p className="text-[11px] text-[var(--bim-text-muted)]">Press Esc or ? to close</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            className="bim-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--bim-icon)] transition-colors hover:bg-[var(--bim-hover)] hover:text-[var(--bim-text)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="bim-shortcuts-overlay__body enterprise-scrollbar">
          <BimKeyboardShortcutsPanel />
        </div>
      </div>
    </div>
  );
}
