"use client";

import { getProjectTypeVisual } from "@/lib/projectTypeStyle";

type Props = {
  type: string | null | undefined;
  className?: string;
};

export function ProjectTypeChip({ type, className = "" }: Props) {
  const raw = (type ?? "").trim();
  const visual = getProjectTypeVisual(raw);
  if (!visual) return null;
  const { Icon, chipClass } = visual;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${chipClass} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2} />
      <span className="truncate">{raw}</span>
    </span>
  );
}
