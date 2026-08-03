"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Clock, DollarSign, Wrench } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmKpiCard } from "@/components/enterprise/OmKpiCard";
import { OmMaintenanceReportCharts } from "@/components/enterprise/OmMaintenanceReportCharts";
import { OmSectionCard } from "@/components/enterprise/OmSectionCard";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { fetchOmMaintenanceReport } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type Props = { projectId: string };

export function OmMaintenanceReportsClient({ projectId }: Props) {
  const {
    data: report,
    isPending,
    error,
  } = useQuery({
    queryKey: qk.omMaintenanceReport(projectId),
    queryFn: () => fetchOmMaintenanceReport(projectId),
  });

  if (isPending) return <EnterpriseLoadingState message="Loading reports…" label="Loading" />;
  if (error || !report) {
    return (
      <p className="enterprise-alert-danger rounded-xl px-3 py-2.5 text-sm">
        {error instanceof Error ? error.message : "Failed to load reports."}
      </p>
    );
  }

  const pmTone =
    report.pmCompliancePct >= 80 ? "success" : report.pmCompliancePct >= 50 ? "warning" : "danger";
  const backlogOverdue = report.backlog.filter((b) => b.overdue).length;

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={BarChart3}
        title="Maintenance reports"
        description="MTTR, labor and parts costs, PM compliance, and open backlog."
      />

      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        <OmKpiCard
          label="MTTR"
          value={report.mttrHours != null ? `${report.mttrHours}h` : "—"}
          icon={Clock}
          tone="primary"
          hint="Mean time to repair · resolved work orders"
        />
        <OmKpiCard
          label="Labor hours"
          value={`${report.totalLaborHours}h`}
          icon={Wrench}
          tone="neutral"
          hint="On resolved orders"
        />
        <OmKpiCard
          label="Parts cost"
          value={`$${report.totalPartsCost.toFixed(2)}`}
          icon={DollarSign}
          tone="neutral"
          hint="Resolved orders"
        />
        <OmKpiCard
          label="PM on-time"
          value={`${report.pmCompliancePct}%`}
          icon={BarChart3}
          tone={pmTone}
          hint="Completed on or before due"
        />
      </div>

      <OmMaintenanceReportCharts report={report} />

      <OmSectionCard
        title="Open backlog"
        description={
          backlogOverdue > 0
            ? `${report.backlog.length} open · ${backlogOverdue} overdue`
            : `${report.backlog.length} open work order${report.backlog.length === 1 ? "" : "s"}`
        }
      >
        {report.backlog.length === 0 ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            No open work orders. Nice work.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.backlog.slice(0, 15).map((b) => (
              <li
                key={b.id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2.5 ${
                  b.overdue ? "border-l-4 border-l-[var(--enterprise-semantic-danger-muted)]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--enterprise-text)]">{b.title}</p>
                  {b.overdue ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)]">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Overdue
                    </p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums ${
                    b.overdue
                      ? "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]"
                      : "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]"
                  }`}
                >
                  {b.ageDays}d
                </span>
              </li>
            ))}
          </ul>
        )}
      </OmSectionCard>
    </div>
  );
}
