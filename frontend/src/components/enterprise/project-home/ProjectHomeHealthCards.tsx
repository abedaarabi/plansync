"use client";

import { FolderOpen, Gauge, Target } from "lucide-react";
import Link from "next/link";

type Props = {
  projectId: string;
  progress: number;
  highPriorityIssues: number;
  folderCount: number;
  fileCount: number;
};

export function ProjectHomeHealthCards({
  projectId,
  progress,
  highPriorityIssues,
  folderCount,
  fileCount,
}: Props) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
      <section className="enterprise-card p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
              <Gauge className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Progress</h3>
          </div>
          <span className="text-lg font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
            {clamped}%
          </span>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--enterprise-border)]"
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Project progress"
        >
          <div
            className="h-full rounded-full bg-[var(--enterprise-primary)] transition-[width] duration-200"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <p className="enterprise-type-caption mt-2">Overall project completion</p>
      </section>

      <Link
        href={`/projects/${projectId}/issues`}
        className="enterprise-card enterprise-card-hover block p-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35 sm:p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] ${
                highPriorityIssues > 0
                  ? "text-[var(--enterprise-error)]"
                  : "text-[var(--enterprise-text-muted)]"
              }`}
            >
              <Target className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Issue risk</h3>
          </div>
          <span
            className={`text-lg font-semibold tabular-nums tracking-tight ${
              highPriorityIssues > 0
                ? "text-[var(--enterprise-error)]"
                : "text-[var(--enterprise-text)]"
            }`}
          >
            {highPriorityIssues}
          </span>
        </div>
        <p className="enterprise-type-caption mt-3">
          {highPriorityIssues > 0
            ? "High-priority issues need attention"
            : "No high-priority issues open"}
        </p>
      </Link>

      <Link
        href={`/projects/${projectId}/files`}
        className="enterprise-card enterprise-card-hover block p-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35 sm:p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <FolderOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Project assets</h3>
          </div>
          <span className="text-lg font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
            {folderCount}
          </span>
        </div>
        <p className="enterprise-type-caption mt-3">
          {folderCount} folders · {fileCount} files
        </p>
      </Link>
    </div>
  );
}
