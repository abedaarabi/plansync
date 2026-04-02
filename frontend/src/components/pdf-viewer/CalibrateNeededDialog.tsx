"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CalibrateNeededDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#334155] bg-[#1E293B] p-5 text-[#F8FAFC] shadow-2xl ring-1 ring-black/25"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calibrate-needed-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <h2
          id="calibrate-needed-title"
          className="text-lg font-semibold tracking-tight text-[#F8FAFC]"
        >
          Calibrate this page first
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          Use the <strong className="font-medium text-[#E2E8F0]">Calibrate</strong> tool: two clicks
          on a known distance, then enter that length when prompted. After that you can use{" "}
          <strong className="font-medium text-[#E2E8F0]">Measure</strong>.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1D4ED8]"
            title="Close"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
