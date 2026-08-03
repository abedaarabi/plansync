"use client";

type Props = {
  label: string;
  value: number;
  hint?: string;
  /** Tailwind border-l-* class for the accent edge. */
  borderClass: string;
  active?: boolean;
  onClick?: () => void;
};

export function EnterpriseOverviewKpiTile({
  label,
  value,
  hint,
  borderClass,
  active,
  onClick,
}: Props) {
  const cls = `enterprise-card rounded-lg border-l-[3px] px-2.5 py-2 text-left ${borderClass} ${
    active ? "ring-2 ring-[var(--enterprise-primary)]/45" : ""
  } ${onClick ? "transition hover:bg-[var(--enterprise-hover-surface)]/60 active:scale-[0.98]" : ""}`;
  const body = (
    <>
      <p className="text-base font-bold tabular-nums leading-none tracking-tight text-[var(--enterprise-text)] sm:text-lg">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] leading-snug text-[var(--enterprise-text-muted)]">
        {label}
      </p>
    </>
  );
  if (!onClick) {
    return (
      <div className={cls} title={hint}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={hint} className={cls}>
      {body}
    </button>
  );
}
