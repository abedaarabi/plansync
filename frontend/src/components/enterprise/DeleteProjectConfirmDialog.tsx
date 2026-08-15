"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { MOBILE_FIELD_INPUT, MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";
import { ConfirmDialogActions } from "@/components/enterprise/ConfirmDialogActions";

type Props = {
  open: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteProjectConfirmDialog({
  open,
  projectName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [confirmName, setConfirmName] = useState("");
  const nameMatches = confirmName === projectName;

  useEffect(() => {
    setConfirmName("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-project-title"
      ariaDescribedBy="delete-project-desc delete-project-type-label"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <ConfirmDialogActions
          confirmLabel="Delete project"
          confirmingLabel="Deleting…"
          isPending={isDeleting}
          confirmDisabled={!nameMatches}
          confirmTitle={!nameMatches ? "Enter the exact project name above" : undefined}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      }
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600">
          <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="delete-project-title"
            className="text-balance text-lg font-semibold text-[var(--enterprise-text)]"
          >
            Delete project?
          </h2>
          <p
            id="delete-project-desc"
            className="mt-2 text-base leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            <span className="font-medium text-[var(--enterprise-text)]">{projectName}</span> and all
            related data will be permanently removed. This cannot be undone.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2 border-t border-[var(--enterprise-border)] pt-4">
        <label
          id="delete-project-type-label"
          htmlFor="delete-project-name-input"
          className={MOBILE_FIELD_LABEL}
        >
          Type the project name to confirm
        </label>
        <input
          ref={nameInputRef}
          id="delete-project-name-input"
          type="text"
          autoComplete="off"
          disabled={isDeleting}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          className={MOBILE_FIELD_INPUT}
          placeholder={projectName ? `Type “${projectName}”` : "Project name"}
        />
      </div>
    </EnterpriseResponsiveDialog>
  );
}
