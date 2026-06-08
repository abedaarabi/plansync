"use client";

import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function DiscardProjectChangesDialog({ open, onKeepEditing, onDiscard }: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={onKeepEditing}
      ariaLabelledBy="discard-title"
      footer={
        <>
          <button
            type="button"
            onClick={onDiscard}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-[#DC2626] text-white hover:bg-[#B91C1C]`}
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onKeepEditing}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]`}
          >
            Keep editing
          </button>
        </>
      }
    >
      <h2 id="discard-title" className="text-lg font-bold tracking-tight text-[#0F172A]">
        Discard unsaved changes?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
        Your edits will be lost. You can come back and edit again anytime.
      </p>
    </EnterpriseResponsiveDialog>
  );
}
