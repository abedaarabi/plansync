"use client";

import { FileText, Play } from "lucide-react";
import Link from "next/link";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { isIfcFile, isPdfFile } from "@/lib/isPdfFile";
import type { CloudFile } from "@/types/projects";
import { fileActivityLabel, relativeTime } from "./projectHomeUtils";

type Props = {
  projectId: string;
  recentFiles: CloudFile[];
  continueFile: CloudFile | null;
  nowMs: number;
  onOpenFile: (f: CloudFile) => void;
};

export function ProjectHomeRecentFiles({
  projectId,
  recentFiles,
  continueFile,
  nowMs,
  onOpenFile,
}: Props) {
  return (
    <section className="enterprise-card flex h-full min-w-0 flex-col p-0">
      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-[var(--enterprise-border)] px-3.5 py-3 sm:px-4">
        <div className="min-w-0 pr-1">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Recently opened</h2>
          <p className="enterprise-type-caption mt-0.5">
            Last open time is shared across the project team
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/files`}
          className="shrink-0 text-xs font-semibold text-[var(--enterprise-primary)] transition hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3.5 sm:p-4">
        {continueFile ? (
          <button
            type="button"
            onClick={() => onOpenFile(continueFile)}
            className="flex w-full min-w-0 flex-col items-stretch gap-2 rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-3 py-3 text-left transition hover:border-[var(--enterprise-primary)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)]">
                <Play className="h-4 w-4" fill="currentColor" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="enterprise-type-label text-[var(--enterprise-semantic-info-text)]">
                  Continue viewing
                </span>
                <span className="mt-0.5 block break-words text-sm font-semibold text-[var(--enterprise-text)] sm:truncate">
                  {continueFile.name}
                </span>
              </span>
            </div>
            <span className="w-full shrink-0 text-right text-xs text-[var(--enterprise-text-muted)] sm:w-auto sm:text-left">
              {continueFile.lastOpenedAt ? relativeTime(continueFile.lastOpenedAt, nowMs) : ""}
            </span>
          </button>
        ) : null}

        {recentFiles.length > 0 ? (
          <ul
            className={`divide-y divide-[var(--enterprise-border)] ${continueFile ? "mt-3" : ""}`}
          >
            {recentFiles.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onOpenFile(f)}
                  aria-label={`Open ${f.name} in viewer`}
                  className="mobile-tappable-row flex min-h-10 w-full min-w-0 cursor-pointer items-start gap-2 py-2.5 text-left transition first:pt-0 last:pb-0 hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 active:scale-[0.99] sm:items-center sm:gap-3"
                >
                  {isPdfFile(f) ? (
                    <PdfFileIcon className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
                  ) : isIfcFile(f) ? (
                    <IfcFileIcon className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
                  ) : (
                    <FileText
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)] sm:mt-0"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-[var(--enterprise-text)] sm:truncate">
                    {f.name}
                  </span>
                  <span className="shrink-0 self-end text-xs text-[var(--enterprise-text-muted)] sm:self-auto">
                    {fileActivityLabel(f, nowMs) ?? "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <FileText className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
              No files uploaded yet.
            </p>
            <Link
              href={`/projects/${projectId}/files`}
              className="mt-3 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Go to Files & Drawings
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
