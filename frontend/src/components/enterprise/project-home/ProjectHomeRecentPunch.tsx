"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { PunchRow } from "@/lib/api-client";

type Props = {
  projectId: string;
  items: PunchRow[];
};

function statusMeta(status: string): { label: string; badge: string } {
  if (status === "OPEN") {
    return { label: "Open", badge: "enterprise-badge-danger" };
  }
  if (status === "IN_PROGRESS") {
    return { label: "In progress", badge: "enterprise-badge-warning" };
  }
  if (status === "READY_FOR_GC") {
    return { label: "Ready for GC", badge: "enterprise-badge-info" };
  }
  return { label: "Resolved", badge: "enterprise-badge-success" };
}

export function ProjectHomeRecentPunch({ projectId, items }: Props) {
  return (
    <section className="enterprise-card flex h-full min-w-0 flex-col p-0">
      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-[var(--enterprise-border)] px-3.5 py-3 sm:px-4">
        <div className="min-w-0 pr-1">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Recent punch items
          </h2>
          <p className="enterprise-type-caption mt-0.5">Latest updates on the punch list</p>
        </div>
        <Link
          href={`/projects/${projectId}/punch`}
          className="shrink-0 text-xs font-semibold text-[var(--enterprise-primary)] transition hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3.5 sm:p-4">
        {items.length > 0 ? (
          <ul className="divide-y divide-[var(--enterprise-border)]">
            {items.map((issue) => {
              const { label, badge } = statusMeta(issue.status);
              return (
                <li
                  key={issue.id}
                  className="flex min-w-0 flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--enterprise-text)]">
                      {issue.location}
                    </span>
                    <span
                      className={`${badge} shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold sm:hidden`}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2 pl-0 sm:max-w-[48%] sm:justify-end">
                    <span className="min-w-0 truncate text-xs text-[var(--enterprise-text-muted)]">
                      {issue.trade}
                    </span>
                    <span
                      className={`${badge} hidden shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold sm:inline-block`}
                    >
                      {label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <ClipboardCheck className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">No punch items yet.</p>
            <Link
              href={`/projects/${projectId}/punch`}
              className="mt-3 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Open punch list
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
