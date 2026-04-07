"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarRange,
  ClipboardList,
  LayoutGrid,
  Package,
  Wrench,
} from "lucide-react";
import { fetchOmFmDashboard, fetchProjectSession, omAssetRegisterCsvUrl } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

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
    <div className={`enterprise-card border-l-4 p-4 ${border}`}>
      <p className="text-2xl font-semibold tabular-nums text-[var(--enterprise-text)]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--enterprise-text-muted)]">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function OmFmDashboardClient({ projectId }: Props) {
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
      <div className="enterprise-card p-6">
        <h1 className="text-lg font-semibold text-[var(--enterprise-text)]">FM dashboard</h1>
        <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
          Turn on{" "}
          <Link
            href={`/projects/${projectId}/settings`}
            className="text-[var(--enterprise-primary)] underline"
          >
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
    <div className="space-y-8">
      <header className="overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-gradient-to-b from-[var(--enterprise-surface)] to-[var(--enterprise-bg)]/90 p-5 shadow-[var(--enterprise-shadow-card)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]"
              aria-hidden
            >
              <LayoutGrid
                className="h-6 w-6 text-[var(--enterprise-primary)] sm:h-7 sm:w-7"
                strokeWidth={1.5}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                Facility management
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
                {displayName}
              </h1>
              {since ? (
                <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                  Handover reference:{" "}
                  <span className="font-medium text-[var(--enterprise-text)]">{since}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                  Complete the{" "}
                  <Link
                    href={`/projects/${projectId}/om/handover`}
                    className="font-medium text-[var(--enterprise-primary)] underline"
                  >
                    handover wizard
                  </Link>{" "}
                  to record dates and FM contact.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={omAssetRegisterCsvUrl(projectId)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-medium text-[var(--enterprise-text)] shadow-sm hover:bg-[var(--enterprise-bg)]"
            >
              Download asset register (CSV)
            </a>
            <Link
              href={`/projects/${projectId}/om/handover`}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white"
            >
              Handover hub
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Open work orders"
            value={dash.kpis.openWorkOrders}
            tone={dash.kpis.openWorkOrders > 0 ? "amber" : "emerald"}
          />
          <Kpi label="In progress" value={dash.kpis.inProgressWorkOrders} tone="neutral" />
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
          <div className="enterprise-card col-span-2 border-l-4 border-l-emerald-600 p-4 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Building health
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--enterprise-border)]/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500"
                  style={{ width: `${dash.buildingHealthPct}%` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                {dash.buildingHealthPct}%
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              Share of assets linked to a drawing (location on sheet).
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-text)]">
              <CalendarRange className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Upcoming maintenance (this week)
            </h2>
            <Link
              href={`/projects/${projectId}/om/maintenance`}
              className="text-xs font-semibold text-[var(--enterprise-primary)] underline"
            >
              All schedules
            </Link>
          </div>
          {dash.upcomingMaintenanceThisWeek.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Nothing due this UTC week.
            </p>
          ) : (
            <ul className="space-y-2">
              {dash.upcomingMaintenanceThisWeek.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 font-medium text-[var(--enterprise-text)]">
                    {m.assetTag} · {m.title || "Maintenance"}
                  </span>
                  <span className="text-xs text-[var(--enterprise-text-muted)]">
                    {new Date(m.nextDueAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    {m.vendor ? ` · ${m.vendor}` : ""}
                  </span>
                  {m.health === "overdue" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      Overdue
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-text)]">
              <Wrench className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Recent work orders
            </h2>
            <Link
              href={`/projects/${projectId}/om/work-orders`}
              className="text-xs font-semibold text-[var(--enterprise-primary)] underline"
            >
              Open list
            </Link>
          </div>
          {dash.recentWorkOrders.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">No work orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {dash.recentWorkOrders.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2"
                >
                  <p className="text-sm font-medium text-[var(--enterprise-text)]">{w.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                    {w.status.replace(/_/g, " ")} · {w.priority} ·{" "}
                    {new Date(w.updatedAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-wrap gap-3">
        <Link
          href={`/projects/${projectId}/om/assets`}
          className="enterprise-card enterprise-card-hover inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--enterprise-text)]"
        >
          <Package className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
          Assets
        </Link>
        <Link
          href={`/projects/${projectId}/om/inspections`}
          className="enterprise-card enterprise-card-hover inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--enterprise-text)]"
        >
          <ClipboardList className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
          Inspections
        </Link>
        <Link
          href={`/projects/${projectId}/om/tenant-portal`}
          className="enterprise-card enterprise-card-hover inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--enterprise-text)]"
        >
          <Building2 className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
          Tenant portal
        </Link>
      </section>
    </div>
  );
}
