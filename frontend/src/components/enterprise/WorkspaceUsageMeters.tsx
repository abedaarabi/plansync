"use client";

export function formatGiB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  return (bytes / 1024 ** 3).toFixed(2);
}

export function WorkspaceUsageMeter({
  label,
  usedLabel,
  pct,
  warn,
}: {
  label: string;
  usedLabel: string;
  pct: number;
  warn?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
          {label}
        </span>
        <span
          className={`shrink-0 text-[10px] font-medium tabular-nums ${warn ? "text-amber-700" : "text-[var(--enterprise-text-muted)]"}`}
        >
          {usedLabel}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            warn ? "bg-amber-500" : "bg-[var(--enterprise-primary)]"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
