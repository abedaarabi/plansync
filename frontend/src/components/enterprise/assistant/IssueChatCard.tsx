"use client";

import { ChevronRight, UserRound } from "lucide-react";
import Link from "next/link";
import type { IssueRow } from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";

type IssueChatCardProps = {
  issue: IssueRow;
  href: string;
  onNavigate?: () => void;
};

export function IssueChatCard({ issue, href, onNavigate }: IssueChatCardProps) {
  const status = issue.status ?? "OPEN";
  const priority = (issue.priority ?? "MEDIUM").toUpperCase();
  const assignee = issue.assignee?.name?.trim() || issue.externalAssigneeName?.trim() || null;
  const creator = issue.creator?.name?.trim() || issue.reporterName?.trim() || null;
  const sheet = issue.sheetName?.trim() || issue.file?.name?.trim() || null;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-3 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-primary-soft)]/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-w-0 items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
            {issue.displayNumber != null ? (
              <span className="mr-1.5 font-medium tabular-nums text-[var(--enterprise-text-muted)]">
                #{issue.displayNumber}
              </span>
            ) : null}
            <span className="line-clamp-2">{issue.title}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${issueStatusBadgeClassLight(status)}`}
          >
            {ISSUE_STATUS_LABEL[status] ?? status}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadgeClassLight(priority)}`}
          >
            {ISSUE_PRIORITY_LABEL[priority] ?? priority}
          </span>
          {assignee ? (
            <span className="inline-flex min-w-0 max-w-[9rem] items-center gap-1 truncate text-[11px] text-[var(--enterprise-text-muted)]">
              <UserRound className="h-3 w-3 shrink-0" aria-hidden />
              {assignee}
            </span>
          ) : null}
          {creator ? (
            <span className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
              by {creator}
            </span>
          ) : null}
          {issue.dueDate ? (
            <span className="text-[11px] text-[var(--enterprise-text-muted)]">
              Due {issue.dueDate.slice(0, 10)}
            </span>
          ) : null}
          {sheet ? (
            <span className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
              {sheet}
            </span>
          ) : null}
        </div>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--enterprise-primary)]"
        aria-hidden
      />
    </Link>
  );
}
