"use client";

import { Maximize2, Minus, Plus } from "lucide-react";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
  /** `bim` uses dark viewer chrome tokens; `viewer` uses light registration chrome. */
  variant?: "viewer" | "bim";
};

const PANEL = {
  viewer: "registration-zoom-panel",
  bim: "bim-glass-surface border-[var(--bim-chrome-border)] shadow-md",
} as const;

const BTN = {
  viewer:
    "text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-primary-soft)] focus-visible:ring-[var(--enterprise-primary)]/30",
  bim: "text-[var(--bim-accent)] hover:bg-[var(--bim-accent-muted)] focus-visible:ring-[var(--bim-accent)]/40",
} as const;

/** Compact zoom toolbar — blue icons on a glass panel. */
export function PickPaneZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  className = "",
  variant = "viewer",
}: Props) {
  const btn = `flex h-7 w-7 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 ${BTN[variant]}`;

  return (
    <div
      className={`pointer-events-auto z-20 flex flex-col gap-px rounded-lg border p-0.5 ${PANEL[variant]} ${className}`}
    >
      <button type="button" className={btn} aria-label="Zoom in" onClick={onZoomIn}>
        <Plus className="h-3 w-3 shrink-0 stroke-[2.5]" aria-hidden />
      </button>
      <button type="button" className={btn} aria-label="Zoom out" onClick={onZoomOut}>
        <Minus className="h-3 w-3 shrink-0 stroke-[2.5]" aria-hidden />
      </button>
      <button type="button" className={btn} aria-label="Reset view" onClick={onReset}>
        <Maximize2 className="h-3 w-3 shrink-0 stroke-[2.5]" aria-hidden />
      </button>
    </div>
  );
}
