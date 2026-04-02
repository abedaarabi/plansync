"use client";

type Props = {
  value: number;
  className?: string;
  /** Bar height in pixels */
  height?: number;
  /** Show “Work completed” row with percentage above the bar */
  showLabel?: boolean;
  /** Label when `showLabel` is true */
  label?: string;
};

export function ProjectProgressBar({
  value,
  className = "",
  height = 8,
  showLabel = true,
  label = "Work completed",
}: Props) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const complete = pct >= 100;

  return (
    <div className={`w-full ${className}`}>
      {showLabel ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-tight text-slate-600">{label}</span>
          <span
            className={`text-[11px] font-bold tabular-nums ${
              complete ? "text-emerald-700" : "text-slate-800"
            }`}
          >
            {pct}%
          </span>
        </div>
      ) : null}
      <div
        className="relative w-full overflow-hidden rounded-full border border-slate-200/90 bg-gradient-to-b from-slate-100 to-slate-200/90 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]"
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pct}%`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            complete
              ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
              : "bg-gradient-to-r from-[var(--enterprise-primary)] via-blue-600 to-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
