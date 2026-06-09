"use client";

import { AlertTriangle } from "lucide-react";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  title: string;
  entityLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteProjectIssueConfirmDialog({
  open,
  title,
  entityLabel = "issue",
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-project-issue-title"
      ariaDescribedBy="delete-project-issue-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <>
          <button
            type="button"
            disabled={isDeleting}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} border border-red-800/80 bg-red-950/80 text-red-100 shadow-sm hover:bg-red-900/90 disabled:opacity-40`}
            onClick={onConfirm}
          >
            {isDeleting ? "Deleting…" : `Delete ${entityLabel}`}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-40`}
            onClick={onCancel}
          >
            Cancel
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-950/50"
          aria-hidden
        >
          <AlertTriangle className="h-5 w-5 text-amber-200/90" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="delete-project-issue-title"
            className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
          >
            Delete this {entityLabel}?
          </h2>
          <p
            id="delete-project-issue-desc"
            className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            <span className="font-medium text-[var(--enterprise-text)]">
              &ldquo;{title || "Untitled"}&rdquo;
            </span>{" "}
            will be removed from the project
            {entityLabel === "issue" ? " and its sheet pin will disappear if one was placed" : ""}.
            This cannot be undone.
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
