"use client";

import { Loader2 } from "lucide-react";
import type { ProjectChangeRow } from "@/lib/projectChangeSummary";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  projectTitle: string;
  changes: ProjectChangeRow[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmProjectSaveDialog({
  open,
  projectTitle,
  changes,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={saving ? () => {} : onCancel}
      ariaLabelledBy="confirm-save-title"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      panelClassName="max-w-lg p-0"
      bodyClassName="overflow-hidden"
      footerClassName="border-t border-[#F1F5F9] bg-[#FAFBFC] px-6 py-4 mt-0"
      footer={
        <>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} gap-2 bg-[#2563EB] text-white shadow-md hover:bg-[#1d4ed8] disabled:cursor-not-allowed`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Confirm and save"
            )}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-50`}
          >
            Back to editing
          </button>
        </>
      }
    >
      <div className="border-b border-[#F1F5F9] bg-gradient-to-br from-[#F8FAFC] to-white px-6 py-5">
        <h2 id="confirm-save-title" className="text-lg font-bold tracking-tight text-[#0F172A]">
          Save changes?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
          You are about to update{" "}
          <span className="font-semibold text-[#0F172A]">{projectTitle}</span>. Review the updates
          below, then confirm to apply them to the project.
        </p>
      </div>

      <div className="max-h-[min(50vh,22rem)] overflow-y-auto px-6 py-4">
        <ul className="space-y-2.5">
          {changes.map((c) => (
            <li
              key={c.label}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3"
              style={{ borderRadius: "12px" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {c.label}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="max-w-[45%] truncate rounded-md bg-white px-2 py-1 text-[13px] text-[#64748B] line-through decoration-[#94A3B8]">
                  {c.before}
                </span>
                <span className="shrink-0 text-[#94A3B8]" aria-hidden>
                  →
                </span>
                <span className="max-w-[45%] truncate rounded-md bg-[#EFF6FF] px-2 py-1 text-[13px] font-semibold text-[#1E40AF]">
                  {c.after}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
