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
  const Icon = variant === "no-search-results" ? FolderOpen : FileText;

  return (
    <div className="enterprise-card mx-auto flex w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center sm:py-12">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
        aria-hidden
      >
        <Icon className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
      </div>
      <p className="mt-3 text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
        {title}
      </p>
      <p className="enterprise-type-subtitle mt-1.5 max-w-sm text-[0.9375rem] leading-relaxed">
        {description}
      </p>
      {variant === "no-items" && uploadInputId ? (
        <label
          htmlFor={uploadInputId}
          className={`enterprise-btn-primary mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--enterprise-primary)]/35 ${
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
