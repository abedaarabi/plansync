/**
 * Desktop table row for one issue.
 *
 * Columns: title (+ sheet meta / photos / promote), status select, assignee,
 * priority, due (overdue chip), icon actions. Clicking non-interactive cells
 * navigates to the issue detail page.
 */

"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  Calendar,
  ExternalLink,
  Flag,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { viewerHrefForIssue, type IssueRow } from "@/lib/api-client";
import { issueSheetLabel } from "@/lib/issueListFilters";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { isIssueOverdue, issueOverviewShortDate } from "@/lib/issuesOverviewStats";
import { IssueReferencePhotoThumb } from "./IssueReferencePhotoThumb";
import {
  ROW_ACTION_CLASS,
  ROW_ACTION_DANGER_CLASS,
  type IssueRowProps,
  type RowActionProps,
} from "./issueRowShared";

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

function RowActionLink({
  label,
  href,
  Icon,
}: {
  label: string;
  href: string;
  Icon: RowActionProps["Icon"];
}) {
  return (
    <Link href={href} title={label} aria-label={label} className={ROW_ACTION_CLASS}>
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

function IssueTitleCell({
  issue,
  showPromoteOccupant,
  promoteBusy,
  onPromoteToWorkOrder,
}: Pick<IssueRowProps, "issue" | "showPromoteOccupant" | "promoteBusy" | "onPromoteToWorkOrder">) {
  const photos = issue.referencePhotos ?? [];
  const firstPhoto = photos[0];
  const detailHref = `/projects/${issue.projectId}/issues/${issue.id}`;
  const metaLine = [
    issueSheetLabel(issue),
    issue.pageNumber != null ? `Page ${issue.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <td className="max-w-[min(420px,38vw)] px-4 py-3 align-top">
      <div className="flex gap-2.5">
        {firstPhoto ? (
          <IssueReferencePhotoThumb
            issueId={issue.id}
            photo={firstPhoto}
            extraCount={Math.max(0, photos.length - 1)}
          />
        ) : (
          <MapPin
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
            strokeWidth={1.75}
            aria-hidden
          />
        )}
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
          {showPromoteOccupant && issue.issueKind === "OCCUPANT" && onPromoteToWorkOrder ? (
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={promoteBusy}
                onClick={() => onPromoteToWorkOrder(issue.id)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-primary-soft)] disabled:opacity-50"
              >
                <ArrowUpCircle className="h-3 w-3" aria-hidden />
                Promote to work order
              </button>
            </span>
          ) : null}
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
          className={`w-full max-w-[14rem] cursor-pointer rounded-lg border-0 px-2.5 py-2 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 ${issueStatusBadgeClassLight(issue.status)}`}
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

export function IssuePriorityBadge({ priority }: { priority: string | null | undefined }) {
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

export const ProjectIssueTableRow = memo(function ProjectIssueTableRow(props: IssueRowProps) {
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
