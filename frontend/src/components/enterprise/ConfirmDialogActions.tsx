"use client";

import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";

type Props = {
  confirmLabel: string;
  confirmingLabel: string;
  cancelLabel?: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmTitle?: string;
  confirmVariant?: "danger" | "primary";
};

/** Shared confirm/cancel footer used by typed-delete and similar dialogs. */
export function ConfirmDialogActions({
  confirmLabel,
  confirmingLabel,
  cancelLabel = "Cancel",
  isPending,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  confirmTitle,
  confirmVariant = "danger",
}: Props) {
  return (
    <>
      <EnterpriseButton
        type="button"
        variant={confirmVariant}
        size="md"
        fullWidth
        loading={isPending}
        disabled={confirmDisabled}
        onClick={onConfirm}
        title={confirmTitle}
        className="max-lg:min-h-[52px] sm:w-auto"
      >
        {isPending ? confirmingLabel : confirmLabel}
      </EnterpriseButton>
      <EnterpriseButton
        type="button"
        variant="secondary"
        size="md"
        fullWidth
        disabled={isPending}
        onClick={onCancel}
        className="max-lg:min-h-[52px] sm:w-auto"
      >
        {cancelLabel}
      </EnterpriseButton>
    </>
  );
}
