"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpCircle,
  Activity,
  Archive,
  Calendar,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileText,
  Flag,
  FolderOpen,
  LayoutGrid,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  SortAsc,
  Trash2,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteProjectIssueConfirmDialog } from "@/components/enterprise/DeleteProjectIssueConfirmDialog";
import { IssueCreateSlideOver } from "@/components/enterprise/IssueCreateSlideOver";
import { IssueEditSlideOver } from "@/components/enterprise/IssueEditSlideOver";
import { WorkOrderCreateSlideOver } from "@/components/enterprise/WorkOrderCreateSlideOver";
import { WorkOrderEditSlideOver } from "@/components/enterprise/WorkOrderEditSlideOver";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  deleteIssue,
  fetchIssuesForProject,
  fetchProject,
  fetchProjectSession,
  fetchWorkspaceMembers,
  formatIssueLockHint,
  patchIssue,
  ProRequiredError,
  viewerHrefForIssue,
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
import { MOBILE_FIELD_SELECT } from "@/lib/mobileFormStyles";
import {
  OM_COMPACT_CHIP_ACTIVE,
  OM_COMPACT_CHIP_IDLE,
  OM_COMPACT_SELECT,
  OM_PAGE_CLASS,
} from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

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

function issueSheetLabel(issue: IssueRow): string {
  const name = issue.sheetName?.trim() || issue.file?.name?.trim();
  if (!name) return "No sheet";
  const ver = issue.sheetVersion ?? issue.fileVersion?.version;
  return ver != null ? `${name} · v${ver}` : name;
}

function IssueEmptyState({
  noRows,
  projectId,
  entityLabel,
  canCreate,
  onCreateClick,
  emptyIcon: EmptyIcon = MapPin,
  emptyHint,
}: {
  noRows: boolean;
  projectId: string;
  entityLabel: string;
  canCreate: boolean;
  onCreateClick?: () => void;
  emptyIcon?: LucideIcon;
  emptyHint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <EmptyIcon
          className="h-7 w-7 text-[var(--enterprise-primary)]"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">
          {noRows ? `No ${entityLabel}s yet` : "No matches"}
        </p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          {noRows
            ? canCreate
              ? (emptyHint ??
                `Create a ${entityLabel} here, or open a PDF from Files to place a pin on the sheet.`)
              : `No ${entityLabel}s in this project yet.`
            : "Try another status filter or assignee, or reset filters to see all items."}
        </p>
      </div>
      {noRows && canCreate && onCreateClick ? (
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--enterprise-shadow-sm)] transition hover:bg-[var(--enterprise-primary-deep)]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New {entityLabel}
        </button>
      ) : noRows ? (
        <Link
          href={`/projects/${projectId}/files`}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-hover-surface)]"
        >
          <FolderOpen className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
          Open project files
        </Link>
      ) : null}
    </div>
  );
}

type IssueRowProps = {
  issue: IssueRow;
  isPatching: boolean;
  isDeleting: boolean;
  onStatusChange: (issueId: string, status: string) => void;
  onDeleteClick: (issue: IssueRow) => void;
  onEditClick: (issue: IssueRow) => void;
  showPromoteOccupant?: boolean;
  onPromoteToWorkOrder?: (issueId: string) => void;
  promoteBusy?: boolean;
};

const ProjectIssueTableRow = memo(function ProjectIssueTableRow({
  issue,
  isPatching,
  isDeleting,
  onStatusChange,
  onDeleteClick,
  onEditClick,
  showPromoteOccupant,
  onPromoteToWorkOrder,
  promoteBusy,
}: IssueRowProps) {
  const pri = issue.priority ?? "MEDIUM";
  const priClass = priorityBadgeClassLight(pri);
  const viewerHref = viewerHrefForIssue(issue);
  const sheetLabel = issueSheetLabel(issue);
  const photoCount = issue.referencePhotos?.length ?? 0;

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
            <span
              className={`line-clamp-2 text-sm leading-snug ${issue.file ? "" : "text-[var(--enterprise-text-muted)]"}`}
              title={sheetLabel}
            >
              {sheetLabel}
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
            {photoCount > 0 ? (
              <span className="mt-1 inline-flex items-center rounded-md bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--enterprise-primary)]">
                {photoCount} photo{photoCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {showPromoteOccupant && issue.issueKind === "OCCUPANT" && onPromoteToWorkOrder ? (
              <button
                type="button"
                disabled={promoteBusy}
                onClick={() => onPromoteToWorkOrder(issue.id)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--enterprise-primary)] shadow-sm hover:bg-[var(--enterprise-primary-soft)] disabled:opacity-50"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden />
                Promote to work order
              </button>
            ) : null}
            {issue.pageNumber != null ? (
              <p className="mt-1 text-[11px] tabular-nums text-[var(--enterprise-text-muted)]">
                Page {issue.pageNumber}
              </p>
            ) : null}
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
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            title="Edit issue"
            onClick={() => onEditClick(issue)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Edit
          </button>
          {viewerHref ? (
            <Link
              href={viewerHref}
              title={`Open “${issue.title}” in the viewer`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-primary-soft)]"
            >
              Open
              <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--enterprise-text-muted)]">
              No sheet
            </span>
          )}
          <button
            type="button"
            title="Delete"
            disabled={isDeleting}
            onClick={() => onDeleteClick(issue)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)] transition hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
});

const ProjectIssueMobileCard = memo(function ProjectIssueMobileCard({
  issue,
  isPatching,
  isDeleting,
  onStatusChange,
  onDeleteClick,
  onEditClick,
  showPromoteOccupant,
  onPromoteToWorkOrder,
  promoteBusy,
}: IssueRowProps) {
  const pri = issue.priority ?? "MEDIUM";
  const priClass = priorityBadgeClassLight(pri);
  const viewerHref = viewerHrefForIssue(issue);
  const sheetLabel = issueSheetLabel(issue);
  const photoCount = issue.referencePhotos?.length ?? 0;

  return (
    <li className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 shadow-[var(--enterprise-shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
            {issue.title}
          </p>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--enterprise-text-muted)]">
            {sheetLabel}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${priClass}`}
        >
          <Flag className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
          {ISSUE_PRIORITY_LABEL[pri] ?? pri}
        </span>
      </div>

      {issue.pageNumber != null ? (
        <p className="mt-2 text-xs tabular-nums text-[var(--enterprise-text-muted)]">
          Page {issue.pageNumber}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Status
          </span>
          <select
            value={issue.status}
            onChange={(e) => onStatusChange(issue.id, e.target.value)}
            disabled={isPatching}
            className={`${MOBILE_FIELD_SELECT} cursor-pointer border-0 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50 ${issueStatusBadgeClassLight(issue.status)}`}
          >
            {ISSUE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ISSUE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0">
          <span className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Assignee
          </span>
          <p className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]">
            <UserRound
              className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
            />
            <span className="min-w-0 truncate">
              {issue.assignee?.name || issue.assignee?.email || "Unassigned"}
            </span>
          </p>
        </div>
      </div>

      {issue.dueDate ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm tabular-nums text-[var(--enterprise-text)]">
          <Calendar
            className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
          Due {issueDateToInputValue(issue.dueDate)}
        </p>
      ) : null}
      {photoCount > 0 ? (
        <p className="mt-2 text-xs font-medium text-[var(--enterprise-primary)]">
          {photoCount} attached photo{photoCount === 1 ? "" : "s"}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEditClick(issue)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] transition active:scale-[0.98]"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </button>
        {viewerHref ? (
          <Link
            href={viewerHref}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Open in viewer
            <ExternalLink className="h-4 w-4 opacity-90" strokeWidth={2} />
          </Link>
        ) : null}
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => onDeleteClick(issue)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 text-sm font-semibold text-[var(--enterprise-semantic-danger-text)] transition active:scale-[0.98] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </button>
        {showPromoteOccupant && issue.issueKind === "OCCUPANT" && onPromoteToWorkOrder ? (
          <button
            type="button"
            disabled={promoteBusy}
            onClick={() => onPromoteToWorkOrder(issue.id)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-primary)] transition active:scale-[0.98] disabled:opacity-50"
          >
            <ArrowUpCircle className="h-4 w-4" aria-hidden />
            Promote
          </button>
        ) : null}
      </div>
    </li>
  );
});

export function ProjectIssuesClient({
  projectId,
  issueKindFilter,
  listTitle = "Issues",
}: {
  projectId: string;
  issueKindFilter?: "WORK_ORDER" | "CONSTRUCTION" | "OCCUPANT";
  listTitle?: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);
  const filterAssetId = searchParams.get("assetId")?.trim() || undefined;

  const entitySingular =
    issueKindFilter === "WORK_ORDER"
      ? "work order"
      : issueKindFilter === "OCCUPANT"
        ? "tenant request"
        : "issue";
  const isWorkOrders = issueKindFilter === "WORK_ORDER";
  const canCreate = issueKindFilter !== "OCCUPANT";
  const createLabel = isWorkOrders ? "New work order" : "New issue";
  const ListIcon = isWorkOrders ? Wrench : MapPin;

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [msg, setMsg] = useState<string | null>(null);
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);
  const [promotingIssueId, setPromotingIssueId] = useState<string | null>(null);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deleteConfirmIssue, setDeleteConfirmIssue] = useState<IssueRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueRow | null>(null);
  const clearAssetFilterHref = useMemo(() => {
    if (!filterAssetId || !pathname) return null;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("assetId");
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [filterAssetId, pathname, searchParams]);

  const issuesKey = qk.issuesForProject(projectId, undefined, issueKindFilter, filterAssetId);
  const { data: items = [], isPending } = useQuery({
    queryKey: issuesKey,
    queryFn: () =>
      fetchIssuesForProject(projectId, {
        issueKind: issueKindFilter,
        assetId: filterAssetId,
      }),
  });

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const canPromoteOccupant = Boolean(
    issueKindFilter === "OCCUPANT" && projectSession && !projectSession.isExternal,
  );

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
        issueSheetLabel(a).localeCompare(issueSheetLabel(b), undefined, { sensitivity: "base" }),
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

  const onIssueStatusChange = useCallback(
    (issueId: string, status: string) => {
      patchMut.mutate({ id: issueId, status });
    },
    [patchMut],
  );

  const openCreateForm = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleIssueCreated = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: issuesKey });
    await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
    setCreateOpen(false);
    setMsg(null);
  }, [qc, issuesKey]);

  const openEditForm = useCallback((issue: IssueRow) => {
    setEditingIssue(issue);
    setEditOpen(true);
  }, []);

  const closeEditForm = useCallback(() => {
    setEditOpen(false);
    setEditingIssue(null);
  }, []);

  const handleIssueSaved = useCallback(
    (row: IssueRow) => {
      mergeIssueIntoLists(row);
      setEditingIssue(row);
      setMsg(null);
    },
    [mergeIssueIntoLists],
  );

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onMutate: (id) => setDeletingIssueId(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: issuesKey });
      await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
      setDeleteConfirmIssue(null);
      toast.success(`${entitySingular.charAt(0).toUpperCase()}${entitySingular.slice(1)} deleted.`);
      setMsg(null);
    },
    onError: (e: Error) => {
      toast.error(
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
      );
    },
    onSettled: () => setDeletingIssueId(null),
  });

  const onDeleteClick = useCallback((issue: IssueRow) => {
    setDeleteConfirmIssue(issue);
  }, []);

  const onEditClick = useCallback(
    (issue: IssueRow) => {
      openEditForm(issue);
    },
    [openEditForm],
  );

  const listItemNoun =
    issueKindFilter === "WORK_ORDER"
      ? "work orders"
      : issueKindFilter === "OCCUPANT"
        ? "tenant requests"
        : "issues";

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

  const filtersActive =
    filter !== "ALL" || assigneeFilter !== "ALL" || sort !== "newest" || Boolean(filterAssetId);

  const clearFilters = useCallback(() => {
    setFilter("ALL");
    setAssigneeFilter("ALL");
    setSort("newest");
    if (filterAssetId && pathname) {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("assetId");
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }
  }, [filterAssetId, pathname, router, searchParams]);

  return (
    <div className={`${OM_PAGE_CLASS} w-full min-w-0 max-w-full`}>
      <OmSubPageHeader
        icon={MapPin}
        title={listTitle}
        description={
          !isPending
            ? stats.total === 0
              ? `No ${listTitle.toLowerCase()} recorded for this project yet.`
              : `${stats.total} ${listItemNoun} in this project`
            : undefined
        }
        action={
          <>
            {canCreate ? (
              <EnterpriseButton
                size="sm"
                disabled={ctxLoading || !isPro}
                onClick={openCreateForm}
                className={isWorkOrders ? "bg-sky-600 hover:bg-sky-700" : undefined}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                {createLabel}
              </EnterpriseButton>
            ) : null}
            <Link
              href={
                isWorkOrders ? `/projects/${projectId}/om/assets` : `/projects/${projectId}/files`
              }
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              {isWorkOrders ? (
                <Wrench className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              ) : (
                <FolderOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              )}
              {isWorkOrders ? "Assets" : "Project files"}
            </Link>
          </>
        }
      />

      {canCreate && !isPro ? (
        <div className="enterprise-alert-info flex items-start gap-3 px-4 py-3 shadow-[var(--enterprise-shadow-xs)]">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]"
            aria-hidden
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <p className="text-sm leading-relaxed">
            Pro subscription required to create and manage {listItemNoun}.
          </p>
        </div>
      ) : null}

      {filterAssetId ? (
        <div className="enterprise-card flex flex-wrap items-center justify-between gap-3 border border-[var(--enterprise-primary)]/30 bg-[var(--enterprise-primary-soft)] px-4 py-3 text-sm">
          <p className="text-[var(--enterprise-text)]">
            Showing {listItemNoun} linked to one asset.
          </p>
          {clearAssetFilterHref ? (
            <Link
              href={clearAssetFilterHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35"
            >
              <RotateCcw className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
              Show all
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 pb-3 backdrop-blur-md lg:static lg:bg-transparent">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="mobile-chip-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
                    selected ? OM_COMPACT_CHIP_ACTIVE : OM_COMPACT_CHIP_IDLE
                  }`}
                  style={selected ? { backgroundColor: "var(--enterprise-primary)" } : undefined}
                >
                  <TabIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {f.label}
                </button>
              );
            })}
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
            >
              <RotateCcw className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
              Reset
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[9rem]">
            <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Assignee
            </span>
            <select
              id="issues-assignee-filter"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
              className={OM_COMPACT_SELECT}
            >
              <option value="ALL">All assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email || m.userId}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[9rem]">
            <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
              <SortAsc className="h-3.5 w-3.5" aria-hidden />
              Sort
            </span>
            <select
              id="issues-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={OM_COMPACT_SELECT}
            >
              <option value="newest">Newest first</option>
              <option value="file">File name</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </div>

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
            {listItemNoun}
            {filtersActive ? (
              <span className="text-[var(--enterprise-text-muted)]"> (filtered)</span>
            ) : null}
          </p>
          {patchMut.isPending ? (
            <span className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Updating status…
            </span>
          ) : null}
        </div>
      ) : null}

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
            message="Loading issues…"
            label="Loading project issues"
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden" aria-label={listTitle}>
            {filtered.length === 0 ? (
              <li className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
                <IssueEmptyState
                  noRows={items.length === 0}
                  projectId={projectId}
                  entityLabel={entitySingular}
                  canCreate={canCreate && isPro}
                  onCreateClick={openCreateForm}
                  emptyIcon={ListIcon}
                  emptyHint={
                    isWorkOrders
                      ? "Create a work order tied to project equipment, or generate one from maintenance schedules."
                      : undefined
                  }
                />
              </li>
            ) : (
              filtered.map((issue) => (
                <ProjectIssueMobileCard
                  key={issue.id}
                  issue={issue}
                  isPatching={patchingIssueId === issue.id}
                  isDeleting={deletingIssueId === issue.id}
                  onStatusChange={onIssueStatusChange}
                  onDeleteClick={onDeleteClick}
                  onEditClick={onEditClick}
                  showPromoteOccupant={canPromoteOccupant}
                  onPromoteToWorkOrder={(id) => promoteMut.mutate(id)}
                  promoteBusy={promotingIssueId === issue.id}
                />
              ))
            )}
          </ul>
          <div className="enterprise-card hidden overflow-hidden rounded-2xl p-0 lg:block">
            <div className="mobile-table-wrap overflow-x-auto">
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
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <IssueEmptyState
                          noRows={items.length === 0}
                          projectId={projectId}
                          entityLabel={entitySingular}
                          canCreate={canCreate && isPro}
                          onCreateClick={openCreateForm}
                          emptyIcon={ListIcon}
                          emptyHint={
                            isWorkOrders
                              ? "Create a work order tied to project equipment, or generate one from maintenance schedules."
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((issue) => (
                      <ProjectIssueTableRow
                        key={issue.id}
                        issue={issue}
                        isPatching={patchingIssueId === issue.id}
                        isDeleting={deletingIssueId === issue.id}
                        onStatusChange={onIssueStatusChange}
                        onDeleteClick={onDeleteClick}
                        onEditClick={onEditClick}
                        showPromoteOccupant={canPromoteOccupant}
                        onPromoteToWorkOrder={(id) => promoteMut.mutate(id)}
                        promoteBusy={promotingIssueId === issue.id}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isWorkOrders ? (
        <WorkOrderCreateSlideOver
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={projectId}
          workspaceId={workspaceId}
          members={members}
          initialAssetId={filterAssetId}
          onCreated={handleIssueCreated}
        />
      ) : (
        <IssueCreateSlideOver
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={projectId}
          workspaceId={workspaceId}
          wid={wid}
          isPro={isPro}
          members={members}
          onCreated={handleIssueCreated}
        />
      )}

      {isWorkOrders ? (
        <WorkOrderEditSlideOver
          open={editOpen}
          issue={editingIssue}
          projectId={projectId}
          onClose={closeEditForm}
          members={members}
          onSaved={handleIssueSaved}
        />
      ) : (
        <IssueEditSlideOver
          open={editOpen}
          issue={editingIssue}
          onClose={closeEditForm}
          members={members}
          onSaved={handleIssueSaved}
        />
      )}

      <DeleteProjectIssueConfirmDialog
        open={Boolean(deleteConfirmIssue)}
        title={deleteConfirmIssue?.title ?? ""}
        entityLabel={entitySingular}
        isDeleting={deleteMut.isPending}
        onCancel={() => setDeleteConfirmIssue(null)}
        onConfirm={() => {
          if (deleteConfirmIssue) deleteMut.mutate(deleteConfirmIssue.id);
        }}
      />
    </div>
  );
}
