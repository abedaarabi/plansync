"use client";

import { useMemo } from "react";
import type { FieldReportRow } from "@/lib/api-client";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import {
  computeFieldReportsOverview,
  type FieldReportsOverviewFilter,
} from "@/lib/fieldReportsOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";

const KPI_BORDER = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
} as const;

type Props = {
  rows: FieldReportRow[];
  filter: FieldReportsOverviewFilter;
  onFilterChange: (key: FieldReportsOverviewFilter) => void;
};

export function FieldReportsOverview({ rows, filter, onFilterChange }: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(() => computeFieldReportsOverview(rows, nowMs), [rows, nowMs]);

  if (stats.total === 0 && stats.missingDays === 0) return null;

  return (
    <section aria-label="Field reports overview" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        <EnterpriseOverviewKpiTile
          label="Total"
          value={stats.total}
          borderClass={KPI_BORDER.neutral}
          active={filter === "ALL"}
          onClick={() => onFilterChange("ALL")}
        />
        <EnterpriseOverviewKpiTile
          label="Draft"
          value={stats.draft}
          borderClass={KPI_BORDER.warning}
          active={filter === "DRAFT"}
          onClick={() => onFilterChange("DRAFT")}
        />
        <EnterpriseOverviewKpiTile
          label="Submitted"
          value={stats.submitted}
          borderClass={KPI_BORDER.success}
          active={filter === "SUBMITTED"}
          onClick={() => onFilterChange("SUBMITTED")}
        />
        <EnterpriseOverviewKpiTile
          label="This month"
          value={stats.thisMonth}
          borderClass={KPI_BORDER.primary}
          active={filter === "THIS_MONTH"}
          onClick={() => onFilterChange("THIS_MONTH")}
        />
        <EnterpriseOverviewKpiTile
          label="Daily"
          value={stats.daily}
          borderClass={KPI_BORDER.neutral}
          active={filter === "DAILY"}
          onClick={() => onFilterChange("DAILY")}
        />
        <EnterpriseOverviewKpiTile
          label="Missing days"
          value={stats.missingDays}
          borderClass={stats.missingDays > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
          hint="No daily log in the last 14 days"
          active={filter === "MISSING"}
          onClick={() => onFilterChange("MISSING")}
        />
      </div>
      {filter !== "ALL" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <span>Showing filtered field reports</span>
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
