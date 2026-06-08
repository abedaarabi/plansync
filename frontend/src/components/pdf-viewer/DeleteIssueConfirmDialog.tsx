"use client";

import { AlertTriangle } from "lucide-react";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  issueTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

/**
 * Modal confirmation for deleting an issue (replaces {@link window.confirm}).
 * Renders in a portal above the issue slider (z-[130]).
 */
export function DeleteIssueConfirmDialog({
  open,
  issueTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-issue-title"
      ariaDescribedBy="delete-issue-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      variant="viewer-dark"
      overlayZClass="z-[130]"
      footer={
        <>
          <button
            type="button"
            disabled={isDeleting}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} border border-red-800/80 bg-red-950/80 text-red-100 shadow-sm hover:bg-red-900/90 disabled:opacity-40`}
            onClick={onConfirm}
          >
            {isDeleting ? "Deleting…" : "Delete issue"}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40`}
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
          <h2 id="delete-issue-title" className="text-lg font-semibold tracking-tight text-white">
            Delete this issue?
          </h2>
          <p id="delete-issue-desc" className="mt-2 text-sm leading-relaxed text-slate-400">
            <span className="font-medium text-slate-300">
              &ldquo;{issueTitle || "Untitled"}&rdquo;
            </span>{" "}
            will be removed from the project and its pin will disappear from the sheet. This cannot
            be undone.
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
