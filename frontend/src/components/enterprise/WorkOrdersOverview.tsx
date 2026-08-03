"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Flag,
  Layers,
  UserRound,
  Wrench,
} from "lucide-react";
import type { IssueRow } from "@/lib/api-client";
import { EnterpriseOverviewCard } from "@/components/enterprise/EnterpriseOverviewCard";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import {
  OverviewSegmentBar,
  OverviewSegmentLegend,
} from "@/components/enterprise/EnterpriseOverviewSegments";
import {
  computeWorkOrdersOverview,
  type WorkOrdersOverviewFilter,
  type WorkOrdersOverviewStats,
} from "@/lib/workOrdersOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";

const KPI_BORDER = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
} as const;

function KpiRow({
  stats,
  filter,
  onSelect,
}: {
  stats: WorkOrdersOverviewStats;
  filter: WorkOrdersOverviewFilter;
  onSelect: (key: WorkOrdersOverviewFilter) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
      <EnterpriseOverviewKpiTile
        label="Active"
        value={stats.active}
        borderClass={KPI_BORDER.primary}
        active={filter === "ACTIVE"}
        onClick={() => onSelect("ACTIVE")}
      />
      <EnterpriseOverviewKpiTile
        label="Open"
        value={stats.open}
        borderClass={stats.open > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
        active={filter === "OPEN"}
        onClick={() => onSelect("OPEN")}
      />
      <EnterpriseOverviewKpiTile
        label="In progress"
        value={stats.inProgress}
        borderClass={KPI_BORDER.primary}
        active={filter === "IN_PROGRESS"}
        onClick={() => onSelect("IN_PROGRESS")}
      />
      <EnterpriseOverviewKpiTile
        label="Overdue"
        value={stats.overdue}
        borderClass={stats.overdue > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
        hint="Open past due date"
        active={filter === "OVERDUE"}
        onClick={() => onSelect("OVERDUE")}
      />
      <EnterpriseOverviewKpiTile
        label="Due today"
        value={stats.dueToday}
        borderClass={stats.dueToday > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
        active={filter === "DUE_TODAY"}
        onClick={() => onSelect("DUE_TODAY")}
      />
      <EnterpriseOverviewKpiTile
        label="Unassigned"
        value={stats.unassigned}
        borderClass={stats.unassigned > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
        hint="Active with no assignee or vendor"
        active={filter === "UNASSIGNED"}
        onClick={() => onSelect("UNASSIGNED")}
      />
    </div>
  );
}

type Props = {
  rows: IssueRow[];
  filter: WorkOrdersOverviewFilter;
  onFilterChange: (key: WorkOrdersOverviewFilter) => void;
  currentUserId?: string | null;
};

export function WorkOrdersOverview({ rows, filter, onFilterChange, currentUserId }: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(
    () => computeWorkOrdersOverview(rows, nowMs, currentUserId),
    [rows, nowMs, currentUserId],
  );
  const [open, setOpen] = useState(true);

  if (stats.total === 0) return null;

  const selectFilter = (key: string) => onFilterChange(key as WorkOrdersOverviewFilter);

  return (
    <section aria-label="Work orders overview" className="space-y-3">
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
          Overview
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <div className={`${open ? "block" : "hidden"} space-y-3 sm:block`}>
        <KpiRow stats={stats} filter={filter} onSelect={onFilterChange} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <EnterpriseOverviewCard title="Priority" icon={Flag}>
            <OverviewSegmentBar
              segments={stats.prioritySegments}
              onSelect={selectFilter}
              label="Priority distribution"
            />
            <OverviewSegmentLegend
              segments={stats.prioritySegments}
              onSelect={selectFilter}
              activeKey={filter}
            />
          </EnterpriseOverviewCard>
          <EnterpriseOverviewCard title="Work order type" icon={Layers}>
            {stats.typeSegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">
                No types recorded yet.
              </p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.typeSegments}
                  onSelect={selectFilter}
                  label="Type distribution"
                />
                <OverviewSegmentLegend
                  segments={stats.typeSegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                />
              </>
            )}
          </EnterpriseOverviewCard>
        </div>

        {filter !== "ACTIVE" && filter !== "ALL" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <FilterHintIcon filter={filter} />
              Showing filtered work orders
            </span>
            <button
              type="button"
              onClick={() => onFilterChange("ACTIVE")}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FilterHintIcon({ filter }: { filter: WorkOrdersOverviewFilter }) {
  if (filter === "OVERDUE") return <AlertTriangle className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "DUE_TODAY") return <Calendar className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "MINE" || filter === "UNASSIGNED") {
    return <UserRound className="h-3.5 w-3.5" aria-hidden />;
  }
  if (filter.startsWith("PRI:")) return <Flag className="h-3.5 w-3.5" aria-hidden />;
  if (filter.startsWith("TYPE:")) return <Layers className="h-3.5 w-3.5" aria-hidden />;
  return <Wrench className="h-3.5 w-3.5" aria-hidden />;
}
