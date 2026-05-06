"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  ArrowUpCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Filter,
  Flag,
  ImageIcon,
  Inbox,
  LayoutGrid,
  Loader2,
  MapPin,
  Package,
  RotateCcw,
  SortAsc,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchIssue,
  fetchIssuesForProject,
  fetchProject,
  fetchProjectSession,
  fetchWorkspaceMembers,
  formatIssueLockHint,
  patchIssue,
  presignReadIssueReferencePhoto,
  ProRequiredError,
  viewerHrefForIssue,
  type IssueReferencePhotoRow,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";

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

function PhotoThumb({ issueId, photo }: { issueId: string; photo: IssueReferencePhotoRow }) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.issueRefPhotoReadUrl(issueId, photo.id),
    queryFn: () => presignReadIssueReferencePhoto(issueId, photo.id),
    staleTime: 60_000,
  });
  if (isPending || !url) {
    return (
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-[var(--enterprise-border)]/60" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL
    <img
      src={url}
      alt=""
      className="h-16 w-16 shrink-0 rounded-lg border border-[var(--enterprise-border)] object-cover"
    />
  );
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
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:py-14">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <Inbox className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} aria-hidden />
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

type Props = {
  projectId: string;
  /** When set (e.g. from <code>/om/tenant-requests/[issueId]</code>), detail panel opens for this issue. */
  selectedIssueId?: string;
};

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

  const { data: project } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const workspaceId = project?.workspaceId;

  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const members = membersRes?.members ?? [];

  const filtered = useMemo(() => {
    let list = filter === "ALL" ? items : items.filter((i) => i.status === filter);
    if (assigneeFilter === "UNASSIGNED") list = list.filter((i) => !i.assigneeId);
    else if (assigneeFilter !== "ALL") list = list.filter((i) => i.assigneeId === assigneeFilter);
    if (sort === "newest") {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    }
    return list;
  }, [items, filter, sort, assigneeFilter]);

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
    (row: IssueRow) => {
      qc.setQueryData(issuesKey, (old: IssueRow[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === row.id ? row : i));
      });
      qc.setQueryData(qk.issueById(row.id), row);
      qc.setQueriesData<IssueRow[]>(
        { queryKey: ["issues", "fileVersion"], exact: false },
        (old) => {
          if (!old?.length) return old;
          if (!old.some((i) => i.id === row.id)) return old;
          return old.map((i) => (i.id === row.id ? row : i));
        },
      );
    },
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
  const photoCount = detailIssue?.referencePhotos?.length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
            aria-hidden
          >
            <Inbox className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Occupant inbox
            </h1>
            {!isPending ? (
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                {stats.total === 0
                  ? "Occupant submissions for this building — triage and track without the construction drawings workflow."
                  : `${stats.total} request${stats.total === 1 ? "" : "s"} from tenants or visitors`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href={tenantPortalHref}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] sm:h-10 sm:w-auto sm:min-h-0 sm:rounded-lg sm:px-3 sm:text-xs"
          >
            <Building2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={1.75} aria-hidden />
            Occupant hub
          </Link>
          <Link
            href={assetsHref}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 sm:h-10 sm:w-auto sm:min-h-0 sm:rounded-lg sm:px-3 sm:text-xs"
          >
            <Package className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={1.75} aria-hidden />
            {"Equipment & QR labels"}
          </Link>
        </div>
      </header>

      <div className="sticky top-0 z-10 space-y-4 border-b border-[var(--enterprise-border)]/70 bg-[var(--enterprise-bg)]/90 py-1 pb-4 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--enterprise-bg)]/80">
        <div className="enterprise-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              <Filter className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Refine inbox
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
              >
                <RotateCcw className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                Reset filters
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="mb-2 text-xs font-medium text-[var(--enterprise-text-muted)]">
                Status
              </div>
              <div
                className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap"
                role="tablist"
                aria-label="Filter by status"
              >
                {ISSUE_FILTER_DEFS.map((f) => {
                  const TabIcon = f.Icon;
                  const selected = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setFilter(f.key)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-medium transition sm:py-2 ${
                        selected
                          ? "bg-[var(--enterprise-primary)] text-white shadow-sm [&_svg]:text-white"
                          : "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] [&_svg]:opacity-80"
                      }`}
                    >
                      <TabIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--enterprise-border)]/80 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <Users className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" aria-hidden />
              <div>
                <label
                  htmlFor="tenant-assignee-filter"
                  className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]"
                >
                  Assignee
                </label>
                <select
                  id="tenant-assignee-filter"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
                  className="min-w-[11rem] rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] outline-none focus:border-[var(--enterprise-primary)] focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                >
                  <option value="ALL">All assignees</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.email || m.userId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2 lg:ml-auto">
              <div>
                <label
                  htmlFor="tenant-sort"
                  className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]"
                >
                  Sort
                </label>
                <div className="flex items-center gap-2">
                  <SortAsc
                    className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                    aria-hidden
                  />
                  <select
                    id="tenant-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] outline-none focus:border-[var(--enterprise-primary)] focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                  >
                    <option value="newest">Newest first</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {msg ? (
        <div
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-3 text-sm text-red-900"
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
        <>
          {!isPending && items.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--enterprise-text-muted)]">
              <p>
                Showing{" "}
                <span className="font-semibold text-[var(--enterprise-text)] tabular-nums">
                  {filtered.length}
                </span>
                {filtered.length !== items.length ? (
                  <>
                    {" "}
                    of{" "}
                    <span className="font-semibold text-[var(--enterprise-text)] tabular-nums">
                      {items.length}
                    </span>
                  </>
                ) : null}{" "}
                {filtered.length === 1 ? "request" : "requests"}
                {filtersActive ? (
                  <span className="text-[var(--enterprise-text-muted)]"> (filtered)</span>
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="enterprise-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80">
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Received
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Reporter
                    </th>
                    <th className="min-w-[220px] px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Request
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Location / equipment
                    </th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Photos
                    </th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Status
                    </th>
                    <th className="min-w-[8rem] px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Assignee
                    </th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                      Priority
                    </th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
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
                          className="cursor-pointer border-b border-[var(--enterprise-border)]/80 transition-colors last:border-0 hover:bg-[var(--enterprise-hover-surface)]/80"
                          onClick={() => openDetail(issue.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 align-top text-sm tabular-nums text-[var(--enterprise-text)]">
                            {new Date(issue.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="max-w-[10rem] px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
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
                          <td className="max-w-[min(360px,40vw)] px-4 py-3 align-top">
                            <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--enterprise-text)]">
                              {issue.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--enterprise-text-muted)]">
                              {previewText(issue.description)}
                            </p>
                          </td>
                          <td className="max-w-[12rem] px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
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
                          <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[var(--enterprise-text-muted)]">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <ImageIcon className="h-4 w-4 opacity-70" aria-hidden />
                              {nPhotos}
                            </span>
                          </td>
                          <td className="w-[1%] min-w-[10rem] whitespace-nowrap px-4 py-3 align-top">
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
                          <td className="px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
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
                          <td className="px-4 py-3 align-top">
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
                          <td className="whitespace-nowrap px-4 py-3 align-top text-right">
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
          </div>
        </>
      )}

      <EnterpriseSlideOver
        open={detailOpen}
        onClose={closeDetail}
        panelMaxWidthClass="max-w-lg"
        ariaLabelledBy="tenant-detail-title"
        header={
          <div className="min-w-0 pr-8 sm:pr-10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              {promotedAway ? "Work order (promoted)" : "Tenant request"}
            </p>
            <h2
              id="tenant-detail-title"
              className="mt-1 text-lg font-semibold text-[var(--enterprise-text)]"
            >
              {detailIssue?.title ?? "…"}
            </h2>
            {detailIssue?.createdAt ? (
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                Received{" "}
                {new Date(detailIssue.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
          </div>
        }
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {detailIssue && canPromoteOccupant && detailIssue.issueKind === "OCCUPANT" ? (
              <button
                type="button"
                disabled={promotingIssueId === detailIssue.id}
                onClick={() => promoteMut.mutate(detailIssue.id)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 sm:w-auto"
              >
                {promotingIssueId === detailIssue.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ArrowUpCircle className="h-4 w-4" aria-hidden />
                )}
                Promote to work order
              </button>
            ) : null}
            <Link
              href={detailIssue ? viewerHrefForIssue(detailIssue) : "#"}
              onClick={(e) => {
                if (!detailIssue) e.preventDefault();
              }}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-medium text-[var(--enterprise-text)] shadow-sm hover:bg-[var(--enterprise-bg)] sm:w-auto ${
                !detailIssue ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <MapPin className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              Floor plan / viewer
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </div>
        }
      >
        {selectedIssueId && detailPending && !detailIssue ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin text-[var(--enterprise-text-muted)]"
              aria-hidden
            />
          </div>
        ) : detailIssue && promotedAway ? (
          <div className="space-y-4 px-1 text-sm leading-relaxed text-[var(--enterprise-text)]">
            <p>
              This occupant submission was{" "}
              <strong className="font-medium">promoted to an internal work order</strong>. It is{" "}
              {"tracked with your other O&M work, not in the tenant inbox."}
            </p>
            <Link
              href={workOrdersHref}
              className="inline-flex items-center gap-1 font-semibold text-[var(--enterprise-primary)] underline"
            >
              Open work orders
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : detailIssue ? (
          <div className="space-y-6 text-sm text-[var(--enterprise-text)]">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Reporter
              </h3>
              <p className="mt-2 font-medium">{detailIssue.reporterName?.trim() || "—"}</p>
              {detailIssue.reporterEmail?.trim() ? (
                <p className="mt-1 break-all text-[var(--enterprise-text-muted)]">
                  {detailIssue.reporterEmail.trim()}
                </p>
              ) : null}
            </section>

            {detailIssue.asset || detailIssue.location?.trim() ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Location / equipment
                </h3>
                {detailIssue.asset ? (
                  <p className="mt-2">
                    <span className="font-mono text-xs">{detailIssue.asset.tag}</span>
                    <span className="text-[var(--enterprise-text-muted)]"> — </span>
                    {detailIssue.asset.name}
                  </p>
                ) : null}
                {detailIssue.location?.trim() ? (
                  <p className="mt-2 text-[var(--enterprise-text-muted)]">
                    {detailIssue.location.trim()}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Description
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-[var(--enterprise-text)]">
                {(detailIssue.description ?? "").trim() || "—"}
              </p>
            </section>

            {photoCount > 0 ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Photos from submitter
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detailIssue.referencePhotos!.map((p) => (
                    <PhotoThumb key={p.id} issueId={detailIssue.id} photo={p} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 border-t border-[var(--enterprise-border)] pt-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Status
                </label>
                <select
                  value={detailIssue.status}
                  onChange={(e) => patchMut.mutate({ id: detailIssue.id, status: e.target.value })}
                  disabled={patchingIssueId === detailIssue.id}
                  className={`mt-2 w-full cursor-pointer rounded-lg border-0 px-2.5 py-2 text-xs font-semibold shadow-sm outline-none disabled:opacity-50 ${issueStatusBadgeClassLight(detailIssue.status)}`}
                >
                  {ISSUE_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {ISSUE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Priority
                </label>
                <select
                  value={detailIssue.priority ?? "MEDIUM"}
                  onChange={(e) =>
                    patchMut.mutate({ id: detailIssue.id, priority: e.target.value })
                  }
                  disabled={patchingIssueId === detailIssue.id}
                  className="mt-2 w-full cursor-pointer rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--enterprise-text)] shadow-sm outline-none disabled:opacity-50"
                >
                  {ISSUE_PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {ISSUE_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Assignee
                </label>
                <select
                  value={detailIssue.assigneeId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    patchMut.mutate({ id: detailIssue.id, assigneeId: v === "" ? null : v });
                  }}
                  disabled={patchingIssueId === detailIssue.id}
                  className="mt-2 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] outline-none focus:border-[var(--enterprise-primary)] disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.email || m.userId}
                    </option>
                  ))}
                </select>
              </div>
              {detailIssue.dueDate ? (
                <div className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Due
                  </span>
                  <p className="mt-1 tabular-nums">{issueDateToInputValue(detailIssue.dueDate)}</p>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </EnterpriseSlideOver>
    </div>
  );
}
