import type { RfiRow } from "@/lib/api-client";

export type RfisOverviewFilter =
  | "ALL"
  | "OPEN"
  | "IN_REVIEW"
  | "ANSWERED"
  | "CLOSED"
  | "OVERDUE"
  | "UNASSIGNED";

export type RfisOverviewStats = {
  total: number;
  open: number;
  inReview: number;
  answered: number;
  closed: number;
  overdue: number;
  unassigned: number;
};

function normStatus(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

function rfiAssigneeIds(r: RfiRow): string[] {
  const ids = new Set<string>();
  if (r.assignedToUserId) ids.add(r.assignedToUserId);
  if (r.assignedTo?.id) ids.add(r.assignedTo.id);
  for (const a of r.assignees ?? []) {
    if (a.id) ids.add(a.id);
  }
  return [...ids];
}

export function isRfiOverdue(r: RfiRow, nowMs: number): boolean {
  if (!r.dueDate) return false;
  const st = normStatus(r.status);
  if (st === "ANSWERED" || st === "CLOSED") return false;
  return new Date(r.dueDate).getTime() < nowMs;
}

/** Who must act next (Procore-style ball-in-court). */
export function rfiBallInCourt(r: RfiRow): string {
  const st = normStatus(r.status);
  if (st === "CLOSED") return "Closed";
  if (st === "ANSWERED") return r.creator?.name?.trim() || "Creator";
  if (st === "IN_REVIEW") {
    const names = (r.assignees ?? []).map((a) => a.name?.trim()).filter(Boolean) as string[];
    if (names.length > 0) return names.join(", ");
    return r.assignedTo?.name?.trim() || "Responders";
  }
  return r.creator?.name?.trim() || "Creator";
}

export function computeRfisOverview(rows: RfiRow[], nowMs: number): RfisOverviewStats {
  let open = 0;
  let inReview = 0;
  let answered = 0;
  let closed = 0;
  let overdue = 0;
  let unassigned = 0;
  for (const r of rows) {
    const st = normStatus(r.status);
    if (st === "OPEN") open += 1;
    else if (st === "IN_REVIEW") inReview += 1;
    else if (st === "ANSWERED") answered += 1;
    else if (st === "CLOSED") closed += 1;
    if (isRfiOverdue(r, nowMs)) overdue += 1;
    if (rfiAssigneeIds(r).length === 0) unassigned += 1;
  }
  return {
    total: rows.length,
    open,
    inReview,
    answered,
    closed,
    overdue,
    unassigned,
  };
}
