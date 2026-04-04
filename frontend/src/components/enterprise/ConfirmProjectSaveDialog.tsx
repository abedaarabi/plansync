"use client";

import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import type { ProjectChangeRow } from "@/lib/projectChangeSummary";

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
  if (!open || typeof document === "undefined") return null;

  const shell = (
    <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0F172A]/45 backdrop-blur-[2px] transition-opacity"
        aria-label="Close dialog"
        onClick={saving ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-save-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--enterprise-shadow-floating)]"
        style={{ borderRadius: "16px" }}
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

        <div className="flex flex-col-reverse gap-2 border-t border-[#F1F5F9] bg-[#FAFBFC] px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-50"
          >
            Back to editing
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}
