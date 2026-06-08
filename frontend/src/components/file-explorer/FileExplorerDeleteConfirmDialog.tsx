"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";
import { MOBILE_FIELD_INPUT, MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";

type FileExplorerDeleteConfirmDialogProps = {
  open: boolean;
  targetName: string;
  targetType: "file" | "folder";
  /** When set, deleting only this revision of a multi-version file (other revisions stay). */
  fileRevisionToDelete?: number | null;
  confirmValue: string;
  onConfirmValueChange: (value: string) => void;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteConfirmBody({
  targetName,
  targetType,
  fileRevisionToDelete,
  confirmValue,
  onConfirmValueChange,
  deleting,
}: Pick<
  FileExplorerDeleteConfirmDialogProps,
  | "targetName"
  | "targetType"
  | "fileRevisionToDelete"
  | "confirmValue"
  | "onConfirmValueChange"
  | "deleting"
>) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-error)]">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2
            id="file-explorer-delete-title"
            className="text-balance text-lg font-bold leading-tight tracking-tight text-[var(--enterprise-text)]"
          >
            Confirm delete {targetType}
          </h2>
          <p className="mt-1.5 text-base leading-relaxed text-[var(--enterprise-text-muted)]">
            You are deleting{" "}
            <span className="font-semibold text-[var(--enterprise-text)]">
              &quot;{targetName}&quot;
            </span>
            .
            {targetType === "folder"
              ? " This removes the folder and everything inside it forever."
              : fileRevisionToDelete != null
                ? ` This removes revision ${fileRevisionToDelete} only. Other revisions stay on the project.`
                : " This removes the file forever."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-base text-[var(--enterprise-text-muted)]">
          Type <span className="font-semibold text-[var(--enterprise-text)]">delete</span> to
          continue.
        </p>
        <label htmlFor="file-explorer-delete-confirm" className={MOBILE_FIELD_LABEL}>
          Confirmation
        </label>
        <input
          id="file-explorer-delete-confirm"
          value={confirmValue}
          onChange={(e) => onConfirmValueChange(e.target.value)}
          placeholder="delete"
          autoFocus
          disabled={deleting}
          className={MOBILE_FIELD_INPUT}
          aria-label="Type delete to confirm deletion"
        />
      </div>
    </>
  );
}

function DeleteConfirmFooter({
  deleting,
  canDelete,
  targetType,
  fileRevisionToDelete,
  onCancel,
  onConfirm,
}: {
  deleting: boolean;
  canDelete: boolean;
  targetType: "file" | "folder";
  fileRevisionToDelete?: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const deleteLabel = deleting ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Deleting...
    </>
  ) : fileRevisionToDelete != null && targetType === "file" ? (
    `Delete revision ${fileRevisionToDelete}`
  ) : (
    `Delete ${targetType}`
  );

  return (
    <>
      <button
        type="button"
        disabled={!canDelete}
        onClick={onConfirm}
        className={`${MOBILE_DIALOG_BTN_PRIMARY} gap-2 bg-[var(--enterprise-error)] text-white shadow-sm hover:bg-[color-mix(in_srgb,var(--enterprise-error)_90%,#000)] disabled:cursor-not-allowed`}
      >
        {deleteLabel}
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={onCancel}
        className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]`}
      >
        Cancel
      </button>
    </>
  );
}

export function FileExplorerDeleteConfirmDialog({
  open,
  targetName,
  targetType,
  fileRevisionToDelete,
  confirmValue,
  onConfirmValueChange,
  deleting,
  onCancel,
  onConfirm,
}: FileExplorerDeleteConfirmDialogProps) {
  const canDelete = confirmValue.trim().toLowerCase() === "delete" && !deleting;

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={deleting ? () => {} : onCancel}
      ariaLabelledBy="file-explorer-delete-title"
      closeOnBackdrop={!deleting}
      closeOnEscape={!deleting}
      panelClassName="max-w-lg"
      footer={
        <DeleteConfirmFooter
          deleting={deleting}
          canDelete={canDelete}
          targetType={targetType}
          fileRevisionToDelete={fileRevisionToDelete}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      }
    >
      <DeleteConfirmBody
        targetName={targetName}
        targetType={targetType}
        fileRevisionToDelete={fileRevisionToDelete}
        confirmValue={confirmValue}
        onConfirmValueChange={onConfirmValueChange}
        deleting={deleting}
      />
    </EnterpriseResponsiveDialog>
  );
}
