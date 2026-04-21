"use client";

/**
 * Wraps a primary "Add / New / Create" control with a native-feel pulse ring on
 * mobile (max-sm). Two variants:
 *
 *   "fab"     — circular pulse behind a circular FAB button
 *   "primary" — rounded-xl glow behind a wide rectangular primary CTA
 *
 * Pulse is suppressed when `disabled` and when the user prefers reduced motion
 * (via Tailwind's `motion-safe:` utility, matching the globals.css pattern).
 * It is only visible below the `sm` (640 px) breakpoint — desktop stays clean.
 */

import { type ReactNode } from "react";

type Variant = "fab" | "primary";

interface EnterpriseAddPulseWrapProps {
  children: ReactNode;
  variant?: Variant;
  disabled?: boolean;
  /** Extra classes forwarded to the outer wrapper span */
  className?: string;
}

export function EnterpriseAddPulseWrap({
  children,
  variant = "primary",
  disabled = false,
  className,
}: EnterpriseAddPulseWrapProps) {
  const outerCls = ["relative inline-flex", className].filter(Boolean).join(" ");

  const pingCls = [
    // Only paint on mobile; desktop stays clean
    "pointer-events-none absolute inset-0 z-0",
    "hidden max-sm:block",
    // Always rendered in DOM but animation only runs when motion is OK
    "motion-reduce:opacity-0 motion-safe:animate-ping",
    variant === "fab"
      ? "rounded-full bg-[color-mix(in_srgb,var(--enterprise-primary)_28%,transparent)]"
      : "rounded-xl bg-[color-mix(in_srgb,var(--enterprise-primary)_18%,transparent)]",
  ].join(" ");

  return (
    <span className={outerCls}>
      {!disabled && <span aria-hidden className={pingCls} />}
      {children}
    </span>
  );
}
