"use client";

import { useMemo } from "react";
import type { PunchRow } from "@/lib/api-client";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import { computePunchOverview, type PunchOverviewFilter } from "@/lib/punchOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";

const KPI_BORDER = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
  info: "border-l-[var(--enterprise-semantic-info-text)]",
} as const;

type Props = {
  rows: PunchRow[];
  filter: PunchOverviewFilter;
  onFilterChange: (key: PunchOverviewFilter) => void;
  currentUserId?: string | null;
};

export function PunchOverview({ rows, filter, onFilterChange, currentUserId }: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(
    () => computePunchOverview(rows, nowMs, currentUserId),
    [rows, nowMs, currentUserId],
  );

  if (stats.total === 0) return null;

  return (
    <section aria-label="Punch list overview" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <EnterpriseOverviewKpiTile
          label="Total"
          value={stats.total}
          borderClass={KPI_BORDER.neutral}
          active={filter === "ALL"}
          onClick={() => onFilterChange("ALL")}
        />
        <EnterpriseOverviewKpiTile
          label="Open"
          value={stats.open}
          borderClass={stats.open > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
          active={filter === "OPEN"}
          onClick={() => onFilterChange("OPEN")}
        />
        <EnterpriseOverviewKpiTile
          label="In progress"
          value={stats.inProgress}
          borderClass={KPI_BORDER.warning}
          active={filter === "IN_PROGRESS"}
          onClick={() => onFilterChange("IN_PROGRESS")}
        />
        <EnterpriseOverviewKpiTile
          label="Ready for GC"
          value={stats.readyGc}
          borderClass={KPI_BORDER.info}
          active={filter === "READY_FOR_GC"}
          onClick={() => onFilterChange("READY_FOR_GC")}
        />
        <EnterpriseOverviewKpiTile
          label="Closed"
          value={stats.closed}
          borderClass={KPI_BORDER.success}
          active={filter === "CLOSED"}
          onClick={() => onFilterChange("CLOSED")}
        />
        <EnterpriseOverviewKpiTile
          label="Overdue"
          value={stats.overdue}
          borderClass={stats.overdue > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
          hint="Open past due date"
          active={filter === "OVERDUE"}
          onClick={() => onFilterChange("OVERDUE")}
        />
        <EnterpriseOverviewKpiTile
          label="Mine"
          value={stats.mine}
          borderClass={KPI_BORDER.primary}
          active={filter === "MINE"}
          onClick={() => onFilterChange("MINE")}
        />
        <EnterpriseOverviewKpiTile
          label="Unassigned"
          value={stats.unassigned}
          borderClass={stats.unassigned > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
          active={filter === "UNASSIGNED"}
          onClick={() => onFilterChange("UNASSIGNED")}
        />
      </div>
      {filter !== "ALL" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <span>Showing filtered punch items</span>
          <button
            type="button"
            onClick={() => onFilterChange("ALL")}
            className="font-semibold text-[var(--enterprise-primary)] hover:underline"
          >
            Clear filter
          </button>
        </div>
      ) : null}
    </section>
  );
}
