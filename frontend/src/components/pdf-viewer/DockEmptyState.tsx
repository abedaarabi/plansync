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
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-white/50 px-3 py-4">
      {props.icon ? <div className="text-slate-500">{props.icon}</div> : null}
      <p className="text-[12px] font-semibold text-slate-700">{props.title}</p>
      <p className="text-[11px] leading-relaxed text-slate-500">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button
          type="button"
          onClick={props.onAction}
          className="viewer-focus-ring mt-1 rounded-md border border-(--viewer-primary)/45 bg-(--viewer-primary) px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-(--viewer-primary-hover)"
        >
          {props.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
