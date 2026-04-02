"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Filter, SortAsc, Users } from "lucide-react";
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
  return (
    <tr className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
      <td className="max-w-[200px] px-4 py-3 align-top text-slate-600">
        <span className="line-clamp-2 text-sm leading-snug" title={issue.file.name}>
          {issue.file.name}
        </span>
        <span className="mt-1 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-500">
          v{issue.fileVersion.version}
        </span>
      </td>
      <td className="max-w-[min(280px,32vw)] px-4 py-3 align-top">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">
          {issue.title}
        </span>
        <p className="mt-1 text-[11px] tabular-nums text-slate-500">
          {issue.sheetName ?? issue.file.name} · v{issue.sheetVersion ?? issue.fileVersion.version}
          {issue.pageNumber != null ? ` · p.${issue.pageNumber}` : ""}
        </p>
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
      <td className="px-4 py-3 align-top text-sm text-slate-600">
        {issue.assignee?.name || issue.assignee?.email || <span className="text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">
        {ISSUE_PRIORITY_LABEL[issue.priority ?? "MEDIUM"] ?? issue.priority ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-slate-600">
        {issue.dueDate ? (
          issueDateToInputValue(issue.dueDate)
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          href={viewerHrefForIssue(issue)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/60"
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

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "IN_PROGRESS", label: "In progress" },
    { key: "RESOLVED", label: "Resolved" },
    { key: "CLOSED", label: "Closed" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Issues</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Create issues and place{" "}
            <span className="font-medium text-slate-700">status-colored pins</span> in the{" "}
            <Link href="/viewer" className="font-semibold text-blue-600 hover:underline">
              viewer
            </Link>
            . Use the table to change status or open the exact sheet revision.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Filters
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  filter === f.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
            <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
              className="min-w-[11rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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

          <div className="flex items-center gap-2 lg:ml-auto">
            <SortAsc className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="newest">Newest first</option>
              <option value="file">File name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {msg ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {msg}
        </div>
      ) : null}

      {isPending ? (
        <div className="py-16">
          <EnterpriseLoadingState
            variant="minimal"
            message="Loading issues…"
            label="Loading project issues"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    File
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Title
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assignee
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Due
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-500">
                      {items.length === 0
                        ? "No issues yet. Open a PDF from this project’s Files, then use the Issues tab in the viewer to create issues and place pins on the sheet."
                        : "No issues match these filters. Try another status or assignee."}
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
