"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Flag,
  ImageIcon,
  Inbox,
  LayoutGrid,
  Package,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchIssue,
  fetchIssuesForProject,
  fetchProjectSession,
  formatIssueLockHint,
  patchIssue,
  postWorkOrderFromOccupant,
  ProRequiredError,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { TenantRequestDetailSlide } from "@/components/enterprise/TenantRequestDetailSlide";
import {
  AssigneeFilterSelect,
  SortSelect,
  StatusFilterChips,
  useProjectWorkspaceMembers,
  type SortSelectOption,
} from "@/components/enterprise/issueListControls";
import { filterIssueRows, mergeIssueRowIntoLists } from "@/lib/issueListFilters";
import { OM_COMPACT_SELECT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SortKey = "newest" | "status";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;

const ISSUE_FILTER_DEFS: { key: StatusFilter; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "OPEN", label: "Open", Icon: CircleDot },
  { key: "IN_PROGRESS", label: "In progress", Icon: Activity },
  { key: "RESOLVED", label: "Resolved", Icon: CheckCircle2 },
  { key: "CLOSED", label: "Closed", Icon: Archive },
];

const TENANT_SORT_OPTIONS: SortSelectOption<SortKey>[] = [
  { value: "newest", label: "Newest first" },
  { value: "status", label: "Status" },
];

function tenantRequestsListPath(projectId: string, workspaceId?: string | null): string {
  return workspaceId
    ? `/workspaces/${workspaceId}/projects/${projectId}/om/tenant-requests`
    : `/projects/${projectId}/om/tenant-requests`;
}

function previewText(s: string | null | undefined, max = 120): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function TenantRequestsEmpty({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId?: string;
}) {
  const portalHref = tenantRequestsListPath(projectId, workspaceId).replace(
    "/tenant-requests",
    "/tenant-portal",
  );
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <Inbox className="h-5 w-5 text-[var(--enterprise-primary)]" strokeWidth={1.5} aria-hidden />
      </div>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">
          No occupant requests yet
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          When tenants submit through your building link or equipment QR codes, their requests
          appear here for triage. Set up links on{" "}
          <Link
            href={portalHref}
            className="font-semibold text-[var(--enterprise-primary)] underline"
          >
            Occupant hub
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function TenantRequestMobileCard({
  issue,
  patching,
  onStatusChange,
  onOpen,
}: {
  issue: IssueRow;
  patching: boolean;
  onStatusChange: (id: string, status: string) => void;
  onOpen: (id: string) => void;
}) {
  const nPhotos = issue.referencePhotos?.length ?? 0;
  const pri = issue.priority ?? "MEDIUM";
  const priClass = priorityBadgeClassLight(pri);

  return (
    <li className="enterprise-animate-in">
      <div className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3.5 shadow-[var(--enterprise-shadow-xs)]">
        <button
          type="button"
          onClick={() => onOpen(issue.id)}
          className="mobile-touch-target flex w-full items-start gap-2.5 text-left active:opacity-90"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${issueStatusBadgeClassLight(issue.status)}`}
              >
                {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priClass}`}
              >
                <Flag className="h-3 w-3" aria-hidden />
                {ISSUE_PRIORITY_LABEL[pri] ?? pri}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
              {issue.title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--enterprise-text-muted)]">
              {previewText(issue.description, 100)}
            </p>
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              {issue.reporterName?.trim() || "Unknown reporter"}
              {issue.reporterEmail?.trim() ? ` · ${issue.reporterEmail.trim()}` : ""}
            </p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" />
        </button>

        {(issue.asset || issue.location?.trim()) && (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-[var(--enterprise-hover-surface)]/50 px-2.5 py-1.5 text-xs text-[var(--enterprise-text)]">
            {issue.asset ? (
              <>
                <span className="font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                  {issue.asset.tag}
                </span>
                <span className="text-[var(--enterprise-text-muted)]">·</span>
                <span className="min-w-0 truncate">{issue.asset.name}</span>
              </>
            ) : (
              issue.location!.trim()
            )}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--enterprise-text-muted)]">
          <time dateTime={issue.createdAt}>
            {new Date(issue.createdAt).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
          {nPhotos > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              {nPhotos}
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 border-t border-[var(--enterprise-border)]/70 pt-2.5">
          <label className="block min-w-0" onClick={(e) => e.stopPropagation()}>
            <span className="mb-0.5 block text-[11px] font-medium text-[var(--enterprise-text-muted)]">
              Status
            </span>
            <select
              value={issue.status}
              onChange={(e) => onStatusChange(issue.id, e.target.value)}
              disabled={patching}
              className={`${OM_COMPACT_SELECT} cursor-pointer text-xs font-semibold disabled:opacity-50 ${issueStatusBadgeClassLight(issue.status)}`}
            >
              {ISSUE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </li>
  );
}

type Props = {
  projectId: string;
  /** When set (e.g. from <code>/om/tenant-requests/[issueId]</code>), detail panel opens for this issue. */
  selectedIssueId?: string;
};

// Pre-existing monolith (detail slide-over, promote flow, list). TODO: split like ProjectIssuesClient.
// fallow-ignore-next-line complexity
export function TenantRequestsClient({ projectId, selectedIssueId }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id ?? null;

  const listBase = tenantRequestsListPath(projectId, wid);
  const workOrdersHref = listBase.replace("/tenant-requests", "/work-orders");
  const tenantPortalHref = listBase.replace("/tenant-requests", "/tenant-portal");
  const assetsHref = listBase.replace("/tenant-requests", "/assets");

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [msg, setMsg] = useState<string | null>(null);
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);
  const [promotingIssueId, setPromotingIssueId] = useState<string | null>(null);
  const [creatingWoIssueId, setCreatingWoIssueId] = useState<string | null>(null);

  const issuesKey = qk.issuesForProject(projectId, undefined, "OCCUPANT", undefined);
  const { data: items = [], isPending } = useQuery({
    queryKey: issuesKey,
    queryFn: () => fetchIssuesForProject(projectId, { issueKind: "OCCUPANT" }),
  });

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const canPromoteOccupant = Boolean(projectSession && !projectSession.isExternal);

  const { members } = useProjectWorkspaceMembers(projectId);

  const filtered = useMemo(
    () => filterIssueRows(items, { status: filter, assignee: assigneeFilter, sort }),
    [items, filter, sort, assigneeFilter],
  );

  const {
    data: detailFetched,
    isPending: detailPending,
    isError: detailError,
  } = useQuery({
    queryKey: qk.issueById(selectedIssueId ?? ""),
    queryFn: () => fetchIssue(selectedIssueId!),
    enabled: Boolean(selectedIssueId),
  });

  const detailIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    if (detailFetched?.id === selectedIssueId) return detailFetched;
    return items.find((i) => i.id === selectedIssueId) ?? null;
  }, [selectedIssueId, detailFetched, items]);

  useEffect(() => {
    if (!selectedIssueId || !detailError) return;
    toast.error("Could not load this request.");
    router.replace(listBase);
  }, [selectedIssueId, detailError, listBase, router]);

  const promotedAway = Boolean(detailFetched) && detailFetched!.issueKind !== "OCCUPANT";

  const mergeIssueIntoLists = useCallback(
    (row: IssueRow) => mergeIssueRowIntoLists(qc, issuesKey, row),
    [qc, issuesKey],
  );

  const patchMut = useMutation({
    mutationFn: (vars: {
      id: string;
      status?: string;
      assigneeId?: string | null;
      priority?: string;
    }) =>
      patchIssue(vars.id, {
        ...(vars.status !== undefined ? { status: vars.status } : {}),
        ...(vars.assigneeId !== undefined ? { assigneeId: vars.assigneeId } : {}),
        ...(vars.priority !== undefined ? { priority: vars.priority } : {}),
      }),
    onMutate: (vars) => {
      setPatchingIssueId(vars.id);
    },
    onSuccess: (row) => {
      mergeIssueIntoLists(row);
      setMsg(null);
    },
    onError: (e: Error) => {
      setMsg(e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e));
      toast.error(formatIssueLockHint(e));
    },
    onSettled: () => {
      setPatchingIssueId(null);
    },
  });

  const promoteMut = useMutation({
    mutationFn: (id: string) => patchIssue(id, { issueKind: "WORK_ORDER" }),
    onMutate: (id) => {
      setPromotingIssueId(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["issues", "project", projectId], exact: false });
      await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
      toast.success("Promoted to work order.");
      setMsg(null);
      router.replace(listBase);
    },
    onError: (e: Error) => {
      toast.error(
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
      );
    },
    onSettled: () => {
      setPromotingIssueId(null);
    },
  });

  const createWoMut = useMutation({
    mutationFn: (id: string) => postWorkOrderFromOccupant(projectId, id),
    onMutate: (id) => setCreatingWoIssueId(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["issues", "project", projectId], exact: false });
      await qc.invalidateQueries({ queryKey: qk.workOrders(projectId), exact: false });
      toast.success("Work order created from tenant request.");
      router.push(workOrdersHref);
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro required." : e.message);
    },
    onSettled: () => setCreatingWoIssueId(null),
  });

  const stats = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    let closed = 0;
    for (const i of items) {
      switch (i.status) {
        case "OPEN":
          open += 1;
          break;
        case "IN_PROGRESS":
          inProgress += 1;
          break;
        case "RESOLVED":
          resolved += 1;
          break;
        case "CLOSED":
          closed += 1;
          break;
        default:
          break;
      }
    }
    return { open, inProgress, resolved, closed, total: items.length };
  }, [items]);

  const filtersActive = filter !== "ALL" || assigneeFilter !== "ALL" || sort !== "newest";

  const clearFilters = useCallback(() => {
    setFilter("ALL");
    setAssigneeFilter("ALL");
    setSort("newest");
  }, []);

  const openDetail = (id: string) => {
    router.push(`${listBase}/${encodeURIComponent(id)}`);
  };

  const closeDetail = () => {
    router.push(listBase);
  };

  const detailOpen = Boolean(selectedIssueId);

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={Inbox}
        title="Occupant inbox"
        description={
          isPending
            ? "Loading requests…"
            : stats.total === 0
              ? "Occupant submissions — triage without the construction issues workflow."
              : `${stats.total} request${stats.total === 1 ? "" : "s"} from tenants or visitors`
        }
        action={
          <>
            <Link
              href={tenantPortalHref}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Hub
            </Link>
            <Link
              href={assetsHref}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Assets
            </Link>
          </>
        }
      />

      {msg ? (
        <div
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          <span className="min-w-0 flex-1 leading-relaxed">{msg}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-900/80 underline-offset-2 hover:bg-red-100/60 hover:text-red-950 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {isPending ? (
        <div className="enterprise-card py-16">
          <EnterpriseLoadingState
            variant="minimal"
            message="Loading tenant requests…"
            label="Loading tenant requests"
          />
        </div>
      ) : items.length === 0 ? (
        <div className="enterprise-card overflow-hidden p-0">
          <TenantRequestsEmpty projectId={projectId} workspaceId={wid ?? undefined} />
        </div>
      ) : (
        <section className="enterprise-card flex flex-col overflow-hidden">
          <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/95 px-3 py-3 backdrop-blur-md sm:px-4 lg:static lg:bg-transparent">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <StatusFilterChips
                  defs={ISSUE_FILTER_DEFS}
                  value={filter}
                  onChange={setFilter}
                  filtersActive={filtersActive}
                  onReset={clearFilters}
                  counts={{
                    ALL: stats.total,
                    OPEN: stats.open,
                    IN_PROGRESS: stats.inProgress,
                    RESOLVED: stats.resolved,
                    CLOSED: stats.closed,
                  }}
                />
              </div>
              <span className="hidden text-xs text-[var(--enterprise-text-muted)] sm:inline">
                <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {filtered.length}
                </span>{" "}
                shown
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
              <AssigneeFilterSelect
                id="tenant-assignee-filter"
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                members={members}
                className="min-w-0 sm:min-w-[11rem]"
              />
              <SortSelect
                id="tenant-sort"
                value={sort}
                onChange={setSort}
                options={TENANT_SORT_OPTIONS}
                className="min-w-0 sm:min-w-[10rem]"
              />
              <span className="col-span-2 text-xs text-[var(--enterprise-text-muted)] sm:hidden">
                <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {filtered.length}
                </span>{" "}
                shown
              </span>
            </div>
          </div>

          <ul className="space-y-2 p-3 sm:p-4 lg:hidden" aria-label="Occupant requests">
            {filtered.length === 0 ? (
              <li className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-10 text-center text-sm text-[var(--enterprise-text-muted)]">
                No requests match these filters.
              </li>
            ) : (
              filtered.map((issue) => (
                <TenantRequestMobileCard
                  key={issue.id}
                  issue={issue}
                  patching={patchingIssueId === issue.id}
                  onStatusChange={(id, status) => patchMut.mutate({ id, status })}
                  onOpen={openDetail}
                />
              ))
            )}
          </ul>

          <div className="mobile-table-wrap hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80">
                  <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Received
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Reporter
                  </th>
                  <th className="min-w-[220px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Request
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Location / equipment
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Photos
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Status
                  </th>
                  <th className="min-w-[8rem] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Assignee
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Priority
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-[var(--enterprise-text-muted)]"
                    >
                      No requests match these filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((issue) => {
                    const nPhotos = issue.referencePhotos?.length ?? 0;
                    const priRow = issue.priority ?? "MEDIUM";
                    const priRowClass = priorityBadgeClassLight(priRow);
                    return (
                      <tr
                        key={issue.id}
                        className="cursor-pointer border-b border-[var(--enterprise-border)]/80 transition-colors last:border-0 hover:bg-[var(--enterprise-hover-surface)]/80 mobile-tappable-row min-h-14 active:scale-[0.99]"
                        onClick={() => openDetail(issue.id)}
                      >
                        <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-[var(--enterprise-text)]">
                          {new Date(issue.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="max-w-[10rem] px-3 py-2.5 align-top text-[var(--enterprise-text)]">
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-medium leading-snug">
                              {issue.reporterName?.trim() || "—"}
                            </p>
                            {issue.reporterEmail?.trim() ? (
                              <p className="mt-0.5 line-clamp-2 break-all text-xs text-[var(--enterprise-text-muted)]">
                                {issue.reporterEmail.trim()}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[min(360px,40vw)] px-3 py-2.5 align-top">
                          <p className="line-clamp-2 font-medium leading-snug text-[var(--enterprise-text)]">
                            {issue.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--enterprise-text-muted)]">
                            {previewText(issue.description)}
                          </p>
                        </td>
                        <td className="max-w-[12rem] px-3 py-2.5 align-top text-[var(--enterprise-text)]">
                          {issue.asset ? (
                            <span className="line-clamp-2">
                              <span className="font-mono text-xs">{issue.asset.tag}</span>
                              <span className="text-[var(--enterprise-text-muted)]"> · </span>
                              {issue.asset.name}
                            </span>
                          ) : issue.location?.trim() ? (
                            <span className="line-clamp-2">{issue.location.trim()}</span>
                          ) : (
                            <span className="text-[var(--enterprise-text-muted)]">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-[var(--enterprise-text-muted)]">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <ImageIcon className="h-4 w-4 opacity-70" aria-hidden />
                            {nPhotos}
                          </span>
                        </td>
                        <td className="w-[1%] min-w-[10rem] whitespace-nowrap px-3 py-2.5 align-top">
                          <label className="block min-w-0">
                            <span className="sr-only">Status</span>
                            <select
                              value={issue.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                patchMut.mutate({ id: issue.id, status: e.target.value });
                              }}
                              disabled={patchingIssueId === issue.id}
                              className={`w-full max-w-[14rem] cursor-pointer rounded-lg border-0 px-2.5 py-2 text-xs font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 ${issueStatusBadgeClassLight(issue.status)}`}
                            >
                              {ISSUE_STATUS_ORDER.map((s) => (
                                <option key={s} value={s}>
                                  {ISSUE_STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </td>
                        <td className="px-3 py-2.5 align-top text-[var(--enterprise-text)]">
                          <div className="flex items-start gap-2">
                            <UserRound
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            <span className="min-w-0 break-words">
                              {issue.assignee?.name || issue.assignee?.email || (
                                <span className="text-[var(--enterprise-text-muted)]">
                                  Unassigned
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${priRowClass}`}
                          >
                            <Flag
                              className="h-3.5 w-3.5 shrink-0 opacity-80"
                              strokeWidth={2}
                              aria-hidden
                            />
                            {ISSUE_PRIORITY_LABEL[priRow] ?? priRow}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(issue.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                          >
                            Details
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TenantRequestDetailSlide
        open={detailOpen}
        onClose={closeDetail}
        projectId={projectId}
        workOrdersHref={workOrdersHref}
        issue={detailIssue}
        loading={Boolean(selectedIssueId && detailPending && !detailIssue)}
        promotedAway={promotedAway}
        canPromoteOccupant={canPromoteOccupant}
        members={members}
        patching={Boolean(detailIssue && patchingIssueId === detailIssue.id)}
        creatingWo={Boolean(detailIssue && creatingWoIssueId === detailIssue.id)}
        promoting={Boolean(detailIssue && promotingIssueId === detailIssue.id)}
        onPatch={(vars) => patchMut.mutate(vars)}
        onCreateWorkOrder={(id) => createWoMut.mutate(id)}
        onPromoteInPlace={(id) => promoteMut.mutate(id)}
      />
    </div>
  );
}
