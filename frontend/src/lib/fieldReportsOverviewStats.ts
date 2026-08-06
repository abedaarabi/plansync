import type { FieldReportRow } from "@/lib/api-client";

export type FieldReportsOverviewFilter =
  | "ALL"
  | "DRAFT"
  | "SUBMITTED"
  | "DAILY"
  | "WEEKLY"
  | "THIS_MONTH"
  | "MISSING";

export type FieldReportsOverviewStats = {
  total: number;
  draft: number;
  submitted: number;
  daily: number;
  weekly: number;
  thisMonth: number;
  /** Distinct calendar days in the last 14 days with no daily report. */
  missingDays: number;
  missingDateKeys: string[];
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function reportDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Last 14 calendar days (excluding today) with no DAILY report. */
export function computeMissingDailyDates(rows: FieldReportRow[], nowMs: number): string[] {
  const dailyKeys = new Set(
    rows
      .filter((r) => (r.reportKind ?? "DAILY") === "DAILY")
      .map((r) => reportDateKey(r.reportDate)),
  );
  const missing: string[] = [];
  const today = new Date(nowMs);
  today.setHours(12, 0, 0, 0);
  for (let i = 1; i <= 14; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymdLocal(d);
    if (!dailyKeys.has(key)) missing.push(key);
  }
  return missing;
}

export function computeFieldReportsOverview(
  rows: FieldReportRow[],
  nowMs: number,
): FieldReportsOverviewStats {
  const monthStart = new Date(nowMs);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  let draft = 0;
  let submitted = 0;
  let daily = 0;
  let weekly = 0;
  let thisMonth = 0;
  for (const r of rows) {
    if ((r.status ?? "DRAFT") === "SUBMITTED") submitted += 1;
    else draft += 1;
    if ((r.reportKind ?? "DAILY") === "WEEKLY") weekly += 1;
    else daily += 1;
    if (new Date(r.reportDate).getTime() >= monthStartMs) thisMonth += 1;
  }
  const missingDateKeys = computeMissingDailyDates(rows, nowMs);
  return {
    total: rows.length,
    draft,
    submitted,
    daily,
    weekly,
    thisMonth,
    missingDays: missingDateKeys.length,
    missingDateKeys,
  };
}

export function fieldReportMatchesOverviewFilter(
  row: FieldReportRow,
  filter: FieldReportsOverviewFilter,
  nowMs: number,
  missingDateKeys: string[],
): boolean {
  if (filter === "ALL") return true;
  if (filter === "DRAFT" || filter === "SUBMITTED") return (row.status ?? "DRAFT") === filter;
  if (filter === "DAILY" || filter === "WEEKLY") return (row.reportKind ?? "DAILY") === filter;
  if (filter === "THIS_MONTH") {
    const monthStart = new Date(nowMs);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return new Date(row.reportDate).getTime() >= monthStart.getTime();
  }
  if (filter === "MISSING") {
    // List still shows real reports; missing filter is handled via empty/banner in the client.
    void missingDateKeys;
    return true;
  }
  return true;
}
