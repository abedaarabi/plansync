/** Pure aggregations behind the work-orders overview (no React, no fetches). */

import type { IssueRow } from "@/lib/api-client";
import { ISSUE_PRIORITY_LABEL, ISSUE_PRIORITY_ORDER } from "@/lib/issueStatusStyle";

const DAY_MS = 86_400_000;

export type WorkOrderCountSegment = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

/** Unified filter keys for overview KPIs / breakdowns. */
export type WorkOrdersOverviewFilter =
  | "ALL"
  | "ACTIVE"
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "OVERDUE"
  | "DUE_TODAY"
  | "MINE"
  | "UNASSIGNED"
  | `PRI:${string}`
  | `TYPE:${string}`;

export type WorkOrdersOverviewStats = {
  total: number;
  active: number;
  open: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  mine: number;
  prioritySegments: WorkOrderCountSegment[];
  typeSegments: WorkOrderCountSegment[];
};

const WO_TYPE_LABEL: Record<string, string> = {
  CORRECTIVE: "Corrective",
  PREVENTIVE: "Preventive",
  INSPECTION_FOLLOWUP: "Inspection",
  TENANT: "Tenant",
  OCCUPANT: "Occupant",
};

const WO_TYPE_ORDER = [
  "CORRECTIVE",
  "PREVENTIVE",
  "INSPECTION_FOLLOWUP",
  "TENANT",
  "OCCUPANT",
] as const;

const PRIORITY_FILL: Record<string, string> = {
  HIGH: "#dc2626",
  MEDIUM: "#2563eb",
  LOW: "#64748b",
};

const TYPE_FILL: Record<string, string> = {
  CORRECTIVE: "#2563eb",
  PREVENTIVE: "#0d9488",
  INSPECTION_FOLLOWUP: "#7c3aed",
  TENANT: "#d97706",
  OCCUPANT: "#db2777",
};

function todayStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dueDayMs(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const t = new Date(dueDate).getTime();
  return Number.isFinite(t) ? t : null;
}

function isActiveStatus(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

function workOrderIsOverdue(wo: IssueRow, nowMs: number): boolean {
  if (!isActiveStatus(wo.status)) return false;
  const d = dueDayMs(wo.dueDate);
  if (d == null) return false;
  return d < todayStartMs(nowMs);
}

function workOrderIsDueToday(wo: IssueRow, nowMs: number): boolean {
  if (!isActiveStatus(wo.status)) return false;
  const d = dueDayMs(wo.dueDate);
  if (d == null) return false;
  const start = todayStartMs(nowMs);
  return d >= start && d < start + DAY_MS;
}

function workOrderMatchesOverviewFilter(
  wo: IssueRow,
  filter: WorkOrdersOverviewFilter,
  nowMs: number,
  currentUserId?: string | null,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "ACTIVE") return isActiveStatus(wo.status);
  if (
    filter === "OPEN" ||
    filter === "IN_PROGRESS" ||
    filter === "RESOLVED" ||
    filter === "CLOSED"
  ) {
    return wo.status === filter;
  }
  if (filter === "OVERDUE") return workOrderIsOverdue(wo, nowMs);
  if (filter === "DUE_TODAY") return workOrderIsDueToday(wo, nowMs);
  if (filter === "MINE") {
    return Boolean(currentUserId && wo.assigneeId === currentUserId);
  }
  if (filter === "UNASSIGNED") {
    return isActiveStatus(wo.status) && !wo.assigneeId && !wo.vendorId;
  }
  if (filter.startsWith("PRI:")) {
    const pri = (wo.priority ?? "MEDIUM").toUpperCase();
    return pri === filter.slice(4);
  }
  if (filter.startsWith("TYPE:")) {
    return (wo.workOrderType ?? "") === filter.slice(5);
  }
  return true;
}

export function filterWorkOrders(
  rows: IssueRow[],
  filter: WorkOrdersOverviewFilter,
  nowMs: number,
  currentUserId?: string | null,
): IssueRow[] {
  if (filter === "ALL") return rows;
  return rows.filter((wo) => workOrderMatchesOverviewFilter(wo, filter, nowMs, currentUserId));
}

// fallow-ignore-next-line complexity
export function computeWorkOrdersOverview(
  rows: IssueRow[],
  nowMs: number,
  currentUserId?: string | null,
): WorkOrdersOverviewStats {
  let active = 0;
  let open = 0;
  let inProgress = 0;
  let overdue = 0;
  let dueToday = 0;
  let unassigned = 0;
  let mine = 0;
  const priorityCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const wo of rows) {
    if (wo.status === "OPEN") open += 1;
    if (wo.status === "IN_PROGRESS") inProgress += 1;
    if (isActiveStatus(wo.status)) {
      active += 1;
      if (workOrderIsOverdue(wo, nowMs)) overdue += 1;
      if (workOrderIsDueToday(wo, nowMs)) dueToday += 1;
      if (!wo.assigneeId && !wo.vendorId) unassigned += 1;
    }
    if (currentUserId && wo.assigneeId === currentUserId) mine += 1;

    const pri = (wo.priority ?? "MEDIUM").toUpperCase();
    priorityCounts.set(pri, (priorityCounts.get(pri) ?? 0) + 1);

    const type = wo.workOrderType?.trim();
    if (type) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const prioritySegments: WorkOrderCountSegment[] = [];
  for (const key of ISSUE_PRIORITY_ORDER) {
    const count = priorityCounts.get(key) ?? 0;
    if (count === 0) continue;
    prioritySegments.push({
      key: `PRI:${key}`,
      label: ISSUE_PRIORITY_LABEL[key] ?? key,
      count,
      fill: PRIORITY_FILL[key] ?? "#64748b",
    });
  }

  const typeSegments: WorkOrderCountSegment[] = [];
  for (const key of WO_TYPE_ORDER) {
    const count = typeCounts.get(key) ?? 0;
    if (count === 0) continue;
    typeSegments.push({
      key: `TYPE:${key}`,
      label: WO_TYPE_LABEL[key] ?? key,
      count,
      fill: TYPE_FILL[key] ?? "#64748b",
    });
  }
  for (const [key, count] of typeCounts) {
    if ((WO_TYPE_ORDER as readonly string[]).includes(key)) continue;
    typeSegments.push({
      key: `TYPE:${key}`,
      label: key,
      count,
      fill: "#94a3b8",
    });
  }

  return {
    total: rows.length,
    active,
    open,
    inProgress,
    overdue,
    dueToday,
    unassigned,
    mine,
    prioritySegments,
    typeSegments,
  };
}
