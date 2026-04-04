"use client";

type Props = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function DiscardProjectChangesDialog({ open, onKeepEditing, onDiscard }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0F172A]/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onKeepEditing}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--enterprise-shadow-floating)]"
        style={{ borderRadius: "16px" }}
      >
        <div className="px-6 py-5">
          <h2 id="discard-title" className="text-lg font-bold tracking-tight text-[#0F172A]">
            Discard unsaved changes?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            Your edits will be lost. You can come back and edit again anytime.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#F1F5F9] bg-[#FAFBFC] px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onKeepEditing}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#B91C1C]"
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}
