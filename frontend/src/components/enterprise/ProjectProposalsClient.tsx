"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchProposalAnalyticsSummary,
  fetchProposalsList,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-violet-100 text-violet-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-red-100 text-red-800",
  EXPIRED: "bg-orange-100 text-orange-800",
  CHANGE_REQUESTED: "bg-amber-100 text-amber-900",
};

function fmtMoney(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function ProjectProposalsClient({
  projectId,
  workspaceId: _workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}) {
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace.subscriptionStatus);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.projectProposals(projectId),
    queryFn: () => fetchProposalsList(projectId),
    enabled: Boolean(wid && isPro),
  });

  const { data: analytics } = useQuery({
    queryKey: qk.projectProposalAnalytics(projectId),
    queryFn: () => fetchProposalAnalyticsSummary(projectId),
    enabled: Boolean(wid && isPro),
  });

  if (ctxLoading || (isPro && !wid)) {
    return <EnterpriseLoadingState label="Loading workspace…" />;
  }

  if (!isPro) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Proposals require a Pro workspace (active or trial).
      </div>
    );
  }

  if (error instanceof ProRequiredError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Proposals require a Pro workspace (active or trial).
      </div>
    );
  }

  if (isError && !(error instanceof ProRequiredError)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/90 p-6 text-red-900">
        <p className="font-medium">Could not load proposals.</p>
        <p className="mt-2 text-sm opacity-90">
          {error instanceof Error
            ? error.message
            : "Check that the API is running and try a hard refresh (Cmd+Shift+R)."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isPending || !data) {
    return <EnterpriseLoadingState label="Loading proposals…" />;
  }

  const base = _workspaceId
    ? `/workspaces/${_workspaceId}/projects/${projectId}/proposals`
    : `/projects/${projectId}/proposals`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-[var(--enterprise-primary)]" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-[#0F172A]">Proposals</h1>
        </div>
        <Link
          href={`${base}/new`}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          New proposal
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pipeline
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-[#0F172A]">
            {fmtMoney(data.stats.pipelineTotal, data.proposals[0]?.currency ?? "USD")}
          </div>
        </div>
        <StatCard label="Accepted" value={String(data.stats.accepted)} />
        <StatCard label="Sent" value={String(data.stats.sent)} />
        <StatCard label="Draft" value={String(data.stats.draft)} />
        <StatCard label="Declined" value={String(data.stats.declined)} />
        <StatCard
          label="Win rate"
          value={
            analytics?.winRate != null
              ? `${Math.round(analytics.winRate * 100)}%`
              : analytics
                ? "—"
                : "…"
          }
        />
        <StatCard
          label="Total proposals"
          value={analytics != null ? String(analytics.totalProposals) : "…"}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.proposals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No proposals yet. Create one to send a priced offer to your client.
                  </td>
                </tr>
              ) : (
                data.proposals.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {String(p.sequenceNumber).padStart(3, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`${base}/${p.id}`}
                        className="font-medium text-[#2563EB] hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="text-xs text-slate-500">{p.reference}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.clientName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.sentAt
                        ? new Date(p.sentAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {fmtMoney(p.total, p.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href={`${base}/templates`}
          className="text-sm font-medium text-[#2563EB] hover:underline"
        >
          Proposal templates
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-[#0F172A]">{value}</div>
    </div>
  );
}
