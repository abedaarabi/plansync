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

/**
 * Dense page header for enterprise list/detail screens.
 * Primary action sits right; optional filters go in `children`.
 */
export function OmSubPageHeader({
  icon: Icon,
  title,
  badge,
  description,
  action,
  children,
}: Props) {
  return (
    <header className="mb-3 space-y-2 border-b border-[var(--enterprise-border)] pb-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
            aria-hidden
          >
            <Icon className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="enterprise-type-title flex flex-wrap items-center gap-2">
              {title}
              {badge ? (
                <span className="enterprise-badge-warning rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  {badge}
                </span>
              ) : null}
            </h1>
            {description ? <p className="enterprise-type-subtitle mt-1">{description}</p> : null}
          </div>
        </div>
        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{action}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
