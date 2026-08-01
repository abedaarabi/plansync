"use client";

import { X } from "lucide-react";
import { useBimJobPoller } from "@/lib/bim/useBimJobPoller";
import { useBimJobTracker } from "@/lib/bim/bimJobTracker";

export function BimActiveJobsBanner() {
  const active = useBimJobPoller();
  const removeJob = useBimJobTracker((s) => s.removeJob);

  if (active.length === 0) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm text-blue-900">
      <span
        className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-600"
        aria-hidden
      />
      <p className="min-w-0 flex-1">
        {active.length === 1
          ? `Processing ${active[0]!.fileName}…`
          : `Processing ${active.length} models…`}
        <span className="mt-0.5 block text-xs text-blue-900/70">
          Conversion continues in the background. Dismiss hides this banner only.
        </span>
      </p>
      <button
        type="button"
        className="mobile-touch-target inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100/80 focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-ring-focus)]"
        onClick={() => {
          for (const job of active) removeJob(job.fileVersionId);
        }}
        aria-label="Dismiss processing banner"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Dismiss
      </button>
    </div>
  );
}
