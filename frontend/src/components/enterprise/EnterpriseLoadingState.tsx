"use client";

/**
 * Branded loading UI for enterprise shell — use for page-level and section-level waits.
 */
export function EnterpriseLoadingState({
  message = "Loading…",
  variant = "page",
  className = "",
  /** Visually hidden context for screen readers */
  label,
}: {
  message?: string;
  variant?: "page" | "section" | "minimal";
  className?: string;
  label?: string;
}) {
  const spinner = (
    <div className="relative flex h-12 w-12 items-center justify-center" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--enterprise-primary)]/15 opacity-60" />
      <span className="relative inline-flex h-10 w-10 animate-spin rounded-full border-2 border-slate-200/90 border-t-[var(--enterprise-primary)] border-r-[color-mix(in_srgb,var(--enterprise-primary)_45%,transparent)] shadow-sm [animation-duration:0.85s]" />
    </div>
  );

  const text = (
    <p className="mt-5 text-center text-sm font-medium tracking-tight text-[var(--enterprise-text-muted)]">
      {message}
    </p>
  );

  if (variant === "minimal") {
    return (
      <div
        className={`flex items-center justify-center gap-3 text-[var(--enterprise-text-muted)] ${className}`}
        role="status"
        aria-busy="true"
        aria-label={label ?? message}
      >
        <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden>
          <span className="inline-flex h-7 w-7 animate-spin rounded-full border-2 border-slate-200/90 border-t-[var(--enterprise-primary)] [animation-duration:0.85s]" />
        </span>
        <span className="text-sm font-medium">{message}</span>
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div
        className={`flex min-h-[min(50vh,380px)] w-full flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 px-6 py-14 shadow-[var(--enterprise-shadow-xs)] ${className}`}
        role="status"
        aria-busy="true"
        aria-label={label ?? message}
      >
        {spinner}
        {text}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[min(56vh,480px)] w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,rgba(37,99,235,0.09),transparent_55%)] px-4 py-12 ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label ?? message}
    >
      <div className="flex flex-col items-center rounded-2xl border border-slate-200/90 bg-white/95 px-10 py-11 shadow-[var(--enterprise-shadow-card)] ring-1 ring-slate-900/[0.03] backdrop-blur-[2px]">
        {spinner}
        {text}
        <p className="mt-2 text-center text-[13px] font-bold tracking-tight sm:text-sm">
          <span className="text-[var(--enterprise-text)]">Plan</span>
          <span className="text-[var(--enterprise-primary)]">Sync</span>
        </p>
      </div>
    </div>
  );
}
