"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  Flag,
  Link2,
  MoreHorizontal,
  Package,
  Pencil,
  Play,
  Sparkles,
} from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
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

function dueMeta(dueDate: string | null | undefined): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No due date", overdue: false };
  const d = new Date(dueDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const overdue = d < today;
  return {
    text: d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }),
    overdue,
  };
}

function previewText(s: string | null | undefined, max = 140): string | null {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function checklistProgress(wo: IssueRow): { done: number; total: number } | null {
  const total = wo.procedureJson?.length ?? 0;
  if (total === 0) return null;
  const results = wo.procedureResultJson ?? [];
  const done = results.filter((r) => r.outcome != null).length;
  return { done, total };
}

function MetaPill({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "danger" | "primary";
}) {
  const toneClass =
    tone === "danger"
      ? "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]"
      : tone === "primary"
        ? "border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] text-[var(--enterprise-semantic-info-text)]"
        : "border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${toneClass}`}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export type WorkOrderCardProps = {
  wo: IssueRow;
  onEdit: () => void;
  onComplete: () => void;
  onStart: () => void;
  onVendorLink: () => void;
  onAiHelp: () => void;
  onMoreActions?: () => void;
  vendorLinkBusy: boolean;
  aiBusy: boolean;
};

// fallow-ignore-next-line complexity
export function WorkOrderCard({
  wo,
  onEdit,
  onComplete,
  onStart,
  onVendorLink,
  onAiHelp,
  onMoreActions,
  vendorLinkBusy,
  aiBusy,
}: WorkOrderCardProps) {
  const nowMs = useTickNowMs();
  const pri = wo.priority ?? "MEDIUM";
  const due = dueMeta(wo.dueDate);
  const isActive = wo.status === "OPEN" || wo.status === "IN_PROGRESS";
  const isOverdue = due.overdue && isActive;
  const description = previewText(wo.description);
  const checklist = checklistProgress(wo);
  const assigneeLabel = wo.assignee?.name || wo.assignee?.email || null;
  const sla = workOrderSlaInfo(wo, nowMs);
  const laborMin = wo.laborMinutes ?? null;
  const partsCount = Array.isArray(wo.partsUsedJson) ? wo.partsUsedJson.length : 0;
  const reInspect = wo.workOrderType === "INSPECTION_FOLLOWUP";

  return (
    <article className="flex flex-col gap-0 overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:bg-[var(--enterprise-hover-surface)]/50">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-3 px-3 py-3 text-left sm:px-3.5"
      >
        <span className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] sm:inline-flex">
          <Package className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] font-bold text-[var(--enterprise-text-muted)]">
              {formatWorkOrderNumber(wo)}
            </span>
            <span
              className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${issueStatusBadgeClassLight(wo.status)}`}
            >
              {ISSUE_STATUS_LABEL[wo.status] ?? wo.status}
            </span>
            {reInspect ? (
              <span className="inline-flex rounded-md border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                Re-inspect
              </span>
            ) : null}
            {wo.workOrderType ? (
              <span className="inline-flex rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--enterprise-text-muted)]">
                {WO_TYPE_LABEL[wo.workOrderType] ?? wo.workOrderType}
              </span>
            ) : null}
            {isOverdue ? (
              <span className="enterprise-badge-danger inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Overdue
              </span>
            ) : null}
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClassLight(pri)}`}
            >
              <Flag className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
              {ISSUE_PRIORITY_LABEL[pri]}
            </span>
          </div>

          <h2 className="mt-1.5 text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
            {wo.title}
          </h2>

          {description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
              {description}
            </p>
          ) : null}

          {wo.asset ? (
            <p className="mt-1.5 truncate text-[11px] text-[var(--enterprise-text-muted)]">
              <span className="font-mono font-semibold text-[var(--enterprise-primary)]">
                {wo.asset.tag}
              </span>
              <span> · {wo.asset.name}</span>
              {wo.location?.trim() ? <span> · {wo.location.trim()}</span> : null}
            </p>
          ) : wo.location?.trim() ? (
            <p className="mt-1.5 truncate text-[11px] text-[var(--enterprise-text-muted)]">
              {wo.location.trim()}
            </p>
          ) : null}
        </div>
        {wo.assignee ? (
          <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
            <OmAssigneeAvatar member={wo.assignee} sizeClass="h-8 w-8" />
            <span className="max-w-[4.5rem] truncate text-[9px] text-[var(--enterprise-text-muted)]">
              {assigneeLabel}
            </span>
          </div>
        ) : null}
      </button>

      <div className="flex flex-col gap-2 border-t border-[var(--enterprise-border)]/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          <MetaPill
            icon={Calendar}
            label={due.text === "No due date" ? due.text : `Due ${due.text}`}
            tone={isOverdue ? "danger" : "neutral"}
          />
          {sla ? (
            <MetaPill
              icon={Clock}
              label={sla.label}
              tone={sla.tone === "danger" ? "danger" : sla.tone === "warn" ? "danger" : "primary"}
            />
          ) : null}
          {!wo.assignee && wo.vendor ? <MetaPill icon={Building2} label={wo.vendor.name} /> : null}
          {!wo.assignee && !wo.vendor ? <MetaPill icon={Building2} label="Unassigned" /> : null}
          {checklist ? (
            <MetaPill
              icon={ClipboardList}
              label={`${checklist.done}/${checklist.total}`}
              tone={checklist.done === checklist.total ? "primary" : "neutral"}
            />
          ) : null}
          {laborMin != null && laborMin > 0 ? (
            <MetaPill icon={Clock} label={`${laborMin} min labor`} tone="primary" />
          ) : null}
          {partsCount > 0 ? (
            <MetaPill
              icon={DollarSign}
              label={`${partsCount} part${partsCount === 1 ? "" : "s"}`}
              tone="primary"
            />
          ) : null}
          {wo.hasVendorAccessLink ? (
            <MetaPill icon={Link2} label="Vendor link" tone="primary" />
          ) : null}
          {wo.resolvedAt && !isActive ? (
            <MetaPill
              icon={CheckCircle2}
              label={`Closed ${new Date(wo.resolvedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              tone="primary"
            />
          ) : null}
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
          {onMoreActions ? (
            <EnterpriseButton
              size="sm"
              variant="ghost"
              className="!h-8 !min-h-8 !w-8 !px-0 sm:hidden"
              onClick={onMoreActions}
              title="Actions"
              aria-label="Work order actions"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </EnterpriseButton>
          ) : null}
          <div className="hidden items-center gap-1 sm:flex">
            {wo.status === "OPEN" ? (
              <button
                type="button"
                onClick={onStart}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[var(--enterprise-primary)] px-2.5 text-[11px] font-semibold text-white shadow-sm hover:opacity-95"
              >
                <Play className="h-3 w-3" fill="currentColor" />
                Start
              </button>
            ) : null}
            {isActive ? (
              <EnterpriseButton
                size="sm"
                variant="secondary"
                className="!min-h-8 !px-2.5 !text-[11px]"
                onClick={onComplete}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Complete
              </EnterpriseButton>
            ) : null}
            <EnterpriseButton
              size="sm"
              variant="ghost"
              className="!h-8 !min-h-8 !w-8 !px-0"
              onClick={onEdit}
              title="Edit"
              aria-label="Edit work order"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </EnterpriseButton>
            {isActive ? (
              <EnterpriseButton
                size="sm"
                variant="ghost"
                className="!h-8 !min-h-8 !w-8 !px-0"
                disabled={vendorLinkBusy}
                onClick={onVendorLink}
                title={vendorLinkBusy ? "Sending vendor link…" : "Send vendor link"}
                aria-label={vendorLinkBusy ? "Sending vendor link" : "Send vendor link"}
              >
                <Link2 className="h-4 w-4" aria-hidden />
              </EnterpriseButton>
            ) : null}
            {wo.assetId ? (
              <EnterpriseButton
                size="sm"
                variant="ghost"
                className="!h-8 !min-h-8 !w-8 !px-0 text-[var(--enterprise-semantic-info-text)]"
                disabled={aiBusy}
                onClick={onAiHelp}
                title={aiBusy ? "AI thinking…" : "AI help"}
                aria-label={aiBusy ? "AI help loading" : "AI help"}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
              </EnterpriseButton>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
