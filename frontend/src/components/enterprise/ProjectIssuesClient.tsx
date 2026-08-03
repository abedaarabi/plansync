"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpCircle,
  Activity,
  Archive,
  Calendar,
  Camera,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Flag,
  FolderOpen,
  LayoutGrid,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteProjectIssueConfirmDialog } from "@/components/enterprise/DeleteProjectIssueConfirmDialog";
import { IssueCreateSlideOver } from "@/components/enterprise/IssueCreateSlideOver";
import { IssueEditSlideOver } from "@/components/enterprise/IssueEditSlideOver";
import { IssuesOverview } from "@/components/enterprise/IssuesOverview";
import { WorkOrderCreateSlideOver } from "@/components/enterprise/WorkOrderCreateSlideOver";
import { WorkOrderEditSlideOver } from "@/components/enterprise/WorkOrderEditSlideOver";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  AssigneeFilterSelect,
  SortSelect,
  StatusFilterChips,
  useProjectWorkspaceMembers,
  type SortSelectOption,
} from "@/components/enterprise/issueListControls";
import {
  deleteIssue,
  fetchIssuesForProject,
  fetchProjectSession,
  formatIssueLockHint,
  patchIssue,
  ProRequiredError,
  viewerHrefForIssue,
  type IssueRow,
  type WorkspaceMemberRow,
} from "@/lib/api-client";
import {
  filterIssueRows,
  issueSheetLabel,
  mergeIssueRowIntoLists,
  type IssueDueFilter,
  type IssueListSortKey,
} from "@/lib/issueListFilters";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { isIssueOverdue, issueOverviewShortDate } from "@/lib/issuesOverviewStats";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { MOBILE_FIELD_SELECT } from "@/lib/mobileFormStyles";
import { OM_COMPACT_SELECT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;
type PriorityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type IssueKind = "WORK_ORDER" | "CONSTRUCTION" | "OCCUPANT" | undefined;

const ISSUE_FILTER_DEFS: { key: StatusFilter; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "OPEN", label: "Open", Icon: CircleDot },
  { key: "IN_PROGRESS", label: "In progress", Icon: Activity },
  { key: "RESOLVED", label: "Resolved", Icon: CheckCircle2 },
  { key: "CLOSED", label: "Closed", Icon: Archive },
];

const ISSUE_SORT_OPTIONS: SortSelectOption<IssueListSortKey>[] = [
  { value: "newest", label: "Newest first" },
  { value: "file", label: "File name" },
  { value: "status", label: "Status" },
];

function issueEntityLabels(kind: IssueKind) {
  const isWorkOrders = kind === "WORK_ORDER";
  return {
    entitySingular: isWorkOrders ? "work order" : kind === "OCCUPANT" ? "tenant request" : "issue",
    listItemNoun: isWorkOrders ? "work orders" : kind === "OCCUPANT" ? "tenant requests" : "issues",
    isWorkOrders,
    canCreate: kind !== "OCCUPANT",
    createLabel: isWorkOrders ? "New work order" : "New issue",
    ListIcon: isWorkOrders ? Wrench : MapPin,
  };
}

function issueFiltersAreActive(f: {
  status: StatusFilter;
  assignee: AssigneeFilter;
  priority: PriorityFilter;
  due: IssueDueFilter;
  search: string;
  sort: IssueListSortKey;
  assetId?: string;
}): boolean {
  return (
    f.status !== "ALL" ||
    f.assignee !== "ALL" ||
    f.priority !== "ALL" ||
    f.due !== "ALL" ||
    Boolean(f.search.trim()) ||
    f.sort !== "newest" ||
    Boolean(f.assetId)
  );
}

function toastIssueActionError(e: Error): void {
  toast.error(
    e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
  );
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
            : "Try a different search or filter combination, or reset filters to see all items."}
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

const TABLE_TH_CLASS =
  "sticky top-0 z-10 bg-[var(--enterprise-bg)] px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]";

const ROW_ACTION_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40 disabled:opacity-40";

const ROW_ACTION_DANGER_CLASS =
  "hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]";

type RowActionProps = {
  label: string;
  Icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function RowActionButton({ label, Icon, danger, disabled, onClick }: RowActionProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${ROW_ACTION_CLASS} ${danger ? ROW_ACTION_DANGER_CLASS : ""}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

function RowActionLink({ label, href, Icon }: { label: string; href: string; Icon: LucideIcon }) {
  return (
    <Link href={href} title={label} aria-label={label} className={ROW_ACTION_CLASS}>
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

type IssueRowProps = {
  issue: IssueRow;
  nowMs: number;
  isPatching: boolean;
  isDeleting: boolean;
  onStatusChange: (issueId: string, status: string) => void;
  onDeleteClick: (issue: IssueRow) => void;
  onEditClick: (issue: IssueRow) => void;
  showPromoteOccupant?: boolean;
  onPromoteToWorkOrder?: (issueId: string) => void;
  promoteBusy?: boolean;
};

function IssueTitleCell({
  issue,
  showPromoteOccupant,
  promoteBusy,
  onPromoteToWorkOrder,
}: Pick<IssueRowProps, "issue" | "showPromoteOccupant" | "promoteBusy" | "onPromoteToWorkOrder">) {
  const photoCount = issue.referencePhotos?.length ?? 0;
  const detailHref = `/projects/${issue.projectId}/issues/${issue.id}`;
  const metaLine = [
    issueSheetLabel(issue),
    issue.pageNumber != null ? `Page ${issue.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <td className="max-w-[min(420px,38vw)] px-4 py-3 align-top">
      <div className="flex gap-2">
        <MapPin
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm leading-snug">
            {issue.displayNumber != null ? (
              <span className="mr-1.5 font-mono text-[11px] font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
                #{String(issue.displayNumber).padStart(3, "0")}
              </span>
            ) : null}
            <Link
              href={detailHref}
              title={`View “${issue.title}”`}
              className="font-medium text-[var(--enterprise-text)] transition hover:text-[var(--enterprise-primary)] hover:underline"
            >
              {issue.title}
            </Link>
          </p>
          <p
            className="mt-0.5 line-clamp-1 text-[11px] text-[var(--enterprise-text-muted)]"
            title={metaLine}
          >
            {metaLine}
          </p>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {photoCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--enterprise-primary)]">
                <Camera className="h-3 w-3" strokeWidth={2} aria-hidden />
                {photoCount}
              </span>
            ) : null}
            {showPromoteOccupant && issue.issueKind === "OCCUPANT" && onPromoteToWorkOrder ? (
              <button
                type="button"
                disabled={promoteBusy}
                onClick={() => onPromoteToWorkOrder(issue.id)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)] shadow-sm hover:bg-[var(--enterprise-primary-soft)] disabled:opacity-50"
              >
                <ArrowUpCircle className="h-3 w-3" aria-hidden />
                Promote to work order
              </button>
            ) : null}
          </span>
        </div>
      </div>
    </td>
  );
}

function IssueStatusCell({
  issue,
  isPatching,
  onStatusChange,
}: Pick<IssueRowProps, "issue" | "isPatching" | "onStatusChange">) {
  return (
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
  );
}

function IssueAssigneeCell({ issue }: { issue: IssueRow }) {
  return (
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
  );
}

function IssuePriorityBadge({ priority }: { priority: string | null | undefined }) {
  const pri = priority ?? "MEDIUM";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${priorityBadgeClassLight(pri)}`}
    >
      <Flag className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      {ISSUE_PRIORITY_LABEL[pri] ?? pri}
    </span>
  );
}

function IssueDueCell({ issue, nowMs }: { issue: IssueRow; nowMs: number }) {
  if (!issue.dueDate) {
    return (
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
        <span className="inline-flex items-center gap-1.5 text-[var(--enterprise-text-muted)]">
          <Calendar className="h-4 w-4 opacity-50" strokeWidth={1.75} aria-hidden />—
        </span>
      </td>
    );
  }
  if (isIssueOverdue(issue, nowMs)) {
    return (
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--enterprise-semantic-danger-bg)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--enterprise-semantic-danger-text)]">
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Overdue · {issueOverviewShortDate(issue.dueDate)}
        </span>
      </td>
    );
  }
  return (
    <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-[var(--enterprise-text)]">
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Calendar
          className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        {issueDateToInputValue(issue.dueDate)}
      </span>
    </td>
  );
}

function IssueRowActions({
  issue,
  viewerHref,
  isDeleting,
  onEditClick,
  onDeleteClick,
}: Pick<IssueRowProps, "issue" | "isDeleting" | "onEditClick" | "onDeleteClick"> & {
  viewerHref: string | null;
}) {
  return (
    <td className="w-[1%] whitespace-nowrap px-2 py-2 align-top">
      <div className="flex items-center justify-end gap-0.5">
        <RowActionButton
          label={`Edit “${issue.title}”`}
          Icon={Pencil}
          onClick={() => onEditClick(issue)}
        />
        {viewerHref ? (
          <RowActionLink
            label={`Open “${issue.title}” in the viewer`}
            href={viewerHref}
            Icon={ExternalLink}
          />
        ) : null}
        <RowActionButton
          label={`Delete “${issue.title}”`}
          Icon={Trash2}
          danger
          disabled={isDeleting}
          onClick={() => onDeleteClick(issue)}
        />
      </div>
    </td>
  );
}

const ProjectIssueTableRow = memo(function ProjectIssueTableRow(props: IssueRowProps) {
  const { issue, nowMs } = props;
  const router = useRouter();
  const viewerHref = viewerHrefForIssue(issue);
  const detailHref = `/projects/${issue.projectId}/issues/${issue.id}`;

  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,select,input,label")) return;
        router.push(detailHref);
      }}
      className="cursor-pointer border-b border-[var(--enterprise-border)]/80 transition-colors last:border-0 hover:bg-[var(--enterprise-hover-surface)]/80"
    >
      <IssueTitleCell
        issue={issue}
        showPromoteOccupant={props.showPromoteOccupant}
        promoteBusy={props.promoteBusy}
        onPromoteToWorkOrder={props.onPromoteToWorkOrder}
      />
      <IssueStatusCell
        issue={issue}
        isPatching={props.isPatching}
        onStatusChange={props.onStatusChange}
      />
      <IssueAssigneeCell issue={issue} />
      <td className="px-4 py-3 align-top">
        <IssuePriorityBadge priority={issue.priority} />
      </td>
      <IssueDueCell issue={issue} nowMs={nowMs} />
      <IssueRowActions
        issue={issue}
        viewerHref={viewerHref}
        isDeleting={props.isDeleting}
        onEditClick={props.onEditClick}
        onDeleteClick={props.onDeleteClick}
      />
    </tr>
  );
});

function MobileCardHead({ issue }: { issue: IssueRow }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/projects/${issue.projectId}/issues/${issue.id}`}
          title={`View “${issue.title}”`}
          className="text-sm font-semibold leading-snug text-[var(--enterprise-text)] transition hover:text-[var(--enterprise-primary)] hover:underline"
        >
          {issue.title}
        </Link>
        <p className="mt-1 line-clamp-1 text-sm text-[var(--enterprise-text-muted)]">
          {issueSheetLabel(issue)}
        </p>
      </div>
      <IssuePriorityBadge priority={issue.priority} />
    </div>
  );
}

function MobileCardFields({
  issue,
  isPatching,
  onStatusChange,
}: Pick<IssueRowProps, "issue" | "isPatching" | "onStatusChange">) {
  return (
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
  );
}

function MobileCardDue({ issue, nowMs }: { issue: IssueRow; nowMs: number }) {
  if (!issue.dueDate) return null;
  const overdue = isIssueOverdue(issue, nowMs);
  return (
    <p
      className={`mt-2 flex items-center gap-1.5 text-sm tabular-nums ${
        overdue
          ? "font-semibold text-[var(--enterprise-semantic-danger-text)]"
          : "text-[var(--enterprise-text)]"
      }`}
    >
      <Calendar
        className={`h-4 w-4 shrink-0 ${overdue ? "" : "text-[var(--enterprise-text-muted)]"}`}
        strokeWidth={1.75}
      />
      {overdue
        ? `Overdue · was due ${issueOverviewShortDate(issue.dueDate)}`
        : `Due ${issueDateToInputValue(issue.dueDate)}`}
    </p>
  );
}

const MOBILE_ACTION_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] transition active:scale-[0.98] disabled:opacity-50";

function MobileCardActions({
  issue,
  viewerHref,
  isDeleting,
  showPromoteOccupant,
  promoteBusy,
  onEditClick,
  onDeleteClick,
  onPromoteToWorkOrder,
}: Pick<
  IssueRowProps,
  | "issue"
  | "isDeleting"
  | "showPromoteOccupant"
  | "promoteBusy"
  | "onEditClick"
  | "onDeleteClick"
  | "onPromoteToWorkOrder"
> & { viewerHref: string | null }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => onEditClick(issue)} className={MOBILE_ACTION_CLASS}>
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
          className={`${MOBILE_ACTION_CLASS} flex-none text-[var(--enterprise-primary)]`}
        >
          <ArrowUpCircle className="h-4 w-4" aria-hidden />
          Promote
        </button>
      ) : null}
    </div>
  );
}

const ProjectIssueMobileCard = memo(function ProjectIssueMobileCard(props: IssueRowProps) {
  const { issue, nowMs } = props;
  const viewerHref = viewerHrefForIssue(issue);
  const photoCount = issue.referencePhotos?.length ?? 0;

  return (
    <li className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 shadow-[var(--enterprise-shadow-xs)]">
      <MobileCardHead issue={issue} />
      {issue.pageNumber != null ? (
        <p className="mt-2 text-xs tabular-nums text-[var(--enterprise-text-muted)]">
          Page {issue.pageNumber}
        </p>
      ) : null}
      <MobileCardFields
        issue={issue}
        isPatching={props.isPatching}
        onStatusChange={props.onStatusChange}
      />
      <MobileCardDue issue={issue} nowMs={nowMs} />
      {photoCount > 0 ? (
        <p className="mt-2 text-xs font-medium text-[var(--enterprise-primary)]">
          {photoCount} attached photo{photoCount === 1 ? "" : "s"}
        </p>
      ) : null}
      <MobileCardActions
        issue={issue}
        viewerHref={viewerHref}
        isDeleting={props.isDeleting}
        showPromoteOccupant={props.showPromoteOccupant}
        promoteBusy={props.promoteBusy}
        onEditClick={props.onEditClick}
        onDeleteClick={props.onDeleteClick}
        onPromoteToWorkOrder={props.onPromoteToWorkOrder}
      />
    </li>
  );
});

function IssuesHeaderAction({
  canCreate,
  ctxLoading,
  isPro,
  isWorkOrders,
  createLabel,
  projectId,
  onCreateClick,
}: {
  canCreate: boolean;
  ctxLoading: boolean;
  isPro: boolean;
  isWorkOrders: boolean;
  createLabel: string;
  projectId: string;
  onCreateClick: () => void;
}) {
  return (
    <>
      {canCreate ? (
        <EnterpriseButton
          size="sm"
          disabled={ctxLoading || !isPro}
          onClick={onCreateClick}
          className={isWorkOrders ? "bg-sky-600 hover:bg-sky-700" : undefined}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          {createLabel}
        </EnterpriseButton>
      ) : null}
      <Link
        href={isWorkOrders ? `/projects/${projectId}/om/assets` : `/projects/${projectId}/files`}
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
  );
}

function IssuesPageHeader({
  listTitle,
  isPending,
  total,
  listItemNoun,
  canCreate,
  ctxLoading,
  isPro,
  isWorkOrders,
  createLabel,
  projectId,
  onCreateClick,
}: {
  listTitle: string;
  isPending: boolean;
  total: number;
  listItemNoun: string;
  canCreate: boolean;
  ctxLoading: boolean;
  isPro: boolean;
  isWorkOrders: boolean;
  createLabel: string;
  projectId: string;
  onCreateClick: () => void;
}) {
  return (
    <OmSubPageHeader
      icon={MapPin}
      title={listTitle}
      description={
        !isPending
          ? total === 0
            ? `No ${listTitle.toLowerCase()} recorded for this project yet.`
            : `${total} ${listItemNoun} in this project`
          : undefined
      }
      action={
        <IssuesHeaderAction
          canCreate={canCreate}
          ctxLoading={ctxLoading}
          isPro={isPro}
          isWorkOrders={isWorkOrders}
          createLabel={createLabel}
          projectId={projectId}
          onCreateClick={onCreateClick}
        />
      }
    />
  );
}

function IssuesTopBanners({
  showProGate,
  listItemNoun,
  filterAssetId,
  clearAssetFilterHref,
}: {
  showProGate: boolean;
  listItemNoun: string;
  filterAssetId?: string;
  clearAssetFilterHref: string | null;
}) {
  if (!showProGate && !filterAssetId) return null;
  return (
    <>
      {showProGate ? (
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
    </>
  );
}

const FILTER_LABEL_CLASS =
  "mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]";

function IssueSearchField({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[11rem] flex-1 sm:max-w-[16rem]">
      <span className={FILTER_LABEL_CLASS}>
        <Search className="h-3.5 w-3.5" aria-hidden />
        Search
      </span>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Title or sheet…"
        className={OM_COMPACT_SELECT}
      />
    </label>
  );
}

function IssuePrioritySelect({
  priorityFilter,
  onPriorityChange,
}: {
  priorityFilter: PriorityFilter;
  onPriorityChange: (value: PriorityFilter) => void;
}) {
  return (
    <label className="min-w-[8rem]">
      <span className={FILTER_LABEL_CLASS}>
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Priority
      </span>
      <select
        id="issues-priority-filter"
        value={priorityFilter}
        onChange={(e) => onPriorityChange(e.target.value as PriorityFilter)}
        className={OM_COMPACT_SELECT}
      >
        <option value="ALL">All priorities</option>
        {ISSUE_PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {ISSUE_PRIORITY_LABEL[p] ?? p}
          </option>
        ))}
      </select>
    </label>
  );
}

function IssueDueSelect({
  dueFilter,
  onDueChange,
}: {
  dueFilter: IssueDueFilter;
  onDueChange: (value: IssueDueFilter) => void;
}) {
  return (
    <label className="min-w-[8rem]">
      <span className={FILTER_LABEL_CLASS}>
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        Due
      </span>
      <select
        id="issues-due-filter"
        value={dueFilter}
        onChange={(e) => onDueChange(e.target.value as IssueDueFilter)}
        className={OM_COMPACT_SELECT}
      >
        <option value="ALL">Any due date</option>
        <option value="OVERDUE">Overdue</option>
        <option value="THIS_WEEK">Due this week</option>
        <option value="NONE">No due date</option>
      </select>
    </label>
  );
}

type IssuesFilterBarProps = {
  filter: StatusFilter;
  onFilterChange: (key: StatusFilter) => void;
  filtersActive: boolean;
  onReset: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  priorityFilter: PriorityFilter;
  onPriorityChange: (value: PriorityFilter) => void;
  dueFilter: IssueDueFilter;
  onDueChange: (value: IssueDueFilter) => void;
  assigneeFilter: AssigneeFilter;
  onAssigneeChange: (value: AssigneeFilter) => void;
  sort: IssueListSortKey;
  onSortChange: (value: IssueListSortKey) => void;
  members: WorkspaceMemberRow[];
};

function IssuesFilterBar(props: IssuesFilterBarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 pb-3 backdrop-blur-md lg:static lg:bg-transparent">
      <StatusFilterChips
        defs={ISSUE_FILTER_DEFS}
        value={props.filter}
        onChange={props.onFilterChange}
        filtersActive={props.filtersActive}
        onReset={props.onReset}
      />
      <div className="flex flex-wrap items-end gap-2">
        <IssueSearchField search={props.search} onSearchChange={props.onSearchChange} />
        <IssuePrioritySelect
          priorityFilter={props.priorityFilter}
          onPriorityChange={props.onPriorityChange}
        />
        <IssueDueSelect dueFilter={props.dueFilter} onDueChange={props.onDueChange} />
        <AssigneeFilterSelect
          id="issues-assignee-filter"
          value={props.assigneeFilter}
          onChange={props.onAssigneeChange}
          members={props.members}
        />
        <SortSelect
          id="issues-sort"
          value={props.sort}
          onChange={props.onSortChange}
          options={ISSUE_SORT_OPTIONS}
        />
      </div>
    </div>
  );
}

function IssuesResultsLine({
  show,
  filteredCount,
  totalCount,
  listItemNoun,
  filtersActive,
  patchPending,
}: {
  show: boolean;
  filteredCount: number;
  totalCount: number;
  listItemNoun: string;
  filtersActive: boolean;
  patchPending: boolean;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--enterprise-text-muted)]">
      <p>
        Showing{" "}
        <span className="font-semibold text-[var(--enterprise-text)] tabular-nums">
          {filteredCount}
        </span>
        {filteredCount !== totalCount ? (
          <>
            {" "}
            of{" "}
            <span className="font-semibold text-[var(--enterprise-text)] tabular-nums">
              {totalCount}
            </span>
          </>
        ) : null}{" "}
        {listItemNoun}
        {filtersActive ? (
          <span className="text-[var(--enterprise-text-muted)]"> (filtered)</span>
        ) : null}
      </p>
      {patchPending ? (
        <span className="text-xs font-medium text-[var(--enterprise-text-muted)]">
          Updating status…
        </span>
      ) : null}
    </div>
  );
}

function IssuesMsgBanner({ msg, onDismiss }: { msg: string | null; onDismiss: () => void }) {
  if (!msg) return null;
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      <span className="min-w-0 flex-1 leading-relaxed">{msg}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-900/80 underline-offset-2 hover:bg-red-100/60 hover:text-red-950 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

function IssuesTableHead() {
  return (
    <thead>
      <tr className="border-b border-[var(--enterprise-border)]">
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Issue
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Status
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Assignee
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Priority
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Due
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="flex items-center justify-end gap-1.5">
            <ExternalLink className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Actions
          </span>
        </th>
      </tr>
    </thead>
  );
}

type IssuesListsProps = {
  isPending: boolean;
  listTitle: string;
  filtered: IssueRow[];
  totalCount: number;
  projectId: string;
  entitySingular: string;
  canCreate: boolean;
  onCreateClick: () => void;
  ListIcon: LucideIcon;
  isWorkOrders: boolean;
  nowMs: number;
  patchingIssueId: string | null;
  deletingIssueId: string | null;
  promotingIssueId: string | null;
  canPromoteOccupant: boolean;
  onStatusChange: (issueId: string, status: string) => void;
  onDeleteClick: (issue: IssueRow) => void;
  onEditClick: (issue: IssueRow) => void;
  onPromote: (issueId: string) => void;
};

function IssuesLoadingCard() {
  return (
    <div className="enterprise-card py-16">
      <EnterpriseLoadingState
        variant="minimal"
        message="Loading issues…"
        label="Loading project issues"
      />
    </div>
  );
}

function IssuesMobileList({
  listTitle,
  filtered,
  empty,
  rowPropsFor,
}: {
  listTitle: string;
  filtered: IssueRow[];
  empty: React.ReactNode;
  rowPropsFor: (issue: IssueRow) => IssueRowProps;
}) {
  return (
    <ul className="space-y-3 lg:hidden" aria-label={listTitle}>
      {filtered.length === 0 ? (
        <li className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
          {empty}
        </li>
      ) : (
        filtered.map((issue) => <ProjectIssueMobileCard key={issue.id} {...rowPropsFor(issue)} />)
      )}
    </ul>
  );
}

function IssuesDesktopTable({
  filtered,
  empty,
  rowPropsFor,
}: {
  filtered: IssueRow[];
  empty: React.ReactNode;
  rowPropsFor: (issue: IssueRow) => IssueRowProps;
}) {
  return (
    <div className="enterprise-card hidden overflow-hidden rounded-2xl p-0 lg:block">
      <div className="mobile-table-wrap max-h-[calc(100dvh-15rem)] overflow-auto">
        <table className="w-full min-w-[720px] text-left">
          <IssuesTableHead />
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              filtered.map((issue) => (
                <ProjectIssueTableRow key={issue.id} {...rowPropsFor(issue)} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssuesLists(props: IssuesListsProps) {
  if (props.isPending) return <IssuesLoadingCard />;

  const empty = (
    <IssueEmptyState
      noRows={props.totalCount === 0}
      projectId={props.projectId}
      entityLabel={props.entitySingular}
      canCreate={props.canCreate}
      onCreateClick={props.onCreateClick}
      emptyIcon={props.ListIcon}
      emptyHint={
        props.isWorkOrders
          ? "Create a work order tied to project equipment, or generate one from maintenance schedules."
          : undefined
      }
    />
  );

  const rowPropsFor = (issue: IssueRow): IssueRowProps => ({
    issue,
    nowMs: props.nowMs,
    isPatching: props.patchingIssueId === issue.id,
    isDeleting: props.deletingIssueId === issue.id,
    onStatusChange: props.onStatusChange,
    onDeleteClick: props.onDeleteClick,
    onEditClick: props.onEditClick,
    showPromoteOccupant: props.canPromoteOccupant,
    onPromoteToWorkOrder: props.onPromote,
    promoteBusy: props.promotingIssueId === issue.id,
  });

  return (
    <>
      <IssuesMobileList
        listTitle={props.listTitle}
        filtered={props.filtered}
        empty={empty}
        rowPropsFor={rowPropsFor}
      />
      <IssuesDesktopTable filtered={props.filtered} empty={empty} rowPropsFor={rowPropsFor} />
    </>
  );
}

type IssuesSlideOversProps = {
  isWorkOrders: boolean;
  createOpen: boolean;
  editOpen: boolean;
  editingIssue: IssueRow | null;
  deleteConfirmIssue: IssueRow | null;
  deletePending: boolean;
  entitySingular: string;
  projectId: string;
  workspaceId: string | undefined;
  wid: string | undefined;
  isPro: boolean;
  members: WorkspaceMemberRow[];
  filterAssetId?: string;
  onCreated: () => void;
  onCreateClose: () => void;
  onEditClose: () => void;
  onSaved: (row: IssueRow) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
};

function IssuesSlideOvers(props: IssuesSlideOversProps) {
  const createOver = props.isWorkOrders ? (
    <WorkOrderCreateSlideOver
      open={props.createOpen}
      onClose={props.onCreateClose}
      projectId={props.projectId}
      workspaceId={props.workspaceId}
      members={props.members}
      initialAssetId={props.filterAssetId}
      onCreated={props.onCreated}
    />
  ) : (
    <IssueCreateSlideOver
      open={props.createOpen}
      onClose={props.onCreateClose}
      projectId={props.projectId}
      workspaceId={props.workspaceId}
      wid={props.wid}
      isPro={props.isPro}
      members={props.members}
      onCreated={props.onCreated}
    />
  );
  const editOver = props.isWorkOrders ? (
    <WorkOrderEditSlideOver
      open={props.editOpen}
      issue={props.editingIssue}
      projectId={props.projectId}
      onClose={props.onEditClose}
      members={props.members}
      onSaved={props.onSaved}
    />
  ) : (
    <IssueEditSlideOver
      open={props.editOpen}
      issue={props.editingIssue}
      onClose={props.onEditClose}
      members={props.members}
      onSaved={props.onSaved}
    />
  );
  return (
    <>
      {createOver}
      {editOver}
      <DeleteProjectIssueConfirmDialog
        open={Boolean(props.deleteConfirmIssue)}
        title={props.deleteConfirmIssue?.title ?? ""}
        entityLabel={props.entitySingular}
        isDeleting={props.deletePending}
        onCancel={props.onDeleteCancel}
        onConfirm={props.onDeleteConfirm}
      />
    </>
  );
}

function usePatchIssueMut(mergeRow: (row: IssueRow) => void, setMsg: (m: string | null) => void) {
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);
  const patchMut = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      patchIssue(vars.id, { status: vars.status }),
    onMutate: (vars) => setPatchingIssueId(vars.id),
    onSuccess: mergeRow,
    onError: (e: Error) => {
      setMsg(e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e));
      toastIssueActionError(e);
    },
    onSettled: () => setPatchingIssueId(null),
  });
  return { patchMut, patchingIssueId };
}

function usePromoteIssueMut(
  qc: QueryClient,
  projectId: string,
  setMsg: (m: string | null) => void,
) {
  const [promotingIssueId, setPromotingIssueId] = useState<string | null>(null);
  const promoteMut = useMutation({
    mutationFn: (id: string) => patchIssue(id, { issueKind: "WORK_ORDER" }),
    onMutate: setPromotingIssueId,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["issues", "project", projectId], exact: false });
      await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
      toast.success("Promoted to work order.");
      setMsg(null);
    },
    onError: toastIssueActionError,
    onSettled: () => setPromotingIssueId(null),
  });
  return { promoteMut, promotingIssueId };
}

function useDeleteIssueMut(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  entitySingular: string,
  setMsg: (m: string | null) => void,
) {
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deleteConfirmIssue, setDeleteConfirmIssue] = useState<IssueRow | null>(null);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onMutate: setDeletingIssueId,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: issuesKey });
      await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
      setDeleteConfirmIssue(null);
      toast.success(`${entitySingular.charAt(0).toUpperCase()}${entitySingular.slice(1)} deleted.`);
      setMsg(null);
    },
    onError: toastIssueActionError,
    onSettled: () => setDeletingIssueId(null),
  });
  const confirmDelete = useCallback(() => {
    if (deleteConfirmIssue) deleteMut.mutate(deleteConfirmIssue.id);
  }, [deleteConfirmIssue, deleteMut]);
  const cancelDelete = useCallback(() => setDeleteConfirmIssue(null), []);
  return {
    deleteMut,
    deletingIssueId,
    deleteConfirmIssue,
    setDeleteConfirmIssue,
    confirmDelete,
    cancelDelete,
  };
}

function useIssueListMutations(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  projectId: string,
  entitySingular: string,
) {
  const [msg, setMsg] = useState<string | null>(null);
  const mergeRow = useCallback(
    (row: IssueRow) => {
      mergeIssueRowIntoLists(qc, issuesKey, row);
      setMsg(null);
    },
    [qc, issuesKey],
  );
  const patch = usePatchIssueMut(mergeRow, setMsg);
  const promote = usePromoteIssueMut(qc, projectId, setMsg);
  const del = useDeleteIssueMut(qc, issuesKey, entitySingular, setMsg);
  return { msg, setMsg, mergeRow, ...patch, ...promote, ...del };
}

function useIssueFilterState() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<IssueListSortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [dueFilter, setDueFilter] = useState<IssueDueFilter>("ALL");
  const [search, setSearch] = useState("");
  return {
    filter,
    setFilter,
    sort,
    setSort,
    assigneeFilter,
    setAssigneeFilter,
    priorityFilter,
    setPriorityFilter,
    dueFilter,
    setDueFilter,
    search,
    setSearch,
  };
}

type IssueFilterState = ReturnType<typeof useIssueFilterState>;

function useClearIssueFilters(
  fs: IssueFilterState,
  filterAssetId: string | undefined,
  pathname: string | null,
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  const clearAssetFilterHref = useMemo(() => {
    if (!filterAssetId || !pathname) return null;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("assetId");
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [filterAssetId, pathname, searchParams]);

  const clearFilters = useCallback(() => {
    fs.setFilter("ALL");
    fs.setAssigneeFilter("ALL");
    fs.setPriorityFilter("ALL");
    fs.setDueFilter("ALL");
    fs.setSearch("");
    fs.setSort("newest");
    if (clearAssetFilterHref && pathname) router.replace(clearAssetFilterHref);
  }, [fs, clearAssetFilterHref, pathname, router]);

  return { clearFilters, clearAssetFilterHref };
}

function useIssueSlideOvers(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  mergeRow: (row: IssueRow) => void,
  setMsg: (m: string | null) => void,
) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueRow | null>(null);

  const openCreateForm = useCallback(() => setCreateOpen(true), []);
  const closeCreateForm = useCallback(() => setCreateOpen(false), []);
  const openEditForm = useCallback((issue: IssueRow) => {
    setEditingIssue(issue);
    setEditOpen(true);
  }, []);
  const closeEditForm = useCallback(() => {
    setEditOpen(false);
    setEditingIssue(null);
  }, []);

  const handleIssueCreated = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: issuesKey });
    await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
    setCreateOpen(false);
    setMsg(null);
  }, [qc, issuesKey, setMsg]);

  const handleIssueSaved = useCallback(
    (row: IssueRow) => {
      mergeRow(row);
      setEditingIssue(row);
    },
    [mergeRow],
  );

  return {
    createOpen,
    editOpen,
    editingIssue,
    openCreateForm,
    closeCreateForm,
    openEditForm,
    closeEditForm,
    handleIssueCreated,
    handleIssueSaved,
  };
}

function useProjectIssuesData(
  projectId: string,
  issueKindFilter: IssueKind,
  filterAssetId: string | undefined,
) {
  const issuesKey = qk.issuesForProject(projectId, undefined, issueKindFilter, filterAssetId);
  const { data: items = [], isPending } = useQuery({
    queryKey: issuesKey,
    queryFn: () =>
      fetchIssuesForProject(projectId, { issueKind: issueKindFilter, assetId: filterAssetId }),
  });
  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });
  const canPromoteOccupant = Boolean(
    issueKindFilter === "OCCUPANT" && projectSession && !projectSession.isExternal,
  );
  return { issuesKey, items, isPending, canPromoteOccupant };
}

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
  const nowMs = useTickNowMs();
  const labels = issueEntityLabels(issueKindFilter);

  const fs = useIssueFilterState();
  const data = useProjectIssuesData(projectId, issueKindFilter, filterAssetId);
  const { workspaceId, members } = useProjectWorkspaceMembers(projectId);
  const mut = useIssueListMutations(qc, data.issuesKey, projectId, labels.entitySingular);
  const so = useIssueSlideOvers(qc, data.issuesKey, mut.mergeRow, mut.setMsg);
  const { clearFilters, clearAssetFilterHref } = useClearIssueFilters(
    fs,
    filterAssetId,
    pathname,
    router,
    searchParams,
  );

  const filtered = useMemo(
    () =>
      filterIssueRows(data.items, {
        status: fs.filter,
        assignee: fs.assigneeFilter,
        sort: fs.sort,
        priority: fs.priorityFilter,
        due: fs.dueFilter,
        search: fs.search,
        nowMs,
      }),
    [data.items, fs, nowMs],
  );

  const filtersActive = issueFiltersAreActive({
    status: fs.filter,
    assignee: fs.assigneeFilter,
    priority: fs.priorityFilter,
    due: fs.dueFilter,
    search: fs.search,
    sort: fs.sort,
    assetId: filterAssetId,
  });

  return (
    <div className={`${OM_PAGE_CLASS} w-full min-w-0 max-w-full`}>
      <IssuesPageHeader
        listTitle={listTitle}
        isPending={data.isPending}
        total={data.items.length}
        listItemNoun={labels.listItemNoun}
        canCreate={labels.canCreate}
        ctxLoading={ctxLoading}
        isPro={isPro}
        isWorkOrders={labels.isWorkOrders}
        createLabel={labels.createLabel}
        projectId={projectId}
        onCreateClick={so.openCreateForm}
      />
      <IssuesTopBanners
        showProGate={labels.canCreate && !isPro}
        listItemNoun={labels.listItemNoun}
        filterAssetId={filterAssetId}
        clearAssetFilterHref={clearAssetFilterHref}
      />
      {!data.isPending && data.items.length > 0 ? (
        <IssuesOverview
          projectId={projectId}
          items={data.items}
          statusFilter={fs.filter}
          onStatusFilterChange={(key) => fs.setFilter(key as StatusFilter)}
        />
      ) : null}
      <IssuesFilterBar
        filter={fs.filter}
        onFilterChange={fs.setFilter}
        filtersActive={filtersActive}
        onReset={clearFilters}
        search={fs.search}
        onSearchChange={fs.setSearch}
        priorityFilter={fs.priorityFilter}
        onPriorityChange={fs.setPriorityFilter}
        dueFilter={fs.dueFilter}
        onDueChange={fs.setDueFilter}
        assigneeFilter={fs.assigneeFilter}
        onAssigneeChange={fs.setAssigneeFilter}
        sort={fs.sort}
        onSortChange={fs.setSort}
        members={members}
      />
      <IssuesResultsLine
        show={!data.isPending && data.items.length > 0}
        filteredCount={filtered.length}
        totalCount={data.items.length}
        listItemNoun={labels.listItemNoun}
        filtersActive={filtersActive}
        patchPending={mut.patchMut.isPending}
      />
      <IssuesMsgBanner msg={mut.msg} onDismiss={() => mut.setMsg(null)} />
      <IssuesLists
        isPending={data.isPending}
        listTitle={listTitle}
        filtered={filtered}
        totalCount={data.items.length}
        projectId={projectId}
        entitySingular={labels.entitySingular}
        canCreate={labels.canCreate && isPro}
        onCreateClick={so.openCreateForm}
        ListIcon={labels.ListIcon}
        isWorkOrders={labels.isWorkOrders}
        nowMs={nowMs}
        patchingIssueId={mut.patchingIssueId}
        deletingIssueId={mut.deletingIssueId}
        promotingIssueId={mut.promotingIssueId}
        canPromoteOccupant={data.canPromoteOccupant}
        onStatusChange={(issueId, status) => mut.patchMut.mutate({ id: issueId, status })}
        onDeleteClick={mut.setDeleteConfirmIssue}
        onEditClick={so.openEditForm}
        onPromote={mut.promoteMut.mutate}
      />
      <IssuesSlideOvers
        isWorkOrders={labels.isWorkOrders}
        createOpen={so.createOpen}
        editOpen={so.editOpen}
        editingIssue={so.editingIssue}
        deleteConfirmIssue={mut.deleteConfirmIssue}
        deletePending={mut.deleteMut.isPending}
        entitySingular={labels.entitySingular}
        projectId={projectId}
        workspaceId={workspaceId}
        wid={wid}
        isPro={isPro}
        members={members}
        filterAssetId={filterAssetId}
        onCreated={so.handleIssueCreated}
        onCreateClose={so.closeCreateForm}
        onEditClose={so.closeEditForm}
        onSaved={so.handleIssueSaved}
        onDeleteCancel={mut.cancelDelete}
        onDeleteConfirm={mut.confirmDelete}
      />
    </div>
  );
}
