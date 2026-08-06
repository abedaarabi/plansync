"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  /** Optional badge next to the title (e.g. “Enterprise”). */
  badge?: ReactNode;
  footer?: ReactNode;
};

/** Card section with icon header — matches Organization / Plan & billing chrome. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  badge,
  footer,
}: Props) {
  return (
    <section className="enterprise-card overflow-hidden">
      <div className="border-b border-[var(--enterprise-border)] bg-[linear-gradient(135deg,var(--enterprise-primary-soft),transparent_55%)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)] ring-1 ring-[var(--enterprise-border)]"
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
                {title}
              </h2>
              {badge}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-4 py-4 sm:px-5">{children}</div>
      {footer ? (
        <div className="border-t border-[var(--enterprise-border-subtle)] px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
