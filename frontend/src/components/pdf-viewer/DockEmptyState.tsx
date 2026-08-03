"use client";

import type { ReactNode } from "react";

/** Compact empty state for PDF viewer docks. */
export function DockEmptyState(props: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-[#334155] bg-[#0f172a]/50 px-3 py-4">
      {props.icon ? <div className="text-[#94a3b8]">{props.icon}</div> : null}
      <p className="text-[12px] font-semibold text-[#e2e8f0]">{props.title}</p>
      <p className="text-[11px] leading-relaxed text-[#94a3b8]">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button
          type="button"
          onClick={props.onAction}
          className="viewer-focus-ring mt-1 rounded-md border border-[rgba(37,99,235,0.45)] bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
        >
          {props.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
