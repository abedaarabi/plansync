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
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { ProposalsOverview } from "@/components/enterprise/ProposalsOverview";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchProposalAnalyticsSummary,
  fetchProposalsList,
  ProRequiredError,
  type ProposalListRow,
} from "@/lib/api-client";
import { proposalStatusBadgeClass, proposalStatusLabel } from "@/lib/proposalStatus";
import {
  proposalMatchesOverviewFilter,
  type ProposalsOverviewFilter,
} from "@/lib/proposalsOverviewStats";
import {
  OM_COMPACT_CHIP_ACTIVE,
  OM_COMPACT_CHIP_IDLE,
  OM_COMPACT_INPUT,
  OM_PAGE_CLASS,
} from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";
import { PlanUpgradeCallout } from "@/components/enterprise/PlanUpgradeCallout";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
import { useProjectCurrency } from "@/hooks/useProjectCurrency";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { formatProjectMoney } from "@/lib/projectCurrency";

const FILTER_KEYS = [
  "ALL",
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CHANGE_REQUESTED",
  "EXPIRING",
] as const satisfies readonly ProposalsOverviewFilter[];

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
  EXPIRING: "Expiring",
};

function fmtMoney(amount: string, currency: string) {
  return formatProjectMoney(amount, currency);
}

function formatSentDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function filterCount(key: StatusFilter, proposals: ProposalListRow[], nowMs: number): number {
  if (key === "ALL") return proposals.length;
  return proposals.filter((p) => proposalMatchesOverviewFilter(p, key, nowMs)).length;
}

// fallow-ignore-next-line complexity
export function ProjectProposalsClient({
  projectId,
  workspaceId: _workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}) {
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProPlusClient(primary?.workspace);
  const { currency: projectCurrency } = useProjectCurrency(projectId);
  const nowMs = useTickNowMs();

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

  const onOverviewFilterChange = (key: ProposalsOverviewFilter) => {
    setFilter(key);
  };

  const onStatusChipChange = (key: StatusFilter) => {
    setFilter(key);
  };

  const clearFilters = () => {
    setFilter("ALL");
    setSearch("");
  };

  const filteredProposals = useMemo(() => {
    if (!data?.proposals) return [];
    let rows = data.proposals.filter((p) => proposalMatchesOverviewFilter(p, filter, nowMs));
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
  }, [data, filter, search, nowMs]);

  if (ctxLoading || (isPro && !wid)) {
    return <EnterpriseLoadingState label="Loading workspace…" />;
  }

  if (!isPro) {
    return <PlanUpgradeCallout feature="Proposals" />;
  }

  if (error instanceof ProRequiredError) {
    return <PlanUpgradeCallout feature="Proposals" />;
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
        <EnterpriseButton size="sm" className="mt-4" onClick={() => void refetch()}>
          Try again
        </EnterpriseButton>
      </div>
    );
  }

  if (isPending || !data) {
    return <EnterpriseLoadingState label="Loading proposals…" />;
  }

  const base = _workspaceId
    ? `/workspaces/${_workspaceId}/projects/${projectId}/proposals`
    : `/projects/${projectId}/proposals`;

  const defaultCurrency = data.proposals[0]?.currency ?? projectCurrency;
  const totalCount = data.proposals.length;
  const emptyAfterFilter = totalCount > 0 && filteredProposals.length === 0;
  const completelyEmpty = totalCount === 0;
  const awaitingResponse =
    filterCount("SENT", data.proposals, nowMs) +
    filterCount("VIEWED", data.proposals, nowMs) +
    filterCount("CHANGE_REQUESTED", data.proposals, nowMs);

  return (
    <div className={`${OM_PAGE_CLASS} w-full min-w-0 max-w-full`}>
      <OmSubPageHeader
        icon={FileSpreadsheet}
        title={`${totalCount} Proposal${totalCount === 1 ? "" : "s"}`}
        description="Build priced offers, send a client portal link, and track when they view or respond."
        action={
          <>
            <Link
              href={`${base}/templates`}
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Templates
            </Link>
            <EnterpriseButton
              size="sm"
              onClick={() => {
                window.location.href = `${base}/new`;
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New proposal
            </EnterpriseButton>
          </>
        }
      />

      <ProposalsOverview
        rows={data.proposals}
        filter={filter}
        onFilterChange={onOverviewFilterChange}
      />

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <article className="enterprise-card relative overflow-hidden p-3 sm:col-span-2 xl:col-span-2">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--enterprise-primary-soft)] via-transparent to-transparent opacity-80"
            aria-hidden
          />
          <div className="relative">
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
              Pipeline value
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
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
          hint={`${data.stats.sent} sent · ${filterCount("VIEWED", data.proposals, nowMs)} viewed`}
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

      <section className="enterprise-card space-y-3 p-3 sm:p-4">
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
              className={`${OM_COMPACT_INPUT} enterprise-field-input--icon`}
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
            const count = filterCount(key, data.proposals, nowMs);
            const showCount = key === "ALL" || count > 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => onStatusChipChange(key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === key ? OM_COMPACT_CHIP_ACTIVE : OM_COMPACT_CHIP_IDLE
                }`}
                style={
                  filter === key ? { backgroundColor: "var(--enterprise-primary)" } : undefined
                }
              >
                {FILTER_LABEL[key]}
                {showCount ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </section>

      {completelyEmpty ? (
        <OmEmptyState
          icon={FileSpreadsheet}
          title="No proposals yet"
          description="Create a proposal to send a priced offer to your client and track their response."
          action={
            <EnterpriseButton
              size="sm"
              onClick={() => {
                window.location.href = `${base}/new`;
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              New proposal
            </EnterpriseButton>
          }
        />
      ) : emptyAfterFilter ? (
        <OmEmptyState
          icon={FileSpreadsheet}
          title="No proposals match"
          description="Try clearing filters or searching with different terms."
          action={
            <EnterpriseButton size="sm" variant="secondary" onClick={clearFilters}>
              Reset filters
            </EnterpriseButton>
          }
        />
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Proposal list">
            {filteredProposals.map((p) => (
              <ProposalCard key={p.id} p={p} base={base} />
            ))}
          </ul>

          <section className="enterprise-card hidden overflow-hidden md:block">
            <div className="hidden grid-cols-[72px_minmax(200px,2fr)_120px_minmax(120px,1fr)_100px_120px] gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)] lg:grid">
              <span>#</span>
              <span>Proposal</span>
              <span>Status</span>
              <span>Client</span>
              <span>Sent</span>
              <span className="text-right">Value</span>
            </div>
            <div className="divide-y divide-[var(--enterprise-border)]">
              {filteredProposals.map((p) => (
                <ProposalTableRow key={p.id} p={p} base={base} />
              ))}
            </div>
          </section>
        </>
      )}
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
    <article className="enterprise-card flex items-start gap-2 p-3 sm:p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--enterprise-text-muted)]">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">{hint}</p>
        ) : null}
      </div>
    </article>
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
          className="block touch-manipulation p-3 transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
              #{String(p.sequenceNumber).padStart(3, "0")}
            </span>
            <span className={proposalStatusBadgeClass(p.status)}>
              {proposalStatusLabel(p.status)}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
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
