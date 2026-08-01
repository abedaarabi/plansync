"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";
import { MOBILE_FIELD_INPUT, MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";

type Props = {
  open: boolean;
  title: string;
  entityName: string;
  description: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TypeDeleteConfirmDialog({
  open,
  title,
  entityName,
  description,
  confirmLabel = "Delete",
  isDeleting = false,
  onConfirm,
  onCancel,
}: Props) {
  const [confirmValue, setConfirmValue] = useState("");
  const canDelete = confirmValue.trim().toLowerCase() === "delete";

  useEffect(() => {
    if (!open) setConfirmValue("");
  }, [open]);

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="type-delete-title"
      ariaDescribedBy="type-delete-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <>
          <button
            type="button"
            disabled={isDeleting || !canDelete}
            onClick={onConfirm}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-red-600 text-white hover:bg-red-700 disabled:pointer-events-none`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]`}
          >
            Cancel
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-semantic-danger-bg)] text-red-600">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="type-delete-title"
            className="text-balance text-lg font-semibold text-[var(--enterprise-text)]"
          >
            {title}
          </h2>
          <p
            id="type-delete-desc"
            className="mt-2 text-base leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            You are deleting{" "}
            <span className="font-semibold text-[var(--enterprise-text)]">
              &quot;{entityName}&quot;
            </span>
            . {description}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          Type <span className="font-semibold text-[var(--enterprise-text)]">delete</span> to
          continue.
        </p>
        <label htmlFor="type-delete-confirm" className={MOBILE_FIELD_LABEL}>
          Confirmation
        </label>
        <input
          id="type-delete-confirm"
          value={confirmValue}
          onChange={(e) => setConfirmValue(e.target.value)}
          placeholder="delete"
          autoFocus
          disabled={isDeleting}
          className={MOBILE_FIELD_INPUT}
          aria-label="Type delete to confirm deletion"
        />
      </div>
    </EnterpriseResponsiveDialog>
  );
}
