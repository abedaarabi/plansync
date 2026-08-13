"use client";

import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Flag,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Play,
  Wrench,
} from "lucide-react";
import { OmAssigneeAvatar } from "@/components/enterprise/OmAssigneePicker";
import type { IssueRow } from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";
import { formatWorkOrderNumber, workOrderSlaInfo } from "@/lib/workOrderSla";
import { useTickNowMs } from "@/lib/useTickNowMs";

const WO_TYPE_LABEL: Record<string, string> = {
  CORRECTIVE: "Corrective",
  PREVENTIVE: "Preventive",
  INSPECTION_FOLLOWUP: "Inspection",
  TENANT: "Tenant",
  OCCUPANT: "Occupant",
};

const ROW_ACTION =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40";

/** Matches `enterprise-btn-primary` density for table row CTAs. */
const ROW_ACTION_PRIMARY =
  "inline-flex h-8 items-center gap-1 rounded-md bg-[var(--enterprise-primary)] px-2.5 text-xs font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40";

function dueLabel(dueDate: string | null | undefined): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No due date", overdue: false };
  const d = new Date(dueDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const overdue = d < today;
  return {
    text: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
    overdue,
  };
}

function placeLine(wo: IssueRow): string {
  const parts = [wo.buildingName?.trim(), wo.levelName, wo.location?.trim()].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  );
  return parts.join(" · ") || "No location";
}

function workOrderRowModel(wo: IssueRow, nowMs: number) {
  const pri = (wo.priority ?? "MEDIUM").toUpperCase();
  const due = dueLabel(wo.dueDate);
  const isActive = wo.status === "OPEN" || wo.status === "IN_PROGRESS";
  const isOverdue = due.overdue && isActive;
  const sla = workOrderSlaInfo(wo, nowMs);
  const typeLabel = wo.workOrderType ? (WO_TYPE_LABEL[wo.workOrderType] ?? wo.workOrderType) : null;
  const place = placeLine(wo);
  const assigneeName = wo.assignee?.name?.trim() || wo.assignee?.email || null;
  return { pri, due, isActive, isOverdue, sla, typeLabel, place, assigneeName };
}

/** Left rail — same semantics as `priorityBadgeClassLight` (medium = brand blue). */
function priorityAccentClass(priority: string): string {
  switch (priority.toUpperCase()) {
    case "HIGH":
    case "CRITICAL":
      return "bg-[var(--enterprise-semantic-danger-muted)]";
    case "LOW":
      return "bg-[var(--enterprise-border)]";
    default:
      return "bg-[var(--enterprise-primary)]";
  }
}

function slaToneClass(tone: "ok" | "warn" | "danger" | undefined): string {
  if (tone === "danger") return "text-[var(--enterprise-semantic-danger-text)]";
  if (tone === "warn") return "text-[var(--enterprise-semantic-warning-text)]";
  if (tone === "ok") return "text-[var(--enterprise-semantic-success-text)]";
  return "text-[var(--enterprise-text-muted)]";
}

export type WorkOrdersTableProps = {
  rows: IssueRow[];
  highlightId?: string | null;
  onEdit: (wo: IssueRow) => void;
  onComplete: (wo: IssueRow) => void;
  onStart: (wo: IssueRow) => void;
  onMoreActions?: (wo: IssueRow) => void;
};

function RowActions({
  wo,
  isActive,
  onEdit,
  onComplete,
  onStart,
  onMoreActions,
  alwaysVisible,
}: {
  wo: IssueRow;
  isActive: boolean;
  onEdit: (wo: IssueRow) => void;
  onComplete: (wo: IssueRow) => void;
  onStart: (wo: IssueRow) => void;
  onMoreActions?: (wo: IssueRow) => void;
  alwaysVisible?: boolean;
}) {
  const desktopCluster = (
    <>
      {wo.status === "OPEN" ? (
        <button
          type="button"
          className={ROW_ACTION_PRIMARY}
          onClick={() => onStart(wo)}
          aria-label="Start work order"
        >
          <Play className="h-3 w-3" fill="currentColor" aria-hidden />
          Start
        </button>
      ) : null}
      {isActive ? (
        <button
          type="button"
          className={ROW_ACTION}
          onClick={() => onComplete(wo)}
          title="Complete"
          aria-label="Complete work order"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={ROW_ACTION}
        onClick={() => onEdit(wo)}
        title="Edit"
        aria-label="Edit work order"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
    </>
  );

  if (alwaysVisible) {
    return <div className="inline-flex items-center justify-end gap-0.5">{desktopCluster}</div>;
  }

  return (
    <div className="inline-flex items-center justify-end gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
      {onMoreActions ? (
        <button
          type="button"
          className={`${ROW_ACTION} sm:hidden`}
          onClick={() => onMoreActions(wo)}
          aria-label="Work order actions"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <div className="hidden items-center gap-0.5 sm:inline-flex">{desktopCluster}</div>
    </div>
  );
}

// fallow-ignore-next-line complexity
function WorkOrderDesktopRow({
  wo,
  highlighted,
  nowMs,
  onEdit,
  onComplete,
  onStart,
  onMoreActions,
}: {
  wo: IssueRow;
  highlighted: boolean;
  nowMs: number;
  onEdit: (wo: IssueRow) => void;
  onComplete: (wo: IssueRow) => void;
  onStart: (wo: IssueRow) => void;
  onMoreActions?: (wo: IssueRow) => void;
}) {
  const { pri, due, isActive, isOverdue, sla, typeLabel, place, assigneeName } = workOrderRowModel(
    wo,
    nowMs,
  );

  return (
    <tr
      id={`wo-${wo.id}`}
      className={`group border-b border-[var(--enterprise-border)]/70 transition hover:bg-[var(--enterprise-hover-surface)]/60 ${
        highlighted ? "bg-[var(--enterprise-primary-soft)]/35" : ""
      }`}
    >
      <td className="relative w-1 p-0">
        <span
          className={`absolute inset-y-2 left-0 w-[3px] rounded-full ${priorityAccentClass(pri)}`}
          aria-hidden
        />
      </td>

      <td className="min-w-[18rem] cursor-pointer px-3 py-3.5 sm:px-4" onClick={() => onEdit(wo)}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
            <Wrench className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-md border border-[var(--enterprise-primary)]/25 bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-[var(--enterprise-primary)]">
                {formatWorkOrderNumber(wo)}
              </span>
              {typeLabel ? (
                <span className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  {typeLabel}
                </span>
              ) : null}
              {isOverdue ? (
                <span className="enterprise-badge-danger inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold">
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Overdue
                </span>
              ) : null}
            </div>
            <p
              className="mt-1 truncate text-sm font-semibold leading-snug text-[var(--enterprise-text)]"
              title={wo.title}
            >
              {wo.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--enterprise-text-muted)]">
              <span className="inline-flex min-w-0 max-w-[16rem] items-center gap-1 truncate">
                <MapPin
                  className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="truncate" title={place}>
                  {place}
                </span>
              </span>
              {wo.asset ? (
                <span className="inline-flex min-w-0 max-w-[10rem] items-center gap-1 truncate">
                  <Package className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate font-mono font-semibold text-[var(--enterprise-text)]">
                    {wo.asset.tag}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </td>

      <td
        className="min-w-[9rem] cursor-pointer whitespace-nowrap px-3 py-3.5"
        onClick={() => onEdit(wo)}
      >
        <div className="flex flex-col items-start gap-1.5">
          <span
            className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${issueStatusBadgeClassLight(wo.status)}`}
          >
            {ISSUE_STATUS_LABEL[wo.status] ?? wo.status}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${priorityBadgeClassLight(pri)}`}
          >
            <Flag className="h-3 w-3 opacity-80" aria-hidden />
            {ISSUE_PRIORITY_LABEL[pri] ?? pri}
          </span>
        </div>
      </td>

      <td
        className="hidden min-w-[8.5rem] cursor-pointer px-3 py-3.5 md:table-cell"
        onClick={() => onEdit(wo)}
      >
        {wo.assignee ? (
          <div className="flex items-center gap-2">
            <OmAssigneeAvatar member={wo.assignee} sizeClass="h-8 w-8" />
            <span className="max-w-[7rem] truncate text-xs font-medium text-[var(--enterprise-text)]">
              {assigneeName}
            </span>
          </div>
        ) : wo.vendor ? (
          <div className="flex items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <Building2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="max-w-[7rem] truncate">{wo.vendor.name}</span>
          </div>
        ) : (
          <span className="text-xs text-[var(--enterprise-text-muted)]">Unassigned</span>
        )}
      </td>

      <td className="min-w-[7.5rem] cursor-pointer px-3 py-3.5" onClick={() => onEdit(wo)}>
        <div className="flex flex-col gap-1.5">
          {isOverdue ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--enterprise-semantic-danger-bg)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--enterprise-semantic-danger-text)]">
              <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              Overdue · {due.text}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text)]">
              <Calendar
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                strokeWidth={1.75}
                aria-hidden
              />
              {due.text}
            </span>
          )}
          {sla ? (
            <span className={`text-xs font-medium ${slaToneClass(sla.tone)}`}>{sla.label}</span>
          ) : (
            <span className="text-xs text-[var(--enterprise-text-muted)]">—</span>
          )}
        </div>
      </td>

      <td className="px-3 py-3.5 text-right">
        <RowActions
          wo={wo}
          isActive={isActive}
          onEdit={onEdit}
          onComplete={onComplete}
          onStart={onStart}
          onMoreActions={onMoreActions}
        />
      </td>
    </tr>
  );
}

// fallow-ignore-next-line complexity
function WorkOrderMobileCard({
  wo,
  highlighted,
  nowMs,
  onEdit,
  onComplete,
  onStart,
  onMoreActions,
}: {
  wo: IssueRow;
  highlighted: boolean;
  nowMs: number;
  onEdit: (wo: IssueRow) => void;
  onComplete: (wo: IssueRow) => void;
  onStart: (wo: IssueRow) => void;
  onMoreActions?: (wo: IssueRow) => void;
}) {
  const { pri, due, isActive, isOverdue, sla, place } = workOrderRowModel(wo, nowMs);

  return (
    <li
      id={`wo-${wo.id}`}
      className={`relative border-b border-[var(--enterprise-border)]/70 ${
        highlighted ? "bg-[var(--enterprise-primary-soft)]/35" : "bg-[var(--enterprise-surface)]"
      }`}
    >
      <span
        className={`absolute inset-y-3 left-0 w-[3px] rounded-full ${priorityAccentClass(pri)}`}
        aria-hidden
      />
      <button type="button" className="w-full px-4 py-3.5 text-left" onClick={() => onEdit(wo)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex rounded-md border border-[var(--enterprise-primary)]/25 bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-[var(--enterprise-primary)]">
                {formatWorkOrderNumber(wo)}
              </span>
              <span
                className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold ${issueStatusBadgeClassLight(wo.status)}`}
              >
                {ISSUE_STATUS_LABEL[wo.status] ?? wo.status}
              </span>
              {isOverdue ? (
                <span className="enterprise-badge-danger inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold">
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Overdue
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
              {wo.title}
            </p>
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--enterprise-text-muted)]">
              <MapPin
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate">{place}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--enterprise-text-muted)]">
              {isOverdue ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--enterprise-semantic-danger-bg)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--enterprise-semantic-danger-text)]">
                  <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Overdue · {due.text}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--enterprise-text)]">
                  <Calendar
                    className="h-3.5 w-3.5 text-[var(--enterprise-text-muted)]"
                    aria-hidden
                  />
                  {due.text}
                </span>
              )}
              {sla ? <span className={slaToneClass(sla.tone)}>{sla.label}</span> : null}
              {wo.asset ? (
                <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                  {wo.asset.tag}
                </span>
              ) : null}
            </div>
          </div>
          {wo.assignee ? <OmAssigneeAvatar member={wo.assignee} sizeClass="h-8 w-8" /> : null}
        </div>
      </button>
      <div className="flex items-center justify-end gap-1 border-t border-[var(--enterprise-border)]/60 px-3 py-2">
        <RowActions
          wo={wo}
          isActive={isActive}
          onEdit={onEdit}
          onComplete={onComplete}
          onStart={onStart}
          onMoreActions={onMoreActions}
          alwaysVisible
        />
      </div>
    </li>
  );
}

export function WorkOrdersTable({
  rows,
  highlightId,
  onEdit,
  onComplete,
  onStart,
  onMoreActions,
}: WorkOrdersTableProps) {
  const nowMs = useTickNowMs();

  return (
    <>
      <div className="enterprise-scrollbar hidden w-full min-w-0 overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[3]">
            <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-xs font-semibold uppercase tracking-[0.07em] text-[var(--enterprise-text-muted)]">
              <th className="w-1 p-0" aria-hidden />
              <th className="px-3 py-3 sm:px-4">Work order</th>
              <th className="min-w-[9rem] px-3 py-3">Status</th>
              <th className="hidden min-w-[8.5rem] px-3 py-3 md:table-cell">Assignee</th>
              <th className="min-w-[7.5rem] px-3 py-3">Schedule</th>
              <th className="w-[8.5rem] px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((wo) => (
              <WorkOrderDesktopRow
                key={wo.id}
                wo={wo}
                highlighted={highlightId === wo.id}
                nowMs={nowMs}
                onEdit={onEdit}
                onComplete={onComplete}
                onStart={onStart}
                onMoreActions={onMoreActions}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden">
        {rows.map((wo) => (
          <WorkOrderMobileCard
            key={wo.id}
            wo={wo}
            highlighted={highlightId === wo.id}
            nowMs={nowMs}
            onEdit={onEdit}
            onComplete={onComplete}
            onStart={onStart}
            onMoreActions={onMoreActions}
          />
        ))}
      </ul>
    </>
  );
}
