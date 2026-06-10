"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function OmEmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="enterprise-card flex flex-col items-center gap-3 px-5 py-10 text-center sm:py-12">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]"
        aria-hidden
      >
        <Icon className="h-5 w-5 text-[var(--enterprise-primary)]/60" strokeWidth={1.5} />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">{title}</p>
        <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
