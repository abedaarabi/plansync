"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  badge?: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
};

export function OmSubPageHeader({
  icon: Icon,
  title,
  badge,
  description,
  action,
  children,
}: Props) {
  return (
    <header className="mb-3 space-y-2 border-b border-[var(--enterprise-border)] pb-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]"
            aria-hidden
          >
            <Icon className="h-5 w-5 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
              {title}
              {badge ? (
                <span className="enterprise-badge-warning rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {badge}
                </span>
              ) : null}
            </h1>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}
