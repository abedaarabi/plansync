"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Download,
  Inbox,
  LayoutGrid,
  Package,
  Wrench,
} from "lucide-react";
import {
  fetchOmFmDashboard,
  fetchProjectSession,
  omAssetRegisterCsvUrl,
  omOccupantAssetQrCsvUrl,
} from "@/lib/api-client";
import { ISSUE_STATUS_LABEL } from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { enterpriseButtonClassName } from "@/components/enterprise/EnterpriseButton";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";

type Props = { projectId: string };

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "amber" | "emerald" | "red";
}) {
  const border =
    tone === "red"
      ? "border-l-red-500"
      : tone === "amber"
        ? "border-l-amber-500"
        : tone === "emerald"
          ? "border-l-emerald-500"
          : "border-l-slate-400";
  return (
    <div
      className={`enterprise-card rounded-md border-l-4 p-2.5 transition-transform duration-150 active:scale-[0.98] ${border}`}
    >
      <p className="text-lg font-bold tabular-nums tracking-tight text-[var(--enterprise-text)]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--enterprise-text-muted)]">
        {label}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function ActivityRow({ title, meta, badge }: { title: string; meta: string; badge?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 ">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-snug text-[var(--enterprise-text)]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
          {meta}
        </p>
      </div>
      {badge}
    </div>
  );
}

function QuickNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Package;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="enterprise-card enterprise-card-hover flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition active:scale-[0.98]"
    >
      <span className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {label}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" />
    </Link>
  );
}

export function OmFmDashboardClient({ projectId }: Props) {
  const { primary } = useEnterpriseWorkspace();
  const pBase = primary?.workspace.id
    ? `/workspaces/${primary.workspace.id}/projects/${projectId}`
    : `/projects/${projectId}`;

  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const {
    data: dash,
    isPending,
    error,
  } = useQuery({
    queryKey: qk.omFmDashboard(projectId),
    queryFn: () => fetchOmFmDashboard(projectId),
    enabled: Boolean(session && !session.isExternal && session.operationsMode),
  });

  if (sessionPending) {
    return <EnterpriseLoadingState message="Loading…" label="Loading" />;
  }

  if (!session) {
    return <p className="text-sm text-red-600">Could not load session.</p>;
  }

  if (session.isExternal) {
    return (
      <p className="text-sm text-[var(--enterprise-text-muted)]">
        FM dashboard is available to workspace team members.
      </p>
    );
  }

  if (!session.operationsMode) {
    return (
      <div className={`${OM_PAGE_CLASS} enterprise-card p-4`}>
        <h1 className="text-base font-semibold text-[var(--enterprise-text)]">FM dashboard</h1>
        <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
          Turn on{" "}
          <Link href={`${pBase}/settings`} className="text-[var(--enterprise-primary)] underline">
            Operations mode
          </Link>{" "}
          (Super Admin) to use facility management tools.
        </p>
      </div>
    );
  }

  if (isPending || !dash) {
    if (error) {
      return (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Could not load dashboard."}
        </p>
      );
    }
    return <EnterpriseLoadingState message="Loading FM dashboard…" label="Loading" />;
  }

  const displayName = dash.buildingLabel?.trim() || dash.projectName;
  const since =
    dash.handoverDate ||
    (dash.handoverCompletedAt
      ? new Date(dash.handoverCompletedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null);

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={LayoutGrid}
        title={displayName}
        description={
          since ? (
            <>
              Handover reference:{" "}
              <span className="font-semibold text-[var(--enterprise-text)]">{since}</span>
            </>
          ) : (
            <>
              Complete the{" "}
              <Link
                href={`${pBase}/om/handover`}
                className="font-semibold text-[var(--enterprise-primary)] underline"
              >
                handover wizard
              </Link>{" "}
              to record dates and FM contact.
            </>
          )
        }
        action={
          <>
            <a
              href={omAssetRegisterCsvUrl(projectId)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-bg)]"
            >
              Asset CSV
            </a>
            {session.settings.modules.omTenantPortal &&
            session.settings.modules.omAssets &&
            (session.workspaceRole === "SUPER_ADMIN" || session.workspaceRole === "ADMIN") ? (
              <a
                href={omOccupantAssetQrCsvUrl(projectId)}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-bg)]"
              >
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                QR CSV
              </a>
            ) : null}
            <Link
              href={`${pBase}/om/handover`}
              className={enterpriseButtonClassName({
                variant: "primary",
                size: "sm",
              })}
            >
              Handover
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          </>
        }
      />

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Kpi
            label="Open work orders"
            value={dash.kpis.openWorkOrders}
            tone={dash.kpis.openWorkOrders > 0 ? "amber" : "emerald"}
          />
          <Kpi
            label="Open occupant requests"
            value={dash.kpis.openTenantRequests}
            tone={dash.kpis.openTenantRequests > 0 ? "amber" : "emerald"}
          />
          <Kpi label="WO in progress" value={dash.kpis.inProgressWorkOrders} tone="neutral" />
          <Kpi
            label="Occupant requests in progress"
            value={dash.kpis.inProgressTenantRequests}
            tone="neutral"
          />
          <Kpi
            label="PPM this week"
            value={dash.kpis.maintenanceScheduledThisWeek}
            hint="Scheduled in UTC week"
            tone="neutral"
          />
          <Kpi label="Assets tracked" value={dash.kpis.assetsTracked} tone="neutral" />
          <Kpi
            label="Overdue maintenance"
            value={dash.kpis.overdueMaintenanceTasks}
            tone={dash.kpis.overdueMaintenanceTasks > 0 ? "red" : "emerald"}
          />
          <Kpi
            label="Due soon (30d)"
            value={dash.kpis.maintenanceDueSoon}
            tone={dash.kpis.maintenanceDueSoon > 0 ? "amber" : "emerald"}
          />
          <Kpi
            label="WO backlog >7d"
            value={dash.kpis.workOrderBacklogOver7Days}
            tone={dash.kpis.workOrderBacklogOver7Days > 0 ? "amber" : "emerald"}
          />
          <Kpi
            label="WO backlog >30d"
            value={dash.kpis.workOrderBacklogOver30Days}
            tone={dash.kpis.workOrderBacklogOver30Days > 0 ? "red" : "emerald"}
          />
          <Kpi
            label="PM compliance"
            value={`${dash.kpis.pmCompliancePct}%`}
            hint="Completed on or before due"
            tone={dash.kpis.pmCompliancePct >= 80 ? "emerald" : "amber"}
          />
          <Kpi
            label="Open inspections"
            value={dash.kpis.openInspectionDrafts ?? 0}
            tone={(dash.kpis.openInspectionDrafts ?? 0) > 0 ? "amber" : "emerald"}
          />
          <Kpi
            label="Deficient (30d)"
            value={dash.kpis.deficientInspectionsLast30Days ?? 0}
            tone={(dash.kpis.deficientInspectionsLast30Days ?? 0) > 0 ? "red" : "emerald"}
          />
          <Kpi
            label="Overdue inspection templates"
            value={dash.kpis.overdueInspectionTemplates ?? 0}
            tone={(dash.kpis.overdueInspectionTemplates ?? 0) > 0 ? "red" : "emerald"}
          />
          <div className="enterprise-card col-span-2 rounded-md border-l-4 border-l-emerald-600 p-3 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Building health
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--enterprise-border)]/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-[width] duration-500"
                  style={{ width: `${dash.buildingHealthPct}%` }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums text-[var(--enterprise-text)]">
                {dash.buildingHealthPct}%
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
              Share of assets linked to a drawing (location on sheet).
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-text)]">
              <CalendarRange className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Upcoming maintenance
            </h2>
            <Link
              href={`${pBase}/om/maintenance`}
              className="mobile-touch-target shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--enterprise-primary)]"
            >
              All
            </Link>
          </div>
          {dash.upcomingMaintenanceThisWeek.length === 0 ? (
            <p className="py-4 text-sm text-[var(--enterprise-text-muted)]">
              Nothing due this UTC week.
            </p>
          ) : (
            <ul className="space-y-2">
              {dash.upcomingMaintenanceThisWeek.map((m) => (
                <li key={m.id}>
                  <ActivityRow
                    title={`${m.assetTag} · ${m.title || "Maintenance"}`}
                    meta={`${new Date(m.nextDueAt).toLocaleDateString(undefined, { dateStyle: "medium" })}${m.vendor ? ` · ${m.vendor}` : ""}`}
                    badge={
                      m.health === "overdue" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200/80">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                          Overdue
                        </span>
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-4 sm:p-5">
          <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-text)]">
              <Wrench className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Recent work orders
            </h2>
            <Link
              href={`${pBase}/om/work-orders`}
              className="mobile-touch-target shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--enterprise-primary)]"
            >
              All
            </Link>
          </div>
          {dash.recentWorkOrders.length === 0 ? (
            <p className="py-4 text-sm text-[var(--enterprise-text-muted)]">No work orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {dash.recentWorkOrders.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`${pBase}/om/work-orders?wo=${encodeURIComponent(w.id)}`}
                    className="block transition hover:opacity-90"
                  >
                    <ActivityRow
                      title={w.title}
                      meta={`${ISSUE_STATUS_LABEL[w.status] ?? w.status} · ${w.priority} · ${new Date(w.updatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-text)]">
              <ClipboardCheck className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Recent deficient
            </h2>
            <Link
              href={`${pBase}/om/inspections`}
              className="mobile-touch-target shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--enterprise-primary)]"
            >
              All
            </Link>
          </div>
          {(dash.recentDeficientInspections ?? []).length === 0 ? (
            <p className="py-4 text-sm text-[var(--enterprise-text-muted)]">
              No deficient inspections recently.
            </p>
          ) : (
            <ul className="space-y-2">
              {(dash.recentDeficientInspections ?? []).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`${pBase}/om/inspections`}
                    className="block transition hover:opacity-90"
                  >
                    <ActivityRow
                      title={r.templateName}
                      meta={`Deficient${r.failCount != null ? ` · ${r.failCount} fail` : ""}${
                        r.completedAt
                          ? ` · ${new Date(r.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`
                          : ""
                      }`}
                      badge={
                        <span className="inline-flex items-center rounded-md border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300">
                          Deficient
                        </span>
                      }
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3 lg:col-span-2 xl:col-span-1">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-text)]">
              <Inbox className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Recent occupant requests
            </h2>
            <Link
              href={`${pBase}/om/tenant-requests`}
              className="mobile-touch-target shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--enterprise-primary)]"
            >
              All
            </Link>
          </div>
          {dash.recentTenantRequests.length === 0 ? (
            <p className="py-4 text-sm text-[var(--enterprise-text-muted)]">
              No occupant requests yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {dash.recentTenantRequests.map((w) => (
                <li key={w.id}>
                  <ActivityRow
                    title={w.title}
                    meta={`${ISSUE_STATUS_LABEL[w.status] ?? w.status} · ${w.priority} · ${new Date(w.updatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Quick navigation
        </h2>
        <ul className="space-y-1.5">
          <li>
            <QuickNavLink href={`${pBase}/om/assets`} icon={Package} label="Assets" />
          </li>
          <li>
            <QuickNavLink
              href={`${pBase}/om/inspections`}
              icon={ClipboardList}
              label="Inspections"
            />
          </li>
          <li>
            <QuickNavLink
              href={`${pBase}/om/tenant-requests`}
              icon={Inbox}
              label="Occupant inbox"
            />
          </li>
          <li>
            <QuickNavLink
              href={`${pBase}/om/tenant-portal`}
              icon={Building2}
              label="Occupant hub"
            />
          </li>
          <li>
            <QuickNavLink
              href={`${pBase}/ops/orchestration`}
              icon={LayoutGrid}
              label="Datacenter orchestration"
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
