"use client";

import { CheckCircle2, Link2, Pencil, Play, Sparkles, Wrench } from "lucide-react";
import { EnterpriseBottomSheet } from "@/components/mobile/EnterpriseBottomSheet";
import type { IssueRow } from "@/lib/api-client";
import { formatWorkOrderNumber } from "@/lib/workOrderSla";

type Props = {
  open: boolean;
  wo: IssueRow | null;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onStart: () => void;
  onVendorLink: () => void;
  onAiHelp: () => void;
  vendorLinkBusy: boolean;
  aiBusy: boolean;
};

export function WorkOrderMobileActionsSheet({
  open,
  wo,
  onClose,
  onEdit,
  onComplete,
  onStart,
  onVendorLink,
  onAiHelp,
  vendorLinkBusy,
  aiBusy,
}: Props) {
  if (!wo) return null;
  const isActive = wo.status === "OPEN" || wo.status === "IN_PROGRESS";

  const itemClass =
    "flex w-full min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-40";

  return (
    <EnterpriseBottomSheet
      open={open}
      onClose={onClose}
      ariaLabelledBy="wo-actions-title"
      maxHeightClass="max-h-[min(70dvh,480px)]"
    >
      <div className="space-y-1 px-1 pb-2">
        <div className="mb-3 flex items-start gap-2 px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
            <Wrench className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p
              id="wo-actions-title"
              className="font-mono text-[11px] font-semibold text-[var(--enterprise-text-muted)]"
            >
              {formatWorkOrderNumber(wo)}
            </p>
            <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
              {wo.title}
            </p>
          </div>
        </div>

        {wo.status === "OPEN" ? (
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              onStart();
              onClose();
            }}
          >
            <Play className="h-4 w-4 text-[var(--enterprise-primary)]" fill="currentColor" />
            Start work order
          </button>
        ) : null}
        {isActive ? (
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              onComplete();
              onClose();
            }}
          >
            <CheckCircle2 className="h-4 w-4 text-[var(--enterprise-semantic-success-text)]" />
            Complete
          </button>
        ) : null}
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            onEdit();
            onClose();
          }}
        >
          <Pencil className="h-4 w-4" />
          Open / edit
        </button>
        {isActive ? (
          <button
            type="button"
            className={itemClass}
            disabled={vendorLinkBusy}
            onClick={() => {
              onVendorLink();
              onClose();
            }}
          >
            <Link2 className="h-4 w-4" />
            Send vendor link
          </button>
        ) : null}
        {wo.assetId ? (
          <button
            type="button"
            className={itemClass}
            disabled={aiBusy}
            onClick={() => {
              onAiHelp();
              onClose();
            }}
          >
            <Sparkles className="h-4 w-4 text-[var(--enterprise-semantic-info-text)]" />
            AI help
          </button>
        ) : null}
      </div>
    </EnterpriseBottomSheet>
  );
}
