"use client";

import type { LucideIcon } from "lucide-react";

export function EnterpriseOverviewCard({
  title,
  icon: Icon,
  children,
  compact,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  /** Tighter padding for denser panels (e.g. Insights slide-over). */
  compact?: boolean;
}) {
  return (
    <section className={`enterprise-card flex min-w-0 flex-col ${compact ? "p-3" : "p-4"}`}>
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {title}
      </h3>
      <div className={`min-w-0 flex-1 ${compact ? "mt-2" : "mt-3"}`}>{children}</div>
    </section>
  );
}
