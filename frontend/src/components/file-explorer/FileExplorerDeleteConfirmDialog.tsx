"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

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
  if (!open) return null;

  const canDelete = confirmValue.trim().toLowerCase() === "delete" && !deleting;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0F172A]/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={deleting ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-explorer-delete-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--enterprise-shadow-floating)]"
      >
        <div className="border-b border-[#F1F5F9] bg-gradient-to-br from-[#FFF7ED] to-white px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#DC2626]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h2
                id="file-explorer-delete-title"
                className="text-lg font-bold tracking-tight text-[#0F172A]"
              >
                Confirm delete {targetType}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
                You are deleting{" "}
                <span className="font-semibold text-[#0F172A]">&quot;{targetName}&quot;</span>.
                {targetType === "folder"
                  ? " This removes the folder and everything inside it forever."
                  : fileRevisionToDelete != null
                    ? ` This removes revision ${fileRevisionToDelete} only. Other revisions stay on the project.`
                    : " This removes the file forever."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 px-6 py-5">
          <p className="text-sm text-[#475569]">
            Type <span className="font-semibold text-[#0F172A]">delete</span> to continue.
          </p>
          <input
            value={confirmValue}
            onChange={(e) => onConfirmValueChange(e.target.value)}
            placeholder="delete"
            autoFocus
            disabled={deleting}
            className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            aria-label="Type delete to confirm deletion"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#F1F5F9] bg-[#FAFBFC] px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : fileRevisionToDelete != null && targetType === "file" ? (
              `Delete revision ${fileRevisionToDelete}`
            ) : (
              `Delete ${targetType}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
