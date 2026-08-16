"use client";

import { useViewerStore } from "@/store/viewerStore";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ClearPersistedMarkupDialog({ open, onConfirm, onCancel }: Props) {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={onCancel}
      ariaLabelledBy="clear-persisted-title"
      ariaDescribedBy="clear-persisted-desc"
      variant="viewer"
      footer={
        <>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_PRIMARY} border border-red-800/80 bg-red-50 text-red-700 shadow-sm hover:bg-red-100`}
            onClick={onConfirm}
          >
            Clear markups &amp; calibration
          </button>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_SECONDARY} text-slate-500 hover:bg-slate-100 hover:text-slate-700`}
            onClick={onCancel}
          >
            Cancel
          </button>
        </>
      }
    >
      <h2
        id="clear-persisted-title"
        className="text-lg font-semibold tracking-tight text-slate-900"
      >
        Clear saved markups?
      </h2>
      <p id="clear-persisted-desc" className="mt-2 text-sm leading-relaxed text-slate-500">
        {cloudFileVersionId
          ? "This removes all markups, measurements, and calibration saved for this file in your workspace (cloud). It cannot be undone."
          : "This removes all markups and calibration saved for this file in this browser’s local storage. It cannot be undone."}
      </p>
    </EnterpriseResponsiveDialog>
  );
}
