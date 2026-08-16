"use client";

import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CalibrateNeededDialog({ open, onClose }: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={onClose}
      ariaLabelledBy="calibrate-needed-title"
      variant="viewer"
      footer={
        <button
          type="button"
          className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-(--viewer-primary) text-white shadow-sm hover:bg-(--viewer-primary-hover)`}
          title="Close"
          onClick={onClose}
        >
          OK
        </button>
      }
    >
      <h2
        id="calibrate-needed-title"
        className="text-lg font-semibold tracking-tight text-slate-900"
      >
        Calibrate this page first
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Use the <strong className="font-medium text-slate-700">Calibrate</strong> tool: two clicks
        on a known distance, then enter that length when prompted. After that you can use{" "}
        <strong className="font-medium text-slate-700">Measure</strong>.
      </p>
    </EnterpriseResponsiveDialog>
  );
}
