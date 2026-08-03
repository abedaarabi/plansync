/** Pure aggregations behind the issues overview dashboard (no React, no fetches). */

import type { IssueRow } from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusDotSolidFill,
} from "@/lib/issueStatusStyle";

/** Statuses that mean "no more work" — excluded from overdue / attention math. */
const CLOSED_LIKE = new Set(["RESOLVED", "CLOSED"]);
const DAY_MS = 86_400_000;

export type IssueCountSegment = { key: string; label: string; count: number; fill: string };

export type IssueAssigneeWorkload = { userId: string | null; name: string; openCount: number };

export type IssuesOverviewStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  overdue: number;
  dueThisWeek: number;
  unassignedOpen: number;
  statusSegments: IssueCountSegment[];
  prioritySegments: IssueCountSegment[];
  assigneeWorkload: IssueAssigneeWorkload[];
  attentionIssues: IssueRow[];
  recentIssues: IssueRow[];
};

const PRIORITY_FILL: Record<string, string> = {
  HIGH: "#dc2626",
  MEDIUM: "#2563eb",
  LOW: "#64748b",
};

/** Local-midnight ms for the issue's due calendar day, or null when unset/invalid. */
function dueDayMs(issue: IssueRow): number | null {
  const v = issueDateToInputValue(issue.dueDate);
  if (!v) return null;
  const t = new Date(`${v}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

function todayStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isIssueOverdue(issue: IssueRow, nowMs: number): boolean {
  if (CLOSED_LIKE.has(issue.status)) return false;
  const d = dueDayMs(issue);
  return d != null && d < todayStartMs(nowMs);
}

/** Open item due today or within the next 7 days (and not already overdue). */
export function isIssueDueThisWeek(issue: IssueRow, nowMs: number): boolean {
  if (CLOSED_LIKE.has(issue.status)) return false;
  const d = dueDayMs(issue);
  if (d == null) return false;
  const start = todayStartMs(nowMs);
  return d >= start && d <= start + 7 * DAY_MS;
}

function segments(
  counts: Map<string, number>,
  order: readonly string[],
  labels: Record<string, string>,
  fillFor: (key: string) => string,
): IssueCountSegment[] {
  const out: IssueCountSegment[] = [];
  const known = new Set<string>(order);
  for (const key of order) {
    const count = counts.get(key) ?? 0;
    if (count === 0) continue;
    out.push({ key, label: labels[key] ?? key, count, fill: fillFor(key) });
  }
  let other = 0;
  for (const [k, n] of counts) {
    if (!known.has(k)) other += n;
  }
  if (other > 0) out.push({ key: "OTHER", label: "Other", count: other, fill: "#94a3b8" });
  return out;
}

type OverviewAccumulator = {
  statusCounts: Map<string, number>;
  priorityCounts: Map<string, number>;
  workload: Map<string | null, IssueAssigneeWorkload>;
  attention: IssueRow[];
  overdue: number;
  dueThisWeek: number;
};

function accumulateIssue(acc: OverviewAccumulator, issue: IssueRow, nowMs: number): void {
  acc.statusCounts.set(issue.status, (acc.statusCounts.get(issue.status) ?? 0) + 1);
  const pri = (issue.priority ?? "MEDIUM").toUpperCase();
  acc.priorityCounts.set(pri, (acc.priorityCounts.get(pri) ?? 0) + 1);
  if (CLOSED_LIKE.has(issue.status)) return;

  const key = issue.assigneeId ?? null;
  const name = issue.assignee?.name?.trim() || issue.assignee?.email?.trim() || "Unassigned";
  const w = acc.workload.get(key) ?? { userId: key, name, openCount: 0 };
  w.openCount += 1;
  acc.workload.set(key, w);

  if (isIssueOverdue(issue, nowMs)) {
    acc.overdue += 1;
    acc.attention.push(issue);
  } else if (isIssueDueThisWeek(issue, nowMs)) {
    acc.dueThisWeek += 1;
    acc.attention.push(issue);
  }
}

export function computeIssuesOverview(
  items: IssueRow[],
  nowMs: number,
  maxList = 5,
): IssuesOverviewStats {
  const acc: OverviewAccumulator = {
    statusCounts: new Map(),
    priorityCounts: new Map(),
    workload: new Map(),
    attention: [],
    overdue: 0,
    dueThisWeek: 0,
  };
  for (const issue of items) accumulateIssue(acc, issue, nowMs);

  acc.attention.sort((a, b) => (dueDayMs(a) ?? Infinity) - (dueDayMs(b) ?? Infinity));

  const assigneeWorkload = [...acc.workload.values()].sort(
    (a, b) => b.openCount - a.openCount || a.name.localeCompare(b.name),
  );

  const recentIssues = [...items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, maxList);

  return {
    total: items.length,
    open: acc.statusCounts.get("OPEN") ?? 0,
    inProgress: acc.statusCounts.get("IN_PROGRESS") ?? 0,
    resolved: acc.statusCounts.get("RESOLVED") ?? 0,
    closed: acc.statusCounts.get("CLOSED") ?? 0,
    overdue: acc.overdue,
    dueThisWeek: acc.dueThisWeek,
    unassignedOpen: acc.workload.get(null)?.openCount ?? 0,
    statusSegments: segments(
      acc.statusCounts,
      ISSUE_STATUS_ORDER,
      ISSUE_STATUS_LABEL,
      issueStatusDotSolidFill,
    ),
    prioritySegments: segments(
      acc.priorityCounts,
      ISSUE_PRIORITY_ORDER,
      ISSUE_PRIORITY_LABEL,
      (k) => PRIORITY_FILL[k] ?? "#64748b",
    ),
    assigneeWorkload,
    attentionIssues: acc.attention.slice(0, maxList),
    recentIssues,
  };
}

/** `Aug 7` style label for due/updated dates (input may be a date or full ISO timestamp). */
export function issueOverviewShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = issueDateToInputValue(iso);
  const d = day ? new Date(`${day}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
