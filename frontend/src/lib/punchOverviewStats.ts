import type { PunchRow } from "@/lib/api-client";

export type PunchOverviewFilter =
  | "ALL"
  | "OPEN"
  | "IN_PROGRESS"
  | "READY_FOR_GC"
  | "CLOSED"
  | "MINE"
  | "OVERDUE"
  | "UNASSIGNED";

export type PunchOverviewStats = {
  total: number;
  open: number;
  inProgress: number;
  readyGc: number;
  closed: number;
  overdue: number;
  unassigned: number;
  mine: number;
};

function punchAssigneeIds(p: PunchRow): string[] {
  const ids = new Set<string>();
  if (p.assigneeId) ids.add(p.assigneeId);
  for (const a of p.assignees ?? []) {
    if (a.id) ids.add(a.id);
  }
  return [...ids];
}

function isOverdue(p: PunchRow, nowMs: number): boolean {
  if (!p.dueDate || p.status === "CLOSED") return false;
  return new Date(p.dueDate).getTime() < nowMs;
}

export function computePunchOverview(
  rows: PunchRow[],
  nowMs: number,
  currentUserId?: string | null,
): PunchOverviewStats {
  let open = 0;
  let inProgress = 0;
  let readyGc = 0;
  let closed = 0;
  let overdue = 0;
  let unassigned = 0;
  let mine = 0;
  for (const r of rows) {
    if (r.status === "OPEN") open += 1;
    else if (r.status === "IN_PROGRESS") inProgress += 1;
    else if (r.status === "READY_FOR_GC") readyGc += 1;
    else if (r.status === "CLOSED") closed += 1;
    if (isOverdue(r, nowMs)) overdue += 1;
    const ids = punchAssigneeIds(r);
    if (ids.length === 0) unassigned += 1;
    if (currentUserId && ids.includes(currentUserId)) mine += 1;
  }
  return {
    total: rows.length,
    open,
    inProgress,
    readyGc,
    closed,
    overdue,
    unassigned,
    mine,
  };
}

export function punchMatchesOverviewFilter(
  row: PunchRow,
  filter: PunchOverviewFilter,
  nowMs: number,
  currentUserId?: string | null,
): boolean {
  if (filter === "ALL") return true;
  if (
    filter === "OPEN" ||
    filter === "IN_PROGRESS" ||
    filter === "READY_FOR_GC" ||
    filter === "CLOSED"
  ) {
    return row.status === filter;
  }
  if (filter === "OVERDUE") return isOverdue(row, nowMs);
  if (filter === "UNASSIGNED") return punchAssigneeIds(row).length === 0;
  if (filter === "MINE") {
    if (!currentUserId) return false;
    return punchAssigneeIds(row).includes(currentUserId);
  }
  return true;
}
