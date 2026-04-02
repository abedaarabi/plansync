"use client";

import { FileText, FolderOpen, Upload } from "lucide-react";

type FileExplorerEmptyStateProps = {
  title: string;
  description: string;
  uploadLabel: string;
  uploadDisabled?: boolean;
  /** Same id as the shared file input used by the top bar. */
  uploadInputId?: string;
  variant?: "no-items" | "no-search-results";
};

export function FileExplorerEmptyState({
  title,
  description,
  uploadLabel,
  uploadDisabled,
  uploadInputId,
  variant = "no-items",
}: FileExplorerEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center transition-colors ${
        variant === "no-search-results"
          ? "border-slate-200/90 bg-slate-50/50"
          : "border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white"
      }`}
    >
      {variant === "no-search-results" ? (
        <FolderOpen className="h-12 w-12 text-slate-300" strokeWidth={1.25} aria-hidden />
      ) : (
        <FileText className="h-12 w-12 text-slate-400" strokeWidth={1.25} aria-hidden />
      )}
      <p className="mt-4 text-base font-semibold text-[var(--enterprise-text)]">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-[var(--enterprise-text-muted)]">{description}</p>
      {variant === "no-items" && uploadInputId ? (
        <label
          htmlFor={uploadInputId}
          className={`mt-8 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-[var(--enterprise-primary-deep)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--enterprise-primary)]/35 ${
            uploadDisabled ? "pointer-events-none opacity-70" : ""
          }`}
        >
          <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
          {uploadLabel}
        </label>
      ) : null}
    </div>
  );
}
