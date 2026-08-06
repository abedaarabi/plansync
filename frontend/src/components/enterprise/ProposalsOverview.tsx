"use client";

import { useMemo } from "react";
import type { ProposalListRow } from "@/lib/api-client";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import {
  computeProposalsOverview,
  type ProposalsOverviewFilter,
} from "@/lib/proposalsOverviewStats";
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
  rows: ProposalListRow[];
  filter: ProposalsOverviewFilter;
  onFilterChange: (key: ProposalsOverviewFilter) => void;
};

export function ProposalsOverview({ rows, filter, onFilterChange }: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(() => computeProposalsOverview(rows, nowMs), [rows, nowMs]);

  if (stats.total === 0) return null;

  return (
    <section aria-label="Proposals overview" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
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
          borderClass={KPI_BORDER.neutral}
          active={filter === "DRAFT"}
          onClick={() => onFilterChange("DRAFT")}
        />
        <EnterpriseOverviewKpiTile
          label="Sent"
          value={stats.sent}
          borderClass={KPI_BORDER.info}
          active={filter === "SENT"}
          onClick={() => onFilterChange("SENT")}
        />
        <EnterpriseOverviewKpiTile
          label="Viewed"
          value={stats.viewed}
          borderClass={KPI_BORDER.primary}
          active={filter === "VIEWED"}
          onClick={() => onFilterChange("VIEWED")}
        />
        <EnterpriseOverviewKpiTile
          label="Accepted"
          value={stats.accepted}
          borderClass={KPI_BORDER.success}
          active={filter === "ACCEPTED"}
          onClick={() => onFilterChange("ACCEPTED")}
        />
        <EnterpriseOverviewKpiTile
          label="Declined"
          value={stats.declined}
          borderClass={stats.declined > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
          active={filter === "DECLINED"}
          onClick={() => onFilterChange("DECLINED")}
        />
        <EnterpriseOverviewKpiTile
          label="Expired"
          value={stats.expired}
          borderClass={stats.expired > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
          active={filter === "EXPIRED"}
          onClick={() => onFilterChange("EXPIRED")}
        />
        <EnterpriseOverviewKpiTile
          label="Changes"
          value={stats.changeRequested}
          borderClass={stats.changeRequested > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
          active={filter === "CHANGE_REQUESTED"}
          onClick={() => onFilterChange("CHANGE_REQUESTED")}
        />
        <EnterpriseOverviewKpiTile
          label="Expiring"
          value={stats.expiring}
          borderClass={stats.expiring > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
          hint="Valid within 7 days"
          active={filter === "EXPIRING"}
          onClick={() => onFilterChange("EXPIRING")}
        />
      </div>
      {filter !== "ALL" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <span>Showing filtered proposals</span>
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
