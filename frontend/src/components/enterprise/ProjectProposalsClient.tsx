"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import { EnterpriseAddPulseWrap } from "@/components/enterprise/EnterpriseAddPulseWrap";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchProposalAnalyticsSummary,
  fetchProposalsList,
  ProRequiredError,
  type ProposalListRow,
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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CHANGE_REQUESTED: "Change requested",
};

const FILTER_KEYS = [
  "ALL",
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CHANGE_REQUESTED",
] as const;

type StatusFilter = (typeof FILTER_KEYS)[number];

const FILTER_LABEL: Record<StatusFilter, string> = {
  ALL: "All",
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CHANGE_REQUESTED: "Change requested",
};

function proposalStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

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

function formatSentDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const isPro = isWorkspaceProClient(primary?.workspace);

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

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

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (!data?.proposals) return m;
    for (const p of data.proposals) {
      m.set(p.status, (m.get(p.status) ?? 0) + 1);
    }
    return m;
  }, [data?.proposals]);

  const filteredProposals = useMemo(() => {
    if (!data?.proposals) return [];
    let rows = data.proposals;
    if (filter !== "ALL") {
      rows = rows.filter((p) => p.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data?.proposals, filter, search]);

  if (ctxLoading || (isPro && !wid)) {
    return <EnterpriseLoadingState label="Loading workspace…" />;
  }

  if (!isPro) {
    return (
      <div className="enterprise-alert-warning p-6 text-sm">
        Proposals require a Pro workspace (active or trial).
      </div>
    );
  }

  if (error instanceof ProRequiredError) {
    return (
      <div className="enterprise-alert-warning p-6 text-sm">
        Proposals require a Pro workspace (active or trial).
      </div>
    );
  }

  if (isError && !(error instanceof ProRequiredError)) {
    return (
      <div className="enterprise-alert-danger p-6 text-sm">
        <p className="font-medium text-[var(--enterprise-semantic-danger-text)]">
          Could not load proposals.
        </p>
        <p className="enterprise-alert-danger-muted mt-2 text-xs">
          {error instanceof Error
            ? error.message
            : "Check that the API is running and try a hard refresh (Cmd+Shift+R)."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--enterprise-primary-deep)]"
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

  const defaultCurrency = data.proposals[0]?.currency ?? "USD";
  const totalCount = data.proposals.length;
  const emptyAfterFilter = totalCount > 0 && filteredProposals.length === 0;
  const completelyEmpty = totalCount === 0;

  const searchFieldClass =
    "mt-1 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet
              className="h-7 w-7 shrink-0 text-[var(--enterprise-primary)] sm:h-8 sm:w-8"
              aria-hidden
            />
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Proposals
            </h1>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            Build priced offers, send a client portal link, and track when they view or respond.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Link
            href={`${base}/templates`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:bg-[var(--enterprise-hover-surface)] sm:min-h-10 sm:rounded-lg sm:px-3 sm:text-xs"
          >
            Templates
          </Link>
          <EnterpriseAddPulseWrap className="w-full sm:w-auto">
            <Link
              href={`${base}/new`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] sm:min-h-10 sm:rounded-lg sm:px-3 sm:text-xs"
            >
              <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={1.75} />
              New proposal
            </Link>
          </EnterpriseAddPulseWrap>
        </div>
      </header>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] lg:mx-0 lg:grid lg:snap-none lg:grid-cols-4 lg:gap-3 lg:overflow-visible lg:pb-0 xl:grid-cols-7">
        <div className="min-w-[10.5rem] shrink-0 snap-start rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)] lg:shrink">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
            Pipeline
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--enterprise-text)]">
            {fmtMoney(data.stats.pipelineTotal, defaultCurrency)}
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

      <div className="space-y-3">
        <label className="block text-xs font-medium text-[var(--enterprise-text-muted)]">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, reference, or client"
            className={searchFieldClass}
            autoComplete="off"
          />
        </label>

        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter by status"
        >
          {FILTER_KEYS.map((key) => {
            const count = key === "ALL" ? totalCount : (statusCounts.get(key) ?? 0);
            const showCount = key === "ALL" || count > 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-lg px-3.5 py-2.5 text-xs font-medium transition sm:py-2 ${
                  filter === key
                    ? "bg-[var(--enterprise-primary)] text-white shadow-sm"
                    : "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                }`}
              >
                {FILTER_LABEL[key]}
                {showCount ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Proposal list">
        {completelyEmpty ? (
          <li className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-12 text-center shadow-[var(--enterprise-shadow-xs)]">
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              No proposals yet. Create one to send a priced offer to your client.
            </p>
            <Link
              href={`${base}/new`}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--enterprise-primary-deep)]"
            >
              New proposal
            </Link>
          </li>
        ) : emptyAfterFilter ? (
          <li className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)]">
            No proposals match this filter or search.
          </li>
        ) : (
          filteredProposals.map((p) => <ProposalCard key={p.id} p={p} base={base} />)
        )}
      </ul>

      <div className="enterprise-card hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[720px] text-left text-sm text-[var(--enterprise-text)]"
            aria-label="Proposals"
          >
            <thead>
              <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {completelyEmpty ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14">
                    <div className="flex flex-col items-center text-center">
                      <p className="text-sm text-[var(--enterprise-text-muted)]">
                        No proposals yet. Create one to send a priced offer to your client.
                      </p>
                      <Link
                        href={`${base}/new`}
                        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--enterprise-primary-deep)]"
                      >
                        New proposal
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : emptyAfterFilter ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-14 text-center text-sm text-[var(--enterprise-text-muted)]"
                  >
                    No proposals match this filter or search.
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--enterprise-border)]/60 transition hover:bg-[var(--enterprise-hover-surface)]/80"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--enterprise-text-muted)]">
                      {String(p.sequenceNumber).padStart(3, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`${base}/${p.id}`}
                        className="font-medium text-[var(--enterprise-primary)] hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
                        <span>{p.reference}</span>
                        {(p.status === "DRAFT" ||
                          p.status === "CHANGE_REQUESTED" ||
                          p.status === "SENT" ||
                          p.status === "VIEWED") && (
                          <Link
                            href={`${base}/${p.id}/edit`}
                            className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--enterprise-text-muted)] transition hover:border-[var(--enterprise-primary)]/30 hover:text-[var(--enterprise-primary)]"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {proposalStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--enterprise-text)]">{p.clientName}</td>
                    <td className="px-4 py-3 text-[var(--enterprise-text-muted)] tabular-nums">
                      {formatSentDate(p.sentAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--enterprise-text)]">
                      {fmtMoney(p.total, p.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[10.5rem] shrink-0 snap-start rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)] lg:min-w-0 lg:shrink">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--enterprise-text)]">
        {value}
      </div>
    </div>
  );
}

function ProposalCard({ p, base }: { p: ProposalListRow; base: string }) {
  const editable =
    p.status === "DRAFT" ||
    p.status === "CHANGE_REQUESTED" ||
    p.status === "SENT" ||
    p.status === "VIEWED";
  return (
    <li>
      <div className="block touch-manipulation rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <Link
          href={`${base}/${p.id}`}
          className="block p-4 transition hover:border-[var(--enterprise-primary)]/25 active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 rounded-md bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
              #{String(p.sequenceNumber).padStart(3, "0")}
            </span>
            <span
              className={`inline-flex max-w-[65%] shrink-0 rounded-full px-2.5 py-0.5 text-right text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-700"}`}
            >
              {proposalStatusLabel(p.status)}
            </span>
          </div>
          <p className="mt-2 text-base font-semibold leading-snug text-[var(--enterprise-text)]">
            {p.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">{p.reference}</p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--enterprise-text-muted)] sm:grid-cols-3">
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">Client</dt>
              <dd className="min-w-0 truncate">{p.clientName}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">Sent</dt>
              <dd className="tabular-nums">{formatSentDate(p.sentAt)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-[var(--enterprise-text)]/70">Value</dt>
              <dd className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                {fmtMoney(p.total, p.currency)}
              </dd>
            </div>
          </dl>
        </Link>
        {editable && (
          <div className="flex border-t border-[var(--enterprise-border)]/60 px-4 py-2">
            <Link
              href={`${base}/${p.id}/edit`}
              className="text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
            >
              Edit in editor →
            </Link>
          </div>
        )}
      </div>
    </li>
  );
}
