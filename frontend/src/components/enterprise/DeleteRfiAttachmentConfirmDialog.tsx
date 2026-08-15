"use client";

import { AlertTriangle } from "lucide-react";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { ConfirmDialogActions } from "@/components/enterprise/ConfirmDialogActions";

type Props = {
  open: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteRfiAttachmentConfirmDialog({
  open,
  fileName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-rfi-attachment-title"
      ariaDescribedBy="delete-rfi-attachment-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <ConfirmDialogActions
          confirmLabel="Remove attachment"
          confirmingLabel="Removing…"
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
            id="delete-rfi-attachment-title"
            className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
          >
            Remove attachment?
          </h2>
          <p
            id="delete-rfi-attachment-desc"
            className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            <span className="font-medium text-[var(--enterprise-text)]">
              &ldquo;{fileName || "File"}&rdquo;
            </span>{" "}
            will be removed from this RFI and deleted from storage. This cannot be undone.
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
