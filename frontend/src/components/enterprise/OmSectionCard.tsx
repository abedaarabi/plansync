"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
};

export function OmSectionCard({ title, description, children, action }: Props) {
  return (
    <section className="enterprise-card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--enterprise-border)]/80 px-3 py-3 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-3 py-3 sm:px-4">{children}</div>
    </section>
  );
}
