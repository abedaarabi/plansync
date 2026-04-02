"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useUploadQueueStore } from "@/store/uploadQueueStore";

/**
 * Google Drive–style floating upload list: persists while navigating within the app.
 */
export function UploadProgressDock() {
  const jobs = useUploadQueueStore((s) => s.jobs);
  const removeJob = useUploadQueueStore((s) => s.removeJob);
  const clearFinished = useUploadQueueStore((s) => s.clearFinished);

  if (jobs.length === 0) return null;

  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "uploading");
  const hasFinished = jobs.some((j) => j.status === "done" || j.status === "error");

  return (
    <div
      className="fixed bottom-4 right-4 z-[200] flex w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)]"
      role="region"
      aria-label="Upload progress"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">
          {hasActive ? "Uploading…" : "Uploads"}
        </p>
        {hasFinished && !hasActive ? (
          <button
            type="button"
            onClick={() => clearFinished()}
            className="text-[11px] font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <ul className="max-h-[min(45vh,280px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-start gap-2 px-3 py-2.5 text-left">
            <span className="mt-0.5 shrink-0 text-slate-400">
              {job.status === "queued" || job.status === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--enterprise-primary)]" />
              ) : job.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-slate-800" title={job.fileName}>
                {job.fileName}
              </p>
              {job.status === "error" && job.error ? (
                <p className="mt-0.5 text-[11px] text-red-600">{job.error}</p>
              ) : null}
              {(job.status === "uploading" || job.status === "queued") && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[var(--enterprise-primary)] transition-[width] duration-150"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Dismiss ${job.fileName}`}
              onClick={() => removeJob(job.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
