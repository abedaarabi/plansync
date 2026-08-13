/** Pure aggregations behind the work-orders insights panel (no React, no fetches). */

import type { IssueRow } from "@/lib/api-client";
import { ISSUE_PRIORITY_LABEL, ISSUE_PRIORITY_ORDER } from "@/lib/issueStatusStyle";
import { workOrderSlaInfo } from "@/lib/workOrderSla";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

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
  | "SLA:BREACH"
  | "SLA:RISK"
  | "COMPLETED_WEEK"
  | `PRI:${string}`
  | `TYPE:${string}`
  | `AGE:${string}`
  | `BUILDING:${string}`
  | `ASSIGNEE:${string}`;

export type WorkOrdersOverviewStats = {
  total: number;
  active: number;
  open: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  mine: number;
  slaBreached: number;
  slaAtRisk: number;
  completedThisWeek: number;
  prioritySegments: WorkOrderCountSegment[];
  typeSegments: WorkOrderCountSegment[];
  agingSegments: WorkOrderCountSegment[];
  buildingSegments: WorkOrderCountSegment[];
  assigneeSegments: WorkOrderCountSegment[];
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

const AGE_BUCKETS = [
  { key: "0-3", label: "0–3 days", maxDays: 3, fill: "#2563eb" },
  { key: "4-7", label: "4–7 days", maxDays: 7, fill: "#0d9488" },
  { key: "8-14", label: "8–14 days", maxDays: 14, fill: "#d97706" },
  { key: "14+", label: "14+ days", maxDays: Infinity, fill: "#dc2626" },
] as const;

const ASSIGNEE_PALETTE = ["#2563eb", "#0d9488", "#7c3aed", "#d97706", "#db2777", "#64748b"];

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

function ageDaysOpen(wo: IssueRow, nowMs: number): number {
  const start = new Date(wo.statusChangedAt ?? wo.createdAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, (nowMs - start) / DAY_MS);
}

function ageBucketKey(days: number): string {
  for (const b of AGE_BUCKETS) {
    if (days <= b.maxDays) return b.key;
  }
  return "14+";
}

function isCompletedThisWeek(wo: IssueRow, nowMs: number): boolean {
  if (wo.status !== "RESOLVED" && wo.status !== "CLOSED") return false;
  const at = wo.resolvedAt ?? wo.statusChangedAt ?? wo.updatedAt;
  if (!at) return false;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= nowMs - WEEK_MS && t <= nowMs;
}

// fallow-ignore-next-line complexity
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
  if (filter === "SLA:BREACH") {
    return workOrderSlaInfo(wo, nowMs)?.tone === "danger";
  }
  if (filter === "SLA:RISK") {
    return workOrderSlaInfo(wo, nowMs)?.tone === "warn";
  }
  if (filter === "COMPLETED_WEEK") return isCompletedThisWeek(wo, nowMs);
  if (filter.startsWith("PRI:")) {
    const pri = (wo.priority ?? "MEDIUM").toUpperCase();
    return pri === filter.slice(4);
  }
  if (filter.startsWith("TYPE:")) {
    return (wo.workOrderType ?? "") === filter.slice(5);
  }
  if (filter.startsWith("AGE:")) {
    if (!isActiveStatus(wo.status)) return false;
    return ageBucketKey(ageDaysOpen(wo, nowMs)) === filter.slice(4);
  }
  if (filter.startsWith("BUILDING:")) {
    const id = filter.slice(9);
    if (id === "__none__") return !wo.buildingId;
    return wo.buildingId === id;
  }
  if (filter.startsWith("ASSIGNEE:")) {
    const id = filter.slice(9);
    if (id === "__none__") return isActiveStatus(wo.status) && !wo.assigneeId;
    return wo.assigneeId === id;
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
  let slaBreached = 0;
  let slaAtRisk = 0;
  let completedThisWeek = 0;
  const priorityCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const ageCounts = new Map<string, number>();
  const buildingCounts = new Map<string, { label: string; count: number }>();
  const assigneeCounts = new Map<string, { label: string; count: number }>();

  for (const wo of rows) {
    if (wo.status === "OPEN") open += 1;
    if (wo.status === "IN_PROGRESS") inProgress += 1;
    if (isCompletedThisWeek(wo, nowMs)) completedThisWeek += 1;

    if (isActiveStatus(wo.status)) {
      active += 1;
      if (workOrderIsOverdue(wo, nowMs)) overdue += 1;
      if (workOrderIsDueToday(wo, nowMs)) dueToday += 1;
      if (!wo.assigneeId && !wo.vendorId) unassigned += 1;

      const sla = workOrderSlaInfo(wo, nowMs);
      if (sla?.tone === "danger") slaBreached += 1;
      else if (sla?.tone === "warn") slaAtRisk += 1;

      const ageKey = ageBucketKey(ageDaysOpen(wo, nowMs));
      ageCounts.set(ageKey, (ageCounts.get(ageKey) ?? 0) + 1);

      const bId = wo.buildingId?.trim() || "__none__";
      const bLabel = wo.buildingName?.trim() || "No building";
      const bPrev = buildingCounts.get(bId);
      buildingCounts.set(bId, { label: bLabel, count: (bPrev?.count ?? 0) + 1 });

      const aId = wo.assigneeId?.trim() || "__none__";
      const aLabel = wo.assignee?.name?.trim() || wo.assignee?.email?.trim() || "Unassigned";
      const aPrev = assigneeCounts.get(aId);
      assigneeCounts.set(aId, { label: aLabel, count: (aPrev?.count ?? 0) + 1 });
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

  const agingSegments: WorkOrderCountSegment[] = [];
  for (const b of AGE_BUCKETS) {
    const count = ageCounts.get(b.key) ?? 0;
    if (count === 0) continue;
    agingSegments.push({
      key: `AGE:${b.key}`,
      label: b.label,
      count,
      fill: b.fill,
    });
  }

  const buildingSegments = [...buildingCounts.entries()]
    .map(([id, v]) => ({
      key: `BUILDING:${id}`,
      label: v.label,
      count: v.count,
      fill: id === "__none__" ? "#94a3b8" : "#2563eb",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const assigneeSegments = [...assigneeCounts.entries()]
    .map(([id, v], i) => ({
      key: `ASSIGNEE:${id}`,
      label: v.label,
      count: v.count,
      fill: ASSIGNEE_PALETTE[i % ASSIGNEE_PALETTE.length]!,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    total: rows.length,
    active,
    open,
    inProgress,
    overdue,
    dueToday,
    unassigned,
    mine,
    slaBreached,
    slaAtRisk,
    completedThisWeek,
    prioritySegments,
    typeSegments,
    agingSegments,
    buildingSegments,
    assigneeSegments,
  };
}
