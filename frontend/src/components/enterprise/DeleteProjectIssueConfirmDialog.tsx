"use client";

import { AlertTriangle } from "lucide-react";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { ConfirmDialogActions } from "@/components/enterprise/ConfirmDialogActions";

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
        <ConfirmDialogActions
          confirmLabel={`Delete ${entityLabel}`}
          confirmingLabel="Deleting…"
          isPending={isDeleting}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
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
