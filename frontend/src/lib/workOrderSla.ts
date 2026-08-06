import type { IssueRow } from "@/lib/api-client";

/** Response/resolve targets by priority (hours). Procore-style SLA clocks. */
const SLA_HOURS: Record<string, { respond: number; resolve: number }> = {
  CRITICAL: { respond: 4, resolve: 24 },
  HIGH: { respond: 8, resolve: 48 },
  MEDIUM: { respond: 24, resolve: 120 },
  LOW: { respond: 48, resolve: 240 },
};

export type WorkOrderSlaInfo = {
  label: string;
  tone: "ok" | "warn" | "danger";
  hoursOpen: number;
  resolveHours: number;
};

export function workOrderSlaInfo(wo: IssueRow, nowMs = Date.now()): WorkOrderSlaInfo | null {
  const active = wo.status === "OPEN" || wo.status === "IN_PROGRESS";
  if (!active) return null;
  const pri = (wo.priority ?? "MEDIUM").toUpperCase();
  const targets = SLA_HOURS[pri] ?? SLA_HOURS.MEDIUM!;
  const start = new Date(wo.statusChangedAt ?? wo.createdAt).getTime();
  const hoursOpen = Math.max(0, (nowMs - start) / 3_600_000);
  const dueMs = wo.dueDate ? new Date(wo.dueDate).getTime() : null;
  const pastDue = dueMs != null && dueMs < nowMs;

  if (pastDue || hoursOpen >= targets.resolve) {
    return {
      label: pastDue ? "Past due · SLA breach" : `Open ${formatHours(hoursOpen)} · SLA breach`,
      tone: "danger",
      hoursOpen,
      resolveHours: targets.resolve,
    };
  }
  if (hoursOpen >= targets.resolve * 0.75 || hoursOpen >= targets.respond) {
    return {
      label: `Open ${formatHours(hoursOpen)} · SLA at risk`,
      tone: "warn",
      hoursOpen,
      resolveHours: targets.resolve,
    };
  }
  return {
    label: `Open ${formatHours(hoursOpen)}`,
    tone: "ok",
    hoursOpen,
    resolveHours: targets.resolve,
  };
}

function formatHours(h: number): string {
  if (h < 24) return `${Math.max(1, Math.round(h))}h`;
  const d = Math.floor(h / 24);
  const rem = Math.round(h - d * 24);
  return rem > 0 ? `${d}d ${rem}h` : `${d}d`;
}

export function formatWorkOrderNumber(wo: IssueRow): string {
  const n = wo.workOrderNumber ?? wo.displayNumber;
  if (n == null || n <= 0) return `#${wo.id.slice(0, 6)}`;
  return `WO-${String(n).padStart(3, "0")}`;
}
