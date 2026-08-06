"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import type { SaveStatus } from "@/components/enterprise/proposals/editor/proposalEditorShared";

export function ProposalSaveStatusBadge({
  status,
  className = "",
}: {
  status: SaveStatus;
  className?: string;
}) {
  if (status === "saving") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-semantic-info-text)] ${className}`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (status === "unsaved") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-semantic-warning-text)] ${className}`}
      >
        Unsaved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-semantic-danger-text)] ${className}`}
      >
        Save failed
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-semantic-success-text)] ${className}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      Saved
    </span>
  );
}
