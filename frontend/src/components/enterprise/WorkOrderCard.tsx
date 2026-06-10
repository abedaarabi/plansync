"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flag,
  Link2,
  Package,
  Play,
  Sparkles,
  UserRound,
} from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import type { IssueRow } from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
} from "@/lib/issueStatusStyle";

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

function previewText(s: string | null | undefined, max = 160): string | null {
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

function accentBorder(wo: IssueRow, overdue: boolean): string {
  if (overdue && (wo.status === "OPEN" || wo.status === "IN_PROGRESS")) {
    return "border-l-[var(--enterprise-semantic-danger-muted)]";
  }
  if (wo.status === "IN_PROGRESS") return "border-l-[var(--enterprise-primary)]";
  if (wo.status === "RESOLVED") return "border-l-[var(--enterprise-semantic-success-text)]";
  if (wo.status === "CLOSED") return "border-l-[var(--enterprise-border)]";
  return "border-l-[var(--enterprise-semantic-info-text)]";
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
        : "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
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
  vendorLinkBusy: boolean;
  aiBusy: boolean;
};

export function WorkOrderCard({
  wo,
  onEdit,
  onComplete,
  onStart,
  onVendorLink,
  onAiHelp,
  vendorLinkBusy,
  aiBusy,
}: WorkOrderCardProps) {
  const pri = wo.priority ?? "MEDIUM";
  const due = dueMeta(wo.dueDate);
  const isActive = wo.status === "OPEN" || wo.status === "IN_PROGRESS";
  const isOverdue = due.overdue && isActive;
  const description = previewText(wo.description);
  const checklist = checklistProgress(wo);
  return (
    <article
      className={`enterprise-card mobile-list-row w-full overflow-hidden rounded-2xl border border-[var(--enterprise-border)] border-l-4 bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] transition-shadow hover:shadow-sm ${accentBorder(wo, due.overdue)}`}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-2.5 p-3 text-left transition active:opacity-90 sm:p-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${issueStatusBadgeClassLight(wo.status)}`}
            >
              {ISSUE_STATUS_LABEL[wo.status] ?? wo.status}
            </span>
            {wo.workOrderType ? (
              <span className="inline-flex rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--enterprise-text-muted)]">
                {WO_TYPE_LABEL[wo.workOrderType] ?? wo.workOrderType}
              </span>
            ) : null}
            {isOverdue ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-danger-text)]">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Overdue
              </span>
            ) : null}
            <span
              className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold sm:ml-0 ${priorityBadgeClassLight(pri)}`}
            >
              <Flag className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
              {ISSUE_PRIORITY_LABEL[pri]}
            </span>
          </div>

          <h2 className="mt-2 text-sm font-semibold leading-snug text-[var(--enterprise-text)] sm:text-base">
            {wo.title}
          </h2>

          {description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)] sm:text-sm">
              {description}
            </p>
          ) : null}

          {wo.asset ? (
            <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-[var(--enterprise-text)]">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
                <Package className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                  {wo.asset.tag}
                </span>
                <span className="text-[var(--enterprise-text-muted)]"> · </span>
                <span className="font-medium">{wo.asset.name}</span>
                {wo.location?.trim() ? (
                  <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                    {wo.location.trim()}
                  </span>
                ) : null}
              </span>
            </div>
          ) : wo.location?.trim() ? (
            <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">{wo.location.trim()}</p>
          ) : null}
        </div>
        <ChevronRight
          className="mt-1 h-5 w-5 shrink-0 text-[var(--enterprise-text-muted)]"
          aria-hidden
        />
      </button>

      <div className="flex w-full flex-col gap-2 border-t border-[var(--enterprise-border)]/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <MetaPill
            icon={Calendar}
            label={due.text === "No due date" ? due.text : `Due ${due.text}`}
            tone={isOverdue ? "danger" : "neutral"}
          />
          {wo.assignee ? (
            <MetaPill
              icon={UserRound}
              label={wo.assignee.name || wo.assignee.email || "Assigned"}
            />
          ) : wo.vendor ? (
            <MetaPill icon={Building2} label={wo.vendor.name} />
          ) : (
            <MetaPill icon={UserRound} label="Unassigned" />
          )}
          {checklist ? (
            <MetaPill
              icon={ClipboardList}
              label={`${checklist.done}/${checklist.total} checklist`}
              tone={checklist.done === checklist.total ? "primary" : "neutral"}
            />
          ) : null}
          {wo.hasVendorAccessLink ? (
            <MetaPill icon={Link2} label="Vendor link sent" tone="primary" />
          ) : null}
          {wo.resolvedAt && !isActive ? (
            <MetaPill
              icon={CheckCircle2}
              label={`Closed ${new Date(wo.resolvedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              tone="primary"
            />
          ) : null}
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
          {isActive ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <EnterpriseButton size="sm" onClick={onComplete}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Complete
              </EnterpriseButton>
              {wo.status === "OPEN" ? (
                <EnterpriseButton size="sm" variant="secondary" onClick={onStart}>
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Start
                </EnterpriseButton>
              ) : null}
            </div>
          ) : null}
          <div
            className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${isActive ? "sm:border-l sm:border-[var(--enterprise-border)]/80 sm:pl-2" : ""}`}
          >
            <EnterpriseButton size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </EnterpriseButton>
            {isActive ? (
              <EnterpriseButton
                size="sm"
                variant="secondary"
                disabled={vendorLinkBusy}
                onClick={onVendorLink}
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                {vendorLinkBusy ? "Sending…" : "Vendor link"}
              </EnterpriseButton>
            ) : null}
            {wo.assetId ? (
              <EnterpriseButton
                size="sm"
                variant="secondary"
                disabled={aiBusy}
                className="border-[var(--enterprise-semantic-info-border)] text-[var(--enterprise-semantic-info-text)] hover:bg-[var(--enterprise-semantic-info-bg)]"
                onClick={onAiHelp}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {aiBusy ? "Thinking…" : "AI help"}
              </EnterpriseButton>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
