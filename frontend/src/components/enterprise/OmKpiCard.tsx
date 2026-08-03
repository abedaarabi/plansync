"use client";

import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONE_BORDER: Record<Tone, string> = {
  neutral: "border-l-[var(--enterprise-border)]",
  primary: "border-l-[var(--enterprise-primary)]",
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
};

type Props = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: Tone;
};

export function OmKpiCard({ label, value, icon: Icon, hint, tone = "primary" }: Props) {
  return (
    <div
      className={`enterprise-card rounded-lg border-l-[3px] px-2.5 py-2 ${TONE_BORDER[tone]}`}
      title={hint}
    >
      <div className="flex items-center gap-1.5">
        {Icon ? (
          <Icon
            className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null}
        <p className="text-base font-bold tabular-nums leading-none tracking-tight text-[var(--enterprise-text)] sm:text-lg">
          {value}
        </p>
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] leading-snug text-[var(--enterprise-text-muted)]">
        {label}
      </p>
    </div>
  );
}
