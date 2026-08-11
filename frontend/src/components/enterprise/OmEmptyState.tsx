"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

/** Operational empty state — short copy + single action, no marketing chrome. */
export function OmEmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="enterprise-card flex flex-col items-center gap-2.5 px-4 py-8 text-center sm:py-10">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
        aria-hidden
      >
        <Icon className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
      </div>
      <div className="max-w-sm space-y-1.5">
        <p className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
          {title}
        </p>
        <p className="enterprise-type-subtitle text-[0.9375rem] leading-relaxed">{description}</p>
      </div>
      {action ? <div className="pt-0.5">{action}</div> : null}
    </div>
  );
}
