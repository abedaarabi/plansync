"use client";

/**
 * Branded loading UI for enterprise shell — structured, flat, no glass.
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
    <span
      className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-[var(--enterprise-border)] border-t-[var(--enterprise-primary)] [animation-duration:0.75s]"
      aria-hidden
    />
  );

  if (variant === "minimal") {
    return (
      <div
        className={`flex items-center justify-center gap-2.5 text-[var(--enterprise-text-muted)] ${className}`}
        role="status"
        aria-busy="true"
        aria-label={label ?? message}
      >
        <span
          className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-[var(--enterprise-border)] border-t-[var(--enterprise-primary)] [animation-duration:0.75s]"
          aria-hidden
        />
        <span className="text-sm font-medium">{message}</span>
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div
        className={`enterprise-card flex min-h-[12rem] w-full flex-col items-center justify-center gap-3 px-4 py-10 ${className}`}
        role="status"
        aria-busy="true"
        aria-label={label ?? message}
      >
        {spinner}
        <p className="text-sm text-[var(--enterprise-text-muted)]">{message}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[min(40vh,320px)] w-full flex-col items-center justify-center gap-3 px-4 py-12 ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label ?? message}
    >
      <div className="enterprise-card flex flex-col items-center gap-3 px-8 py-8">
        {spinner}
        <p className="text-sm text-[var(--enterprise-text-muted)]">{message}</p>
      </div>
    </div>
  );
}
