"use client";

import { AlertTriangle } from "lucide-react";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { ConfirmDialogActions } from "@/components/enterprise/ConfirmDialogActions";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteRecordedAnswerConfirmDialog({
  open,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-recorded-answer-title"
      ariaDescribedBy="delete-recorded-answer-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <ConfirmDialogActions
          confirmLabel="Remove recorded answer"
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
            id="delete-recorded-answer-title"
            className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
          >
            Remove recorded answer?
          </h2>
          <p
            id="delete-recorded-answer-desc"
            className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            This removes the formal answer from the RFI. The discussion message stays in the thread.
            If the RFI was marked answered, it will return to{" "}
            <span className="font-medium text-[var(--enterprise-text)]">In review</span> until
            someone picks a new answer.
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
