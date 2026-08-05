/**
 * Mobile card for one issue (shown below the `lg` breakpoint).
 * Same actions as the desktop row, but with larger touch targets.
 */

"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowUpCircle, Calendar, ExternalLink, Pencil, Trash2, UserRound } from "lucide-react";
import { viewerHrefForIssue } from "@/lib/api-client";
import { issueSheetLabel } from "@/lib/issueListFilters";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { isIssueOverdue, issueOverviewShortDate } from "@/lib/issuesOverviewStats";
import { MOBILE_FIELD_SELECT } from "@/lib/mobileFormStyles";
import { IssueReferencePhotoThumb } from "./IssueReferencePhotoThumb";
import { IssuePriorityBadge } from "./ProjectIssueTableRow";
import type { IssueRowProps } from "./issueRowShared";

function MobileCardHead({ issue }: Pick<IssueRowProps, "issue">) {
  const photos = issue.referencePhotos ?? [];
  const firstPhoto = photos[0];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 gap-2.5">
        {firstPhoto ? (
          <IssueReferencePhotoThumb
            issueId={issue.id}
            photo={firstPhoto}
            extraCount={Math.max(0, photos.length - 1)}
          />
        ) : null}
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

function MobileCardDue({ issue, nowMs }: Pick<IssueRowProps, "issue" | "nowMs">) {
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

export const ProjectIssueMobileCard = memo(function ProjectIssueMobileCard(props: IssueRowProps) {
  const { issue, nowMs } = props;
  const viewerHref = viewerHrefForIssue(issue);

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
