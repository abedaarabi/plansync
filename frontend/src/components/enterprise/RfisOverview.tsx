"use client";

import { useMemo } from "react";
import type { RfiRow } from "@/lib/api-client";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import { computeRfisOverview, type RfisOverviewFilter } from "@/lib/rfisOverviewStats";
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
  rows: RfiRow[];
  filter: RfisOverviewFilter;
  onFilterChange: (key: RfisOverviewFilter) => void;
};

export function RfisOverview({ rows, filter, onFilterChange }: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(() => computeRfisOverview(rows, nowMs), [rows, nowMs]);

  if (stats.total === 0) return null;

  return (
    <section aria-label="RFIs overview" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-7">
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
          borderClass={KPI_BORDER.info}
          active={filter === "OPEN"}
          onClick={() => onFilterChange("OPEN")}
        />
        <EnterpriseOverviewKpiTile
          label="In review"
          value={stats.inReview}
          borderClass={KPI_BORDER.primary}
          active={filter === "IN_REVIEW"}
          onClick={() => onFilterChange("IN_REVIEW")}
        />
        <EnterpriseOverviewKpiTile
          label="Answered"
          value={stats.answered}
          borderClass={KPI_BORDER.success}
          active={filter === "ANSWERED"}
          onClick={() => onFilterChange("ANSWERED")}
        />
        <EnterpriseOverviewKpiTile
          label="Closed"
          value={stats.closed}
          borderClass={KPI_BORDER.neutral}
          active={filter === "CLOSED"}
          onClick={() => onFilterChange("CLOSED")}
        />
        <EnterpriseOverviewKpiTile
          label="Overdue"
          value={stats.overdue}
          borderClass={stats.overdue > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
          active={filter === "OVERDUE"}
          onClick={() => onFilterChange("OVERDUE")}
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
          <span>Showing filtered RFIs</span>
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
