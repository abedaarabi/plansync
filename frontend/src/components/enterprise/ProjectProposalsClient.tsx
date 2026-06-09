"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  FileSpreadsheet,
  Inbox,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { EnterpriseAddPulseWrap } from "@/components/enterprise/EnterpriseAddPulseWrap";
import { EnterpriseFab } from "@/components/mobile/EnterpriseFab";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchProposalAnalyticsSummary,
  fetchProposalsList,
  ProRequiredError,
  type ProposalListRow,
} from "@/lib/api-client";
import { proposalStatusBadgeClass, proposalStatusLabel } from "@/lib/proposalStatus";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

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
  }, [data]);

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
  }, [data, filter, search]);

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
  const awaitingResponse =
    (statusCounts.get("SENT") ?? 0) +
    (statusCounts.get("VIEWED") ?? 0) +
    (statusCounts.get("CHANGE_REQUESTED") ?? 0);

  return (
    <div className="mobile-app-page w-full min-w-0 max-w-full space-y-6 sm:space-y-8 lg:mx-auto lg:max-w-6xl">
      <header className="enterprise-card flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" />
            Proposals
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--enterprise-text)] sm:text-[1.75rem]">
            {totalCount} Proposal{totalCount === 1 ? "" : "s"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--enterprise-text-muted)]">
            Build priced offers, send a client portal link, and track when they view or respond.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <Link
            href={`${base}/templates`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-4 text-sm font-semibold text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-hover-surface)] sm:min-h-10"
          >
            Templates
          </Link>
          <EnterpriseAddPulseWrap className="w-full sm:w-auto">
            <Link
              href={`${base}/new`}
              className="hidden h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-[var(--enterprise-shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--enterprise-primary)_30%,transparent)] transition hover:bg-[var(--enterprise-primary-deep)] lg:inline-flex lg:w-auto"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New proposal
            </Link>
          </EnterpriseAddPulseWrap>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="enterprise-card relative overflow-hidden p-5 sm:col-span-2 xl:col-span-2">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--enterprise-primary-soft)] via-transparent to-transparent opacity-80"
            aria-hidden
          />
          <div className="relative">
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
              Pipeline value
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              {fmtMoney(data.stats.pipelineTotal, defaultCurrency)}
            </p>
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              Total value of active proposals awaiting client decision
            </p>
          </div>
        </article>
        <MetricCard
          icon={Inbox}
          label="Awaiting response"
          value={String(awaitingResponse)}
          hint={`${data.stats.sent} sent · ${statusCounts.get("VIEWED") ?? 0} viewed`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Win rate"
          value={
            analytics?.winRate != null
              ? `${Math.round(analytics.winRate * 100)}%`
              : analytics
                ? "—"
                : "…"
          }
          hint={`${data.stats.accepted} accepted · ${data.stats.declined} declined`}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CompactStat label="Accepted" value={String(data.stats.accepted)} />
        <CompactStat label="Draft" value={String(data.stats.draft)} />
        <CompactStat label="Declined" value={String(data.stats.declined)} />
        <CompactStat
          label="Total"
          value={analytics != null ? String(analytics.totalProposals) : "…"}
        />
      </section>

      <section className="enterprise-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md" htmlFor="proposal-search">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
              aria-hidden
            />
            <input
              id="proposal-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, reference, or client"
              className="h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] pl-9 pr-3 text-sm text-[var(--enterprise-text)] outline-none transition placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:bg-[var(--enterprise-surface)] focus:shadow-[var(--enterprise-shadow-sm)]"
              autoComplete="off"
            />
          </label>
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            Showing{" "}
            <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
              {filteredProposals.length}
            </span>{" "}
            of {totalCount}
          </p>
        </div>

        <div
          className="mobile-chip-scroll -mx-1 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  filter === key
                    ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-1 ring-[color-mix(in_srgb,var(--enterprise-primary)_25%,transparent)]"
                    : "border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                }`}
              >
                {FILTER_LABEL[key]}
                {showCount ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </section>

      <ul className="space-y-3 md:hidden" aria-label="Proposal list">
        {completelyEmpty ? (
          <EmptyProposalsState base={base} />
        ) : emptyAfterFilter ? (
          <li className="enterprise-card px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)]">
            No proposals match this filter or search.
          </li>
        ) : (
          filteredProposals.map((p) => <ProposalCard key={p.id} p={p} base={base} />)
        )}
      </ul>

      <section className="enterprise-card hidden overflow-hidden md:block">
        {completelyEmpty ? (
          <div className="px-6 py-14">
            <EmptyProposalsState base={base} />
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[72px_minmax(200px,2fr)_120px_minmax(120px,1fr)_100px_120px] gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)] lg:grid">
              <span>#</span>
              <span>Proposal</span>
              <span>Status</span>
              <span>Client</span>
              <span>Sent</span>
              <span className="text-right">Value</span>
            </div>
            <div className="divide-y divide-[var(--enterprise-border)]">
              {emptyAfterFilter ? (
                <p className="px-6 py-14 text-center text-sm text-[var(--enterprise-text-muted)]">
                  No proposals match this filter or search.
                </p>
              ) : (
                filteredProposals.map((p) => <ProposalTableRow key={p.id} p={p} base={base} />)
              )}
            </div>
          </>
        )}
      </section>

      <EnterpriseFab
        label="New proposal"
        icon={<Plus className="h-7 w-7" strokeWidth={2} aria-hidden />}
        onClick={() => {
          window.location.href = `${base}/new`;
        }}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="enterprise-card flex items-start gap-3 p-4 sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--enterprise-text-muted)]">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">{hint}</p>
        ) : null}
      </div>
    </article>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 shadow-[var(--enterprise-shadow-xs)]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-[var(--enterprise-text)]">
        {value}
      </p>
    </div>
  );
}

function EmptyProposalsState({ base }: { base: string }) {
  return (
    <li className="enterprise-card flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
        <FileSpreadsheet className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--enterprise-text)]">No proposals yet</p>
      <p className="mt-1 max-w-sm text-sm text-[var(--enterprise-text-muted)]">
        Create a proposal to send a priced offer to your client and track their response.
      </p>
      <Link
        href={`${base}/new`}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)]"
      >
        <Plus className="h-4 w-4" />
        New proposal
      </Link>
    </li>
  );
}

function ProposalTableRow({ p, base }: { p: ProposalListRow; base: string }) {
  const editable =
    p.status === "DRAFT" ||
    p.status === "CHANGE_REQUESTED" ||
    p.status === "SENT" ||
    p.status === "VIEWED";

  return (
    <div className="group grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-[var(--enterprise-hover-surface)]/60 lg:grid-cols-[72px_minmax(200px,2fr)_120px_minmax(120px,1fr)_100px_120px] lg:items-center lg:gap-3">
      <span className="font-mono text-xs tabular-nums text-[var(--enterprise-text-muted)] lg:px-1">
        {String(p.sequenceNumber).padStart(3, "0")}
      </span>
      <div className="min-w-0 lg:px-1">
        <Link
          href={`${base}/${p.id}`}
          className="inline-flex items-center gap-1 font-medium text-[var(--enterprise-text)] transition group-hover:text-[var(--enterprise-primary)]"
        >
          <span className="truncate">{p.title}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <span>{p.reference}</span>
          {editable ? (
            <Link
              href={`${base}/${p.id}/edit`}
              className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-text-muted)] transition hover:border-[var(--enterprise-primary)]/30 hover:text-[var(--enterprise-primary)]"
            >
              Edit
            </Link>
          ) : null}
        </div>
      </div>
      <div className="lg:px-1">
        <span className={proposalStatusBadgeClass(p.status)}>{proposalStatusLabel(p.status)}</span>
      </div>
      <span className="truncate text-sm text-[var(--enterprise-text)] lg:px-1">{p.clientName}</span>
      <span className="text-sm tabular-nums text-[var(--enterprise-text-muted)] lg:px-1">
        {formatSentDate(p.sentAt)}
      </span>
      <span className="text-right text-sm font-semibold tabular-nums text-[var(--enterprise-text)] lg:px-1">
        {fmtMoney(p.total, p.currency)}
      </span>
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
      <div className="enterprise-card enterprise-card-hover overflow-hidden">
        <Link
          href={`${base}/${p.id}`}
          className="block touch-manipulation p-4 transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
              #{String(p.sequenceNumber).padStart(3, "0")}
            </span>
            <span className={proposalStatusBadgeClass(p.status)}>
              {proposalStatusLabel(p.status)}
            </span>
          </div>
          <p className="mt-3 text-base font-semibold leading-snug text-[var(--enterprise-text)]">
            {p.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">{p.reference}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="font-medium text-[var(--enterprise-text-muted)]">Client</dt>
              <dd className="mt-0.5 truncate font-medium text-[var(--enterprise-text)]">
                {p.clientName}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--enterprise-text-muted)]">Sent</dt>
              <dd className="mt-0.5 tabular-nums text-[var(--enterprise-text)]">
                {formatSentDate(p.sentAt)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="font-medium text-[var(--enterprise-text-muted)]">Value</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--enterprise-text)]">
                {fmtMoney(p.total, p.currency)}
              </dd>
            </div>
          </dl>
        </Link>
        {editable ? (
          <div className="flex items-center justify-between border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-4 py-2.5">
            <Link
              href={`${base}/${p.id}/edit`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)]"
            >
              Edit in editor
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}
