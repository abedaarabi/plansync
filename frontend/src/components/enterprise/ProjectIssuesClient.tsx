"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  Calendar,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileText,
  Filter,
  Flag,
  LayoutGrid,
  MapPin,
  SortAsc,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  fetchIssuesForProject,
  fetchProject,
  fetchWorkspaceMembers,
  formatIssueLockHint,
  patchIssue,
  ProRequiredError,
  viewerHrefForIssue,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SortKey = "newest" | "file" | "status";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;

const ISSUE_FILTER_DEFS: { key: StatusFilter; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "OPEN", label: "Open", Icon: CircleDot },
  { key: "IN_PROGRESS", label: "In progress", Icon: Activity },
  { key: "RESOLVED", label: "Resolved", Icon: CheckCircle2 },
  { key: "CLOSED", label: "Closed", Icon: Archive },
];

const PRI_BADGE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/90",
  MEDIUM: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
  HIGH: "bg-red-50 text-red-800 ring-1 ring-red-200/80",
};

function StatCell({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3 py-2.5 sm:px-4 sm:py-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]"
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums leading-none text-[var(--enterprise-text)]">
          {value}
        </p>
        <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">{label}</p>
      </div>
    </div>
  );
}

function IssueEmptyState({ noRows }: { noRows: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center sm:py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <MapPin
          className="h-7 w-7 text-[var(--enterprise-primary)]"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">
          {noRows ? "No issues yet" : "No matches"}
        </p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          {noRows
            ? "Open a PDF from this project’s Files, then use the Issues tab in the viewer to create issues and place pins on the sheet."
            : "Try another status filter or assignee, or reset filters to see all issues."}
        </p>
      </div>
    </div>
  );
}

type IssueRowProps = {
  issue: IssueRow;
  isPatching: boolean;
  onStatusChange: (issueId: string, status: string) => void;
};

const ProjectIssueTableRow = memo(function ProjectIssueTableRow({
  issue,
  isPatching,
  onStatusChange,
}: IssueRowProps) {
  const pri = issue.priority ?? "MEDIUM";
  const priClass = PRI_BADGE[pri] ?? PRI_BADGE.MEDIUM;

  return (
    <tr className="border-b border-[var(--enterprise-border)]/80 transition-colors last:border-0 hover:bg-[var(--enterprise-hover-surface)]/80">
      <td className="max-w-[200px] px-4 py-3 align-top text-[var(--enterprise-text)]">
        <div className="flex gap-2">
          <FileText
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <span className="line-clamp-2 text-sm leading-snug" title={issue.file.name}>
              {issue.file.name}
            </span>
            <span className="mt-1 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
              v{issue.fileVersion.version}
            </span>
          </div>
        </div>
      </td>
      <td className="max-w-[min(280px,32vw)] px-4 py-3 align-top">
        <div className="flex gap-2">
          <MapPin
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <span className="line-clamp-2 text-sm font-medium leading-snug text-[var(--enterprise-text)]">
              {issue.title}
            </span>
            <p className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-[var(--enterprise-text-muted)]">
              <span className="line-clamp-1">
                {issue.sheetName ?? issue.file.name} · v
                {issue.sheetVersion ?? issue.fileVersion.version}
                {issue.pageNumber != null ? ` · p.${issue.pageNumber}` : ""}
              </span>
            </p>
          </div>
        </div>
      </td>
      <td className="w-[1%] min-w-[10.5rem] whitespace-nowrap px-4 py-3 align-top">
        <label className="block min-w-0">
          <span className="sr-only">Status</span>
          <select
            value={issue.status}
            onChange={(e) => onStatusChange(issue.id, e.target.value)}
            disabled={isPatching}
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
              <span className="text-[var(--enterprise-text-muted)]">Unassigned</span>
            )}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${priClass}`}
        >
          <Flag className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
          {ISSUE_PRIORITY_LABEL[pri] ?? pri}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
        {issue.dueDate ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Calendar
              className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            {issueDateToInputValue(issue.dueDate)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[var(--enterprise-text-muted)]">
            <Calendar className="h-4 w-4 opacity-50" strokeWidth={1.75} aria-hidden />—
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          href={viewerHrefForIssue(issue)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-primary-soft)]"
        >
          Open
          <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
        </Link>
      </td>
    </tr>
  );
});

export function ProjectIssuesClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [msg, setMsg] = useState<string | null>(null);
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);

  const issuesKey = qk.issuesForProject(projectId);
  const { data: items = [], isPending } = useQuery({
    queryKey: issuesKey,
    queryFn: () => fetchIssuesForProject(projectId),
  });

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
    if (assigneeFilter === "UNASSIGNED") {
      list = list.filter((i) => !i.assigneeId);
    } else if (assigneeFilter !== "ALL") {
      list = list.filter((i) => i.assigneeId === assigneeFilter);
    }
    if (sort === "newest")
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    else if (sort === "file")
      list = [...list].sort((a, b) =>
        a.file.name.localeCompare(b.file.name, undefined, { sensitivity: "base" }),
      );
    else if (sort === "status") list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    return list;
  }, [items, filter, sort, assigneeFilter]);

  const mergeIssueIntoLists = useCallback(
    (row: IssueRow) => {
      qc.setQueryData(issuesKey, (old: IssueRow[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === row.id ? row : i));
      });
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
    mutationFn: (vars: { id: string; status: string }) =>
      patchIssue(vars.id, { status: vars.status }),
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

  const onIssueStatusChange = useCallback(
    (issueId: string, status: string) => {
      patchMut.mutate({ id: issueId, status });
    },
    [patchMut],
  );

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

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
            aria-hidden
          >
            <MapPin className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Issues
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              Create issues and place{" "}
              <span className="font-medium text-[var(--enterprise-subtitle)]">
                status-colored pins
              </span>{" "}
              in the{" "}
              <Link
                href="/viewer"
                className="font-semibold text-[var(--enterprise-primary)] underline-offset-2 hover:underline"
              >
                viewer
              </Link>
              . Track status here or jump to the exact sheet revision.
            </p>
          </div>
        </div>
      </header>

      <div className="enterprise-card p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCell icon={LayoutGrid} value={stats.total} label="Total" />
          <StatCell icon={CircleDot} value={stats.open} label="Open" />
          <StatCell icon={Activity} value={stats.inProgress} label="In progress" />
          <StatCell icon={CheckCircle2} value={stats.resolved} label="Resolved" />
          <StatCell icon={Archive} value={stats.closed} label="Closed" />
        </div>
      </div>

      <div className="enterprise-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          <Filter className="h-3.5 w-3.5 opacity-80" aria-hidden />
          Filters
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-xs font-medium text-[var(--enterprise-text-muted)]">
              Status
            </div>
            <div
              className="-mx-1 flex flex-wrap gap-1.5"
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
              <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
                Assignee
              </label>
              <select
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
              <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
                Sort
              </label>
              <div className="flex items-center gap-2">
                <SortAsc
                  className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                  aria-hidden
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] outline-none focus:border-[var(--enterprise-primary)] focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                >
                  <option value="newest">Newest first</option>
                  <option value="file">File name</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {msg ? (
        <div
          className="rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {msg}
        </div>
      ) : null}

      {isPending ? (
        <div className="enterprise-card py-16">
          <EnterpriseLoadingState
            variant="minimal"
            message="Loading issues…"
            label="Loading project issues"
          />
        </div>
      ) : (
        <div className="enterprise-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                      File
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                      Title
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                      Status
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                      Assignee
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                      Priority
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
                      Due
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <ExternalLink
                        className="h-3.5 w-3.5 opacity-80"
                        strokeWidth={2}
                        aria-hidden
                      />
                      Viewer
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <IssueEmptyState noRows={items.length === 0} />
                    </td>
                  </tr>
                ) : (
                  filtered.map((issue) => (
                    <ProjectIssueTableRow
                      key={issue.id}
                      issue={issue}
                      isPatching={patchingIssueId === issue.id}
                      onStatusChange={onIssueStatusChange}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
