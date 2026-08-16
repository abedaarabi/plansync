"use client";

import type { ReactNode } from "react";
import { Calendar, MapPin, MessageSquare, Paperclip } from "lucide-react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { ISSUE_STATUS_LABEL, issueStatusDotSolidFill } from "@/lib/issueStatusStyle";
import {
  formatIssueDueDate,
  isIssueDueOverdue,
  issueAttachmentCount,
  issueCommentCount,
  issueDisplayCode,
  issueKindBadgeClass,
  issueKindDisplayLabel,
  issueLocationLabel,
  issuePriorityBadgeClass,
  issuePriorityLabel,
  issueStatusBadgeClassBim,
  issueUserInitials,
} from "@/lib/bim/bimIssueMarkerUtils";

function MetaPill(props: {
  icon?: ReactNode;
  label: string;
  tone?: "default" | "danger";
  title?: string;
}) {
  const toneClass =
    props.tone === "danger"
      ? "border-[color-mix(in_srgb,var(--bim-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--bim-danger)_10%,var(--bim-panel))] text-[var(--bim-danger)]"
      : "border-[var(--bim-border)] bg-[var(--bim-hover)] text-[var(--bim-text-muted)]";

  return (
    <span
      title={props.title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium ${toneClass}`}
    >
      {props.icon}
      <span className="truncate">{props.label}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = issueStatusDotSolidFill(status.toUpperCase());
  const label =
    ISSUE_STATUS_LABEL[status] ??
    ISSUE_STATUS_LABEL[status.toUpperCase()] ??
    status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] ${issueStatusBadgeClassBim(status)}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function AssigneeChip({ name, image }: { name: string | null | undefined; image?: string | null }) {
  const display = name?.trim() || "Unassigned";

  return (
    <MetaPill
      title={`Assigned to ${display}`}
      label={display}
      icon={
        name?.trim() ? (
          image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-3.5 w-3.5 shrink-0 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--bim-hover)] text-[7px] font-bold text-[var(--bim-text)]">
              {issueUserInitials(name)}
            </span>
          )
        ) : (
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--bim-hover)] text-[7px] text-[var(--bim-text-subtle)]">
            ?
          </span>
        )
      }
    />
  );
}

function IssueReferencePhotoBanner(props: {
  photoUrl: string;
  compact?: boolean;
  bleed?: boolean;
  onPhotoClick?: () => void;
}) {
  const sizeClass = props.compact ? "max-h-28" : "max-h-40";
  const bleedClass = props.bleed
    ? props.compact
      ? "-mx-2.5 -mt-2.5 mb-2 w-[calc(100%+1.25rem)] rounded-none"
      : "-mx-3 -mt-3 mb-2.5 w-[calc(100%+1.5rem)] rounded-none"
    : "rounded-xl";

  return (
    <button
      type="button"
      aria-label="Preview reference photo — shows where this issue was captured"
      title="Preview site photo"
      onClick={(e) => {
        e.stopPropagation();
        props.onPhotoClick?.();
      }}
      className={`bim-focus-ring group relative block aspect-[16/10] w-full overflow-hidden ring-1 ring-white/10 ${sizeClass} ${bleedClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={props.photoUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2.5 pb-2 pt-10 text-left">
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/90">
          Site reference
        </span>
        <span className="mt-0.5 block text-[10px] text-white/70">Tap to enlarge</span>
      </span>
    </button>
  );
}

function DueDateChip({ issue }: { issue: IssueRow }) {
  const due = formatIssueDueDate(issue.dueDate);
  if (!due) return null;
  const overdue = isIssueDueOverdue(issue);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium ${
        overdue
          ? "border-[color-mix(in_srgb,var(--bim-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--bim-danger)_10%,var(--bim-panel))] text-[var(--bim-danger)]"
          : "border-[var(--bim-border)] bg-[var(--bim-hover)] text-[var(--bim-text-muted)]"
      }`}
    >
      <Calendar className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="whitespace-nowrap">
        {overdue ? "Overdue · " : "Due · "}
        {due}
      </span>
    </span>
  );
}

// fallow-ignore-next-line complexity
export function BimIssueSummaryBody(props: {
  issue: IssueRow;
  photoUrl?: string | null;
  onPhotoClick?: () => void;
  onOpen?: () => void;
  compact?: boolean;
  bleedPhoto?: boolean;
  className?: string;
}) {
  const { issue } = props;
  const location = issueLocationLabel(issue);
  const attachments = issueAttachmentCount(issue);
  const comments = issueCommentCount(issue);
  const assigneeName = issue.assignee?.name ?? issue.externalAssigneeName;
  const titleClass = props.compact
    ? "line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--bim-text)]"
    : "line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--bim-text)]";
  const bodyClass = props.compact
    ? "line-clamp-2 text-[10px] leading-relaxed text-[var(--bim-text-muted)]"
    : "line-clamp-2 text-[11px] leading-relaxed text-[var(--bim-text-muted)]";
  const showPhotoBanner = Boolean(props.photoUrl);

  const details = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold tabular-nums tracking-tight text-[var(--bim-text-subtle)]">
            {issueDisplayCode(issue)}
          </span>
          <StatusBadge status={issue.status} />
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${issueKindBadgeClass(issue.issueKind)}`}
          >
            {issueKindDisplayLabel(issue.issueKind)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${issuePriorityBadgeClass(issue.priority)}`}
          >
            {issuePriorityLabel(issue.priority)}
          </span>
        </div>
        <DueDateChip issue={issue} />
      </div>

      <div>
        <h3 className={titleClass}>{issue.title}</h3>
        {issue.description?.trim() ? (
          <p className={`mt-1 ${bodyClass}`}>{issue.description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <AssigneeChip name={assigneeName} image={issue.assignee?.image} />
        {comments > 0 ? (
          <MetaPill
            icon={<MessageSquare className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
            label={String(comments)}
            title={`${comments} comment${comments === 1 ? "" : "s"}`}
          />
        ) : null}
        {attachments > 0 ? (
          <MetaPill
            icon={<Paperclip className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
            label={String(attachments)}
            title={`${attachments} attachment${attachments === 1 ? "" : "s"}`}
          />
        ) : null}
        {location ? (
          <MetaPill
            icon={<MapPin className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
            label={location}
            title={location}
          />
        ) : null}
      </div>
    </>
  );

  return (
    <div className={`flex flex-col gap-2 ${props.className ?? ""}`}>
      {showPhotoBanner ? (
        <IssueReferencePhotoBanner
          photoUrl={props.photoUrl!}
          compact={props.compact}
          bleed={props.bleedPhoto ?? true}
          onPhotoClick={props.onPhotoClick}
        />
      ) : null}

      {props.onOpen ? (
        <button type="button" onClick={props.onOpen} className="bim-focus-ring w-full text-left">
          <div className="flex flex-col gap-2">{details}</div>
        </button>
      ) : (
        details
      )}
    </div>
  );
}
