"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Flag,
  History,
  MessageSquare,
  Users,
} from "lucide-react";
import type { IssueRow } from "@/lib/api-client";
import {
  computeIssuesOverview,
  isIssueOverdue,
  issueOverviewShortDate,
  type IssuesOverviewStats,
} from "@/lib/issuesOverviewStats";
import { ISSUE_STATUS_LABEL, issueStatusBadgeClassLight } from "@/lib/issueStatusStyle";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { userInitials } from "@/lib/user-initials";

type KpiTone = "neutral" | "red" | "amber" | "emerald";

const KPI_BORDER: Record<KpiTone, string> = {
  neutral: "border-l-slate-400",
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  emerald: "border-l-emerald-500",
};

function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: KpiTone;
  active?: boolean;
  onClick?: () => void;
}) {
  const cls = `enterprise-card rounded-xl border-l-4 p-3 text-left ${KPI_BORDER[tone]} ${
    active ? "ring-2 ring-[var(--enterprise-primary)]/45" : ""
  } ${onClick ? "transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]" : ""}`;
  const body = (
    <>
      <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--enterprise-text)]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--enterprise-text-muted)]">
        {label}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">{hint}</p>
      ) : null}
    </>
  );
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {body}
    </button>
  );
}

function OverviewCard({
  title,
  icon: Icon,
  className = "",
  children,
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`enterprise-card flex min-w-0 flex-col p-4 ${className}`}>
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {title}
      </h3>
      <div className="mt-3 min-w-0 flex-1">{children}</div>
    </section>
  );
}

function SegmentBar({
  segments,
  onSelect,
  label,
}: {
  segments: IssuesOverviewStats["statusSegments"];
  onSelect?: (key: string) => void;
  label: string;
}) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;
  // Interactive segments must stay exposed to AT — only the static variant is an image.
  return (
    <div
      className="w-full rounded-lg bg-[var(--enterprise-bg)] p-px ring-1 ring-[var(--enterprise-border)]/80"
      role={onSelect ? "group" : "img"}
      aria-label={`${label}, ${total} total`}
    >
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-md">
        {segments.map((s) =>
          onSelect ? (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(s.key)}
              className="min-h-full min-w-1 rounded-sm p-0 transition-opacity hover:opacity-75"
              style={{ flexGrow: s.count, backgroundColor: s.fill }}
              title={`${s.label}: ${s.count} — filter list`}
              aria-label={`Filter by ${s.label} (${s.count})`}
            />
          ) : (
            <div
              key={s.key}
              className="min-h-full min-w-1 rounded-sm"
              style={{ flexGrow: s.count, backgroundColor: s.fill }}
              title={`${s.label}: ${s.count}`}
            />
          ),
        )}
      </div>
    </div>
  );
}

function StatusBreakdown({
  stats,
  onSelect,
}: {
  stats: IssuesOverviewStats;
  onSelect: (key: string) => void;
}) {
  return (
    <div>
      <SegmentBar segments={stats.statusSegments} onSelect={onSelect} label="Status distribution" />
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {stats.statusSegments.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
                style={{ backgroundColor: s.fill }}
                aria-hidden
              />
              {s.label}{" "}
              <span className="tabular-nums font-semibold text-[var(--enterprise-text)]">
                {s.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriorityBreakdown({ stats }: { stats: IssuesOverviewStats }) {
  return (
    <div>
      <SegmentBar segments={stats.prioritySegments} label="Priority distribution" />
      <ul className="mt-3 space-y-1.5">
        {stats.prioritySegments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
              style={{ backgroundColor: s.fill }}
              aria-hidden
            />
            <span className="text-[var(--enterprise-text-muted)]">{s.label}</span>
            <span className="ml-auto tabular-nums font-semibold text-[var(--enterprise-text)]">
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssigneeWorkload({ stats }: { stats: IssuesOverviewStats }) {
  const top = stats.assigneeWorkload.slice(0, 5);
  const max = top[0]?.openCount ?? 0;
  if (top.length === 0) {
    return <p className="text-[12px] text-[var(--enterprise-text-muted)]">No open issues.</p>;
  }
  return (
    <ul className="space-y-2">
      {top.map((w) => (
        <li key={w.userId ?? "unassigned"} className="flex items-center gap-2.5">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--enterprise-primary)]/10 text-[10px] font-bold text-[var(--enterprise-primary)]"
            aria-hidden
          >
            {userInitials(w.name, null)}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--enterprise-text)]">
            {w.name}
          </span>
          <span
            className="h-1.5 max-w-16 shrink-0 rounded-full bg-[var(--enterprise-primary)]/70"
            style={{
              width: `${Math.max(10, Math.round((w.openCount / Math.max(1, max)) * 64))}px`,
            }}
            aria-hidden
          />
          <span className="w-6 shrink-0 text-right text-xs tabular-nums font-semibold text-[var(--enterprise-text)]">
            {w.openCount}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AttentionList({
  stats,
  nowMs,
  hrefFor,
}: {
  stats: IssuesOverviewStats;
  nowMs: number;
  hrefFor: (id: string) => string;
}) {
  if (stats.attentionIssues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[12px] leading-relaxed text-[var(--enterprise-text-muted)]">
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-[var(--enterprise-semantic-success-text)]"
          strokeWidth={1.75}
          aria-hidden
        />
        Nothing overdue or due this week.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {stats.attentionIssues.map((issue) => {
        const overdue = isIssueOverdue(issue, nowMs);
        return (
          <li key={issue.id}>
            <Link
              href={hrefFor(issue.id)}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-primary-soft)]/40"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--enterprise-text)]">
                {issue.title}
              </span>
              <span
                className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  overdue
                    ? "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]"
                    : "border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]"
                }`}
              >
                {overdue ? "Overdue" : `Due ${issueOverviewShortDate(issue.dueDate)}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecentList({
  stats,
  hrefFor,
}: {
  stats: IssuesOverviewStats;
  hrefFor: (id: string) => string;
}) {
  return (
    <ul className="space-y-2">
      {stats.recentIssues.map((issue) => (
        <li key={issue.id}>
          <Link
            href={hrefFor(issue.id)}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-primary-soft)]/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-snug text-[var(--enterprise-text)]">
                {issue.title}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                Updated {issueOverviewShortDate(issue.updatedAt)}
                {(issue.commentCount ?? 0) > 0 ? (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 tabular-nums">
                    <MessageSquare className="h-3 w-3" aria-hidden />
                    {issue.commentCount}
                  </span>
                ) : null}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${issueStatusBadgeClassLight(issue.status)}`}
            >
              {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function KpiRow({
  stats,
  statusFilter,
  onSelect,
}: {
  stats: IssuesOverviewStats;
  statusFilter: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <KpiTile
        label="Total"
        value={stats.total}
        active={statusFilter === "ALL"}
        onClick={() => onSelect("ALL")}
      />
      <KpiTile
        label="Open"
        value={stats.open}
        tone="red"
        active={statusFilter === "OPEN"}
        onClick={() => onSelect("OPEN")}
      />
      <KpiTile
        label="In progress"
        value={stats.inProgress}
        tone="amber"
        active={statusFilter === "IN_PROGRESS"}
        onClick={() => onSelect("IN_PROGRESS")}
      />
      <KpiTile
        label="Overdue"
        value={stats.overdue}
        tone={stats.overdue > 0 ? "red" : "neutral"}
        hint="Open past due date"
      />
      <KpiTile
        label="Resolved"
        value={stats.resolved}
        tone="emerald"
        active={statusFilter === "RESOLVED"}
        onClick={() => onSelect("RESOLVED")}
      />
    </div>
  );
}

export function IssuesOverview({
  projectId,
  items,
  statusFilter,
  onStatusFilterChange,
}: {
  projectId: string;
  items: IssueRow[];
  statusFilter: string;
  onStatusFilterChange: (key: string) => void;
}) {
  const nowMs = useTickNowMs();
  const stats = useMemo(() => computeIssuesOverview(items, nowMs), [items, nowMs]);
  const hrefFor = (id: string) => `/projects/${projectId}/issues/${id}`;

  if (stats.total === 0) return null;

  return (
    <section aria-label="Issues overview" className="space-y-3">
      <KpiRow stats={stats} statusFilter={statusFilter} onSelect={onStatusFilterChange} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <OverviewCard title="Status breakdown" icon={Activity}>
          <StatusBreakdown stats={stats} onSelect={onStatusFilterChange} />
        </OverviewCard>
        <OverviewCard title="Needs attention" icon={CalendarClock}>
          <AttentionList stats={stats} nowMs={nowMs} hrefFor={hrefFor} />
        </OverviewCard>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard title="Priority" icon={Flag}>
          <PriorityBreakdown stats={stats} />
        </OverviewCard>
        <OverviewCard title="Open by assignee" icon={Users}>
          <AssigneeWorkload stats={stats} />
        </OverviewCard>
        <OverviewCard
          title="Recently updated"
          icon={History}
          className="sm:col-span-2 lg:col-span-1"
        >
          <RecentList stats={stats} hrefFor={hrefFor} />
        </OverviewCard>
      </div>
    </section>
  );
}
