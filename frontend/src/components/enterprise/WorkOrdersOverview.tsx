"use client";

import { useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Flag,
  Layers,
  Sparkles,
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
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { useInsightsPanelState } from "@/hooks/useInsightsPanelState";
import {
  computeWorkOrdersOverview,
  type WorkOrdersOverviewFilter,
  type WorkOrdersOverviewStats,
} from "@/lib/workOrdersOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";

const INSIGHTS_OPEN_KEY = "plansync.woInsightsOpen";
const INSIGHTS_SEEN_KEY = "plansync.woInsightsSeen";

const KPI_BORDER = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
  info: "border-l-[var(--enterprise-semantic-info-text)]",
} as const;

export type WorkOrdersInsightsAction = {
  onClick: () => void;
  hint: string;
  showNewBadge: boolean;
  urgencyCount: number;
};

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
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
        hint="Past due date"
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
        hint="No assignee or vendor"
        active={filter === "UNASSIGNED"}
        onClick={() => onSelect("UNASSIGNED")}
      />
      <EnterpriseOverviewKpiTile
        label="SLA breach"
        value={stats.slaBreached}
        borderClass={stats.slaBreached > 0 ? KPI_BORDER.danger : KPI_BORDER.neutral}
        active={filter === "SLA:BREACH"}
        onClick={() => onSelect("SLA:BREACH")}
      />
      <EnterpriseOverviewKpiTile
        label="SLA at risk"
        value={stats.slaAtRisk}
        borderClass={stats.slaAtRisk > 0 ? KPI_BORDER.warning : KPI_BORDER.neutral}
        active={filter === "SLA:RISK"}
        onClick={() => onSelect("SLA:RISK")}
      />
      <EnterpriseOverviewKpiTile
        label="Done this week"
        value={stats.completedThisWeek}
        borderClass={stats.completedThisWeek > 0 ? KPI_BORDER.success : KPI_BORDER.neutral}
        active={filter === "COMPLETED_WEEK"}
        onClick={() => onSelect("COMPLETED_WEEK")}
      />
    </div>
  );
}

type Props = {
  rows: IssueRow[];
  filter: WorkOrdersOverviewFilter;
  onFilterChange: (key: WorkOrdersOverviewFilter) => void;
  currentUserId?: string | null;
  onInsightsActionChange?: (action: WorkOrdersInsightsAction | null) => void;
};

// fallow-ignore-next-line complexity
export function WorkOrdersOverview({
  rows,
  filter,
  onFilterChange,
  currentUserId,
  onInsightsActionChange,
}: Props) {
  const nowMs = useTickNowMs();
  const stats = useMemo(
    () => computeWorkOrdersOverview(rows, nowMs, currentUserId),
    [rows, nowMs, currentUserId],
  );
  const { insightsOpen, setInsightsOpen, insightsSeen, openInsights } = useInsightsPanelState(
    INSIGHTS_OPEN_KEY,
    INSIGHTS_SEEN_KEY,
  );
  const empty = stats.total === 0;

  const urgencyCount = stats.overdue + stats.slaBreached;
  const insightsHint =
    urgencyCount > 0 ? `${urgencyCount} need attention` : `${stats.active} active`;

  useEffect(() => {
    if (!onInsightsActionChange) return;
    if (empty) {
      onInsightsActionChange(null);
      return;
    }
    onInsightsActionChange({
      onClick: openInsights,
      hint: insightsHint,
      showNewBadge: insightsSeen === false,
      urgencyCount,
    });
  }, [empty, insightsHint, insightsSeen, onInsightsActionChange, openInsights, urgencyCount]);

  useEffect(() => {
    return () => onInsightsActionChange?.(null);
  }, [onInsightsActionChange]);

  if (empty) return null;

  const selectFilter = (key: string) => {
    onFilterChange(key as WorkOrdersOverviewFilter);
    setInsightsOpen(false);
  };

  const subtitle = `${stats.active} active · ${stats.total} total`;

  return (
    <>
      {filter !== "ACTIVE" && filter !== "ALL" ? (
        <section
          aria-label="Work orders overview"
          className="mb-2 flex min-w-0 shrink-0 flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]"
        >
          <span className="inline-flex items-center gap-1.5">
            <FilterHintIcon filter={filter} />
            Showing filtered work orders
          </span>
          <button
            type="button"
            onClick={() => onFilterChange("ACTIVE")}
            className="font-semibold text-[var(--enterprise-primary)] hover:underline"
          >
            Clear
          </button>
        </section>
      ) : null}

      <EnterpriseSlideOver
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        ariaLabelledBy="wo-insights-title"
        panelMaxWidthClass="max-w-full lg:w-[35vw] lg:max-w-[35vw]"
        header={
          <div className="min-w-0">
            <h2
              id="wo-insights-title"
              className="truncate text-base font-semibold text-[var(--enterprise-text)]"
            >
              Work order insights
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
              {subtitle}
            </p>
          </div>
        }
        footer={
          <button
            type="button"
            onClick={() => setInsightsOpen(false)}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] lg:w-auto"
          >
            Done
          </button>
        }
      >
        <div className="space-y-3">
          <KpiRow stats={stats} filter={filter} onSelect={selectFilter} />

          <EnterpriseOverviewCard compact title="Aging (active)" icon={Clock}>
            {stats.agingSegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">
                No active work orders.
              </p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.agingSegments}
                  onSelect={selectFilter}
                  label="Aging distribution"
                />
                <OverviewSegmentLegend
                  segments={stats.agingSegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                />
              </>
            )}
          </EnterpriseOverviewCard>

          <EnterpriseOverviewCard compact title="Priority" icon={Flag}>
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

          <EnterpriseOverviewCard compact title="Work order type" icon={Layers}>
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

          <EnterpriseOverviewCard compact title="By assignee" icon={UserRound}>
            {stats.assigneeSegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">
                No active assignees.
              </p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.assigneeSegments}
                  onSelect={selectFilter}
                  label="Assignee distribution"
                />
                <OverviewSegmentLegend
                  segments={stats.assigneeSegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                />
              </>
            )}
          </EnterpriseOverviewCard>

          <EnterpriseOverviewCard compact title="By building" icon={Building2}>
            {stats.buildingSegments.length === 0 ? (
              <p className="text-[12px] text-[var(--enterprise-text-muted)]">
                No building locations yet.
              </p>
            ) : (
              <>
                <OverviewSegmentBar
                  segments={stats.buildingSegments}
                  onSelect={selectFilter}
                  label="Building distribution"
                />
                <OverviewSegmentLegend
                  segments={stats.buildingSegments}
                  onSelect={selectFilter}
                  activeKey={filter}
                />
              </>
            )}
          </EnterpriseOverviewCard>
        </div>
      </EnterpriseSlideOver>
    </>
  );
}

function FilterHintIcon({ filter }: { filter: WorkOrdersOverviewFilter }) {
  if (filter === "OVERDUE" || filter === "SLA:BREACH" || filter === "SLA:RISK") {
    return <AlertTriangle className="h-3.5 w-3.5" aria-hidden />;
  }
  if (filter === "DUE_TODAY" || filter === "COMPLETED_WEEK") {
    return <Calendar className="h-3.5 w-3.5" aria-hidden />;
  }
  if (filter === "MINE" || filter === "UNASSIGNED" || filter.startsWith("ASSIGNEE:")) {
    return <UserRound className="h-3.5 w-3.5" aria-hidden />;
  }
  if (filter.startsWith("PRI:")) return <Flag className="h-3.5 w-3.5" aria-hidden />;
  if (filter.startsWith("TYPE:")) return <Layers className="h-3.5 w-3.5" aria-hidden />;
  if (filter.startsWith("AGE:")) return <Clock className="h-3.5 w-3.5" aria-hidden />;
  if (filter.startsWith("BUILDING:")) return <Building2 className="h-3.5 w-3.5" aria-hidden />;
  if (filter === "ACTIVE") return <Sparkles className="h-3.5 w-3.5" aria-hidden />;
  return <Wrench className="h-3.5 w-3.5" aria-hidden />;
}
