"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronRight,
  FileSpreadsheet,
  FolderKanban,
  Inbox,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import {
  fetchProjects,
  fetchProposalsList,
  ProRequiredError,
  type ProposalListRow,
} from "@/lib/api-client";
import {
  proposalStatusBadgeClass,
  proposalStatusColor,
  proposalStatusLabel,
} from "@/lib/proposalStatus";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";
import { PlanUpgradeCallout } from "@/components/enterprise/PlanUpgradeCallout";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";

const STATUS_ORDER = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "CHANGE_REQUESTED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

function fmtMoney(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ProposalWithProject = ProposalListRow & { projectId: string; projectName: string };

// fallow-ignore-next-line complexity
export function ProposalsDashboardClient() {
  const { primary, loading } = useEnterpriseWorkspace();
  const workspace = primary?.workspace;
  const workspaceId = workspace?.id;
  const workspaceRole = primary?.role;
  const isProPlus = isWorkspaceProPlusClient(workspace);
  const canView = workspaceRole === "ADMIN" || workspaceRole === "SUPER_ADMIN";

  const projectsQuery = useQuery({
    queryKey: qk.projects(workspaceId ?? ""),
    queryFn: () => fetchProjects(workspaceId!),
    enabled: Boolean(workspaceId && isProPlus && canView),
  });

  const proposalQueries = useQueries({
    queries: (projectsQuery.data ?? []).map((project) => ({
      queryKey: qk.projectProposals(project.id),
      queryFn: () => fetchProposalsList(project.id),
      enabled: Boolean(workspaceId && isProPlus && canView),
      staleTime: 60_000,
    })),
  });

  const firstProposalError = proposalQueries.find((q) => q.error)?.error;
  const hasProposalError = Boolean(firstProposalError);
  const proposalsPending = proposalQueries.some((q) => q.isPending);

  const aggregate = useMemo(() => {
    const statusCounts = new Map<string, number>();
    const byCurrency = new Map<string, number>();
    const byProject: Array<{
      projectId: string;
      projectName: string;
      total: number;
      accepted: number;
      pending: number;
      declined: number;
    }> = [];
    const recent: ProposalWithProject[] = [];
    let total = 0;
    let projectsWithProposals = 0;

    (projectsQuery.data ?? []).forEach((project, idx) => {
      const rows = proposalQueries[idx]?.data?.proposals ?? [];
      if (rows.length > 0) projectsWithProposals += 1;
      total += rows.length;
      let accepted = 0;
      let pending = 0;
      let declined = 0;

      for (const proposal of rows) {
        statusCounts.set(proposal.status, (statusCounts.get(proposal.status) ?? 0) + 1);
        const numericTotal = Number(proposal.total);
        if (Number.isFinite(numericTotal)) {
          byCurrency.set(
            proposal.currency,
            (byCurrency.get(proposal.currency) ?? 0) + numericTotal,
          );
        }
        if (proposal.status === "ACCEPTED") accepted += 1;
        if (
          proposal.status === "SENT" ||
          proposal.status === "VIEWED" ||
          proposal.status === "CHANGE_REQUESTED"
        ) {
          pending += 1;
        }
        if (proposal.status === "DECLINED") declined += 1;
        recent.push({ ...proposal, projectId: project.id, projectName: project.name });
      }

      byProject.push({
        projectId: project.id,
        projectName: project.name,
        total: rows.length,
        accepted,
        pending,
        declined,
      });
    });

    recent.sort((a, b) => {
      const aTime = new Date(a.sentAt ?? a.createdAt).getTime();
      const bTime = new Date(b.sentAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    byProject.sort((a, b) => b.total - a.total);

    const accepted = statusCounts.get("ACCEPTED") ?? 0;
    const declined = statusCounts.get("DECLINED") ?? 0;
    const winRate =
      accepted + declined > 0 ? Math.round((accepted / (accepted + declined)) * 100) : null;

    return {
      total,
      projectsWithProposals,
      statusCounts,
      byCurrency,
      byProject,
      recent,
      winRate,
    };
  }, [projectsQuery.data, proposalQueries]);

  if (loading) return <EnterpriseLoadingState label="Loading workspace…" />;

  if (!workspaceId) {
    return <div className="enterprise-alert-warning p-6 text-sm">Select a workspace first.</div>;
  }

  if (!canView) {
    return (
      <div className="enterprise-alert-warning p-6 text-sm">
        Only workspace admins can view the proposals dashboard.
      </div>
    );
  }

  if (!isProPlus) {
    return <PlanUpgradeCallout feature="Proposals" />;
  }

  if (projectsQuery.isPending || proposalsPending) {
    return <EnterpriseLoadingState label="Loading proposals dashboard…" />;
  }

  if (projectsQuery.isError || hasProposalError) {
    const err = projectsQuery.error ?? firstProposalError;
    if (err instanceof ProRequiredError) {
      return <PlanUpgradeCallout feature="Proposals" />;
    }
    return (
      <div className="enterprise-alert-danger p-6 text-sm">
        {err instanceof Error ? err.message : "Could not load proposals dashboard."}
      </div>
    );
  }

  const totalProjects = projectsQuery.data?.length ?? 0;
  const pendingReview =
    (aggregate.statusCounts.get("SENT") ?? 0) +
    (aggregate.statusCounts.get("VIEWED") ?? 0) +
    (aggregate.statusCounts.get("CHANGE_REQUESTED") ?? 0);
  const topCurrencies = Array.from(aggregate.byCurrency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const weightedPipelineTotal = topCurrencies.reduce((sum, [, amount]) => sum + amount, 0);
  const topProjects = aggregate.byProject.slice(0, 6);
  const recentRows = aggregate.recent.slice(0, 10);
  const statusChartRows = STATUS_ORDER.map((status) => ({
    status,
    label: proposalStatusLabel(status),
    count: aggregate.statusCounts.get(status) ?? 0,
  })).filter((row) => row.count > 0);
  const funnelSteps = [
    { key: "DRAFT", label: "Draft", count: aggregate.statusCounts.get("DRAFT") ?? 0 },
    { key: "SENT", label: "Sent", count: aggregate.statusCounts.get("SENT") ?? 0 },
    { key: "VIEWED", label: "Viewed", count: aggregate.statusCounts.get("VIEWED") ?? 0 },
    { key: "ACCEPTED", label: "Accepted", count: aggregate.statusCounts.get("ACCEPTED") ?? 0 },
  ];

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={BarChart3}
        title="Proposals dashboard"
        description="Monitor pipeline, status, and conversion trends across all projects in your workspace."
      >
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Est. pipeline
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
              {weightedPipelineTotal > 0
                ? fmtMoney(weightedPipelineTotal, topCurrencies[0]?.[0] ?? "USD")
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Active projects
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
              {aggregate.projectsWithProposals}
              <span className="text-[var(--enterprise-text-muted)]"> / {totalProjects}</span>
            </p>
          </div>
        </div>
      </OmSubPageHeader>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FolderKanban} label="Total proposals" value={String(aggregate.total)} />
        <MetricCard icon={Inbox} label="Pending review" value={String(pendingReview)} />
        <MetricCard
          icon={TrendingUp}
          label="Win rate"
          value={aggregate.winRate == null ? "—" : `${aggregate.winRate}%`}
        />
        <MetricCard
          icon={BarChart3}
          label="Projects with proposals"
          value={`${aggregate.projectsWithProposals}/${totalProjects}`}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-12">
        <div className="enterprise-card p-3 sm:p-4 xl:col-span-7">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Status breakdown</h2>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
            Distribution of proposals by current status
          </p>
          <DonutStatusChart
            rows={statusChartRows}
            total={aggregate.total}
            emptyLabel="No proposal activity yet."
          />
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {topCurrencies.map(([currency, amount]) => (
              <div
                key={currency}
                className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-3"
              >
                <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                  Pipeline ({currency})
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {fmtMoney(amount, currency)}
                </p>
              </div>
            ))}
            {topCurrencies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-3 text-sm text-[var(--enterprise-text-muted)] sm:col-span-3">
                Pipeline values will appear once proposals are created.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 xl:col-span-5">
          <div className="enterprise-card p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Top projects</h2>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              Projects with the most proposal activity
            </p>
            <div className="mt-4 space-y-2">
              {topProjects.map((project) => {
                const href = `/projects/${project.projectId}/proposals`;
                return (
                  <Link
                    key={project.projectId}
                    href={href}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-3 transition hover:border-[color-mix(in_srgb,var(--enterprise-primary)_30%,var(--enterprise-border))] hover:bg-[var(--enterprise-hover-surface)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                        {project.projectName}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                        {project.pending} pending · {project.accepted} accepted · {project.declined}{" "}
                        declined
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                      {project.total}
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--enterprise-text-muted)] opacity-0 transition group-hover:opacity-100" />
                    </span>
                  </Link>
                );
              })}
              {topProjects.length === 0 ? (
                <p className="text-sm text-[var(--enterprise-text-muted)]">
                  No project proposal data yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="enterprise-card p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
              Conversion funnel
            </h2>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              Draft through accepted progression
            </p>
            <ProposalFunnelChart steps={funnelSteps} />
          </div>
        </div>
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-[var(--enterprise-border)] px-3 py-3 sm:px-4">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Latest proposals</h2>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
            Most recently sent or created across your workspace
          </p>
        </div>

        <ul className="divide-y divide-[var(--enterprise-border)] md:hidden">
          {recentRows.length === 0 ? (
            <li className="p-4">
              <OmEmptyState
                icon={FileSpreadsheet}
                title="No proposals yet"
                description="Create a proposal in any project to see it here across your workspace."
              />
            </li>
          ) : (
            recentRows.map((proposal) => (
              <li key={proposal.id}>
                <Link
                  href={`/projects/${proposal.projectId}/proposals/${proposal.id}`}
                  className="flex items-start justify-between gap-3 px-5 py-4 transition hover:bg-[var(--enterprise-hover-surface)]/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                      {proposal.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
                      {proposal.reference} · {proposal.projectName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={proposalStatusBadgeClass(proposal.status)}>
                        {proposalStatusLabel(proposal.status)}
                      </span>
                      <span className="text-xs text-[var(--enterprise-text-muted)]">
                        {formatDate(proposal.sentAt ?? proposal.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                    {fmtMoney(Number(proposal.total), proposal.currency)}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--enterprise-bg)]/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
              <tr>
                <th className="px-5 py-3 sm:px-6">Proposal</th>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right sm:px-6">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--enterprise-border)]">
              {recentRows.map((proposal) => (
                <tr
                  key={proposal.id}
                  className="transition hover:bg-[var(--enterprise-hover-surface)]/60"
                >
                  <td className="px-5 py-3 sm:px-6">
                    <Link
                      href={`/projects/${proposal.projectId}/proposals/${proposal.id}`}
                      className="font-medium text-[var(--enterprise-text)] transition hover:text-[var(--enterprise-primary)]"
                    >
                      {proposal.reference}
                    </Link>
                    <p className="truncate text-xs text-[var(--enterprise-text-muted)]">
                      {proposal.title}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-[var(--enterprise-text)]">
                    {proposal.projectName}
                  </td>
                  <td className="px-5 py-3 text-[var(--enterprise-text)]">{proposal.clientName}</td>
                  <td className="px-5 py-3">
                    <span className={proposalStatusBadgeClass(proposal.status)}>
                      {proposalStatusLabel(proposal.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[var(--enterprise-text-muted)]">
                    {formatDate(proposal.sentAt ?? proposal.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-[var(--enterprise-text)] sm:px-6">
                    {fmtMoney(Number(proposal.total), proposal.currency)}
                  </td>
                </tr>
              ))}
              {recentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 sm:px-6">
                    <OmEmptyState
                      icon={FileSpreadsheet}
                      title="No proposals yet"
                      description="Create a proposal in any project to see it here across your workspace."
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DonutStatusChart({
  rows,
  total,
  emptyLabel,
}: {
  rows: { status: string; label: string; count: number }[];
  total: number;
  emptyLabel: string;
}) {
  if (rows.length === 0 || total <= 0) {
    return <p className="mt-4 text-sm text-[var(--enterprise-text-muted)]">{emptyLabel}</p>;
  }

  const size = 220;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rowsWithPct = rows
    .map((row) => ({ ...row, pct: Math.round((row.count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
  const segments = rowsWithPct.reduce<
    {
      status: string;
      label: string;
      count: number;
      pct: number;
      dasharray: string;
      dashoffset: number;
    }[]
  >((acc, row) => {
    const usedLength = acc.reduce((sum, item) => sum + Number(item.dasharray.split(" ")[0]), 0);
    const segmentLength = (row.count / total) * circumference;
    acc.push({
      ...row,
      dasharray: `${segmentLength} ${Math.max(circumference - segmentLength, 0)}`,
      dashoffset: -usedLength,
    });
    return acc;
  }, []);

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[240px,1fr] lg:items-center">
      <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--enterprise-border)"
            strokeWidth={stroke}
          />
          {segments.map((segment) => (
            <circle
              key={segment.status}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={segment.dasharray}
              strokeDashoffset={segment.dashoffset}
              stroke={proposalStatusColor(segment.status)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute text-center">
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Total</p>
          <p className="text-3xl font-semibold tabular-nums text-[var(--enterprise-text)]">
            {total}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {rowsWithPct.map((row) => (
          <div
            key={row.status}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2"
          >
            <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--enterprise-text)]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: proposalStatusColor(row.status) }}
              />
              {row.label}
            </span>
            <span className="text-xs tabular-nums text-[var(--enterprise-text-muted)]">
              {row.count} ({row.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalFunnelChart({
  steps,
}: {
  steps: { key: string; label: string; count: number }[];
}) {
  const maxCount = Math.max(...steps.map((step) => step.count), 1);

  return (
    <div className="mt-4 space-y-3">
      {steps.map((step, idx) => {
        const width = Math.max(8, Math.round((step.count / maxCount) * 100));
        const prev = idx > 0 ? steps[idx - 1] : null;
        const conversion =
          prev && prev.count > 0 ? Math.round((step.count / prev.count) * 100) : null;
        return (
          <div key={step.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-[var(--enterprise-text)]">{step.label}</span>
              <span className="tabular-nums text-[var(--enterprise-text-muted)]">
                {step.count}
                {conversion != null ? ` · ${conversion}% from ${prev?.label}` : ""}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--enterprise-bg)]">
              <div
                className="h-full rounded-full bg-[var(--enterprise-primary)] transition-[width] duration-200"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string;
}) {
  return (
    <article className="enterprise-card flex items-center gap-3 p-3 sm:p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--enterprise-text-muted)]">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
          {value}
        </p>
      </div>
    </article>
  );
}
