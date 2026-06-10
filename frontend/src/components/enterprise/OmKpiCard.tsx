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
    <div className={`enterprise-card rounded-xl border-l-4 p-3 sm:p-4 ${TONE_BORDER[tone]}`}>
      {Icon ? (
        <Icon className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} aria-hidden />
      ) : null}
      <p
        className={`text-xl font-bold tabular-nums tracking-tight text-[var(--enterprise-text)] sm:text-2xl ${Icon ? "mt-1.5" : ""}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold leading-snug text-[var(--enterprise-text-muted)]">
        {label}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
