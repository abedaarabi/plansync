import type { IssueKindApi, IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { isIssueDueOverdue } from "@/lib/bim/bimIssueMarkerUtils";

export type BimIssueTypeFilter = "all" | IssueKindApi;
export type BimIssueDueFilter = "all" | "overdue" | "dueToday" | "dueSoon";

export type BimIssueDockFilters = {
  type: BimIssueTypeFilter;
  due: BimIssueDueFilter;
  startSoon: boolean;
};

export const EMPTY_BIM_ISSUE_DOCK_FILTERS: BimIssueDockFilters = {
  type: "all",
  due: "all",
  startSoon: false,
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseIssueDay(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return startOfLocalDay(d);
}

function isIssueActive(issue: Pick<IssueRow, "status">): boolean {
  const st = issue.status.toUpperCase();
  return st === "OPEN" || st === "IN_PROGRESS";
}

function isIssueDueToday(issue: IssueRow): boolean {
  if (!isIssueActive(issue)) return false;
  const due = parseIssueDay(issue.dueDate);
  if (!due) return false;
  const today = startOfLocalDay(new Date());
  return due.getTime() === today.getTime();
}

// fallow-ignore-next-line complexity
function isIssueDueSoon(issue: IssueRow, withinDays = 7): boolean {
  if (!isIssueActive(issue) || !issue.dueDate) return false;
  if (isIssueDueOverdue(issue)) return false;
  const due = parseIssueDay(issue.dueDate);
  if (!due) return false;
  const today = startOfLocalDay(new Date());
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);
  return due >= today && due <= limit;
}

// fallow-ignore-next-line complexity
function isIssueStartSoon(issue: IssueRow, withinDays = 7): boolean {
  if (!isIssueActive(issue) || !issue.startDate) return false;
  const start = parseIssueDay(issue.startDate);
  if (!start) return false;
  const today = startOfLocalDay(new Date());
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);
  return start >= today && start <= limit;
}

export function bimIssueDockFiltersActive(filters: BimIssueDockFilters): boolean {
  return filters.type !== "all" || filters.due !== "all" || filters.startSoon;
}

// fallow-ignore-next-line complexity
function matchesBimDockFilters(issue: IssueRow, filters: BimIssueDockFilters): boolean {
  if (filters.type !== "all") {
    const kind = (issue.issueKind ?? "CONSTRUCTION").toUpperCase();
    if (kind !== filters.type) return false;
  }
  if (filters.due === "overdue" && !isIssueDueOverdue(issue)) return false;
  if (filters.due === "dueToday" && !isIssueDueToday(issue)) return false;
  if (filters.due === "dueSoon" && !isIssueDueSoon(issue)) return false;
  if (filters.startSoon && !isIssueStartSoon(issue)) return false;
  return true;
}

export function filterBimDockIssues(issues: IssueRow[], filters: BimIssueDockFilters): IssueRow[] {
  return issues.filter((issue) => matchesBimDockFilters(issue, filters));
}

// fallow-ignore-next-line complexity
export function countBimIssueDockFilterMatches(
  issues: IssueRow[],
): Record<BimIssueTypeFilter | BimIssueDueFilter | "startSoon", number> {
  const counts = {
    all: issues.length,
    CONSTRUCTION: 0,
    WORK_ORDER: 0,
    OCCUPANT: 0,
    overdue: 0,
    dueToday: 0,
    dueSoon: 0,
    startSoon: 0,
  } as Record<BimIssueTypeFilter | BimIssueDueFilter | "startSoon", number>;

  for (const issue of issues) {
    const kind = (issue.issueKind ?? "CONSTRUCTION").toUpperCase();
    if (kind === "CONSTRUCTION") counts.CONSTRUCTION += 1;
    if (kind === "WORK_ORDER") counts.WORK_ORDER += 1;
    if (kind === "OCCUPANT") counts.OCCUPANT += 1;
    if (isIssueDueOverdue(issue)) counts.overdue += 1;
    if (isIssueDueToday(issue)) counts.dueToday += 1;
    if (isIssueDueSoon(issue)) counts.dueSoon += 1;
    if (isIssueStartSoon(issue)) counts.startSoon += 1;
  }

  return counts;
}
