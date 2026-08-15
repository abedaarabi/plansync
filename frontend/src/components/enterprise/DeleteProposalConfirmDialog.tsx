"use client";

import { AlertTriangle } from "lucide-react";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { ConfirmDialogActions } from "@/components/enterprise/ConfirmDialogActions";

type Props = {
  open: boolean;
  reference: string;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteProposalConfirmDialog({
  open,
  reference,
  title,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-proposal-title"
      ariaDescribedBy="delete-proposal-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <ConfirmDialogActions
          confirmLabel="Delete proposal"
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
            id="delete-proposal-title"
            className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
          >
            Delete proposal?
          </h2>
          <p
            id="delete-proposal-desc"
            className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            <span className="font-medium text-[var(--enterprise-text)]">{reference}</span>
            {" — "}
            <span className="font-medium text-[var(--enterprise-text)]">{title}</span> will be
            removed permanently, including the client link and history. This cannot be undone.
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
