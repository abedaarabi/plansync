"use client";

import { AlertTriangle, Calendar, UserRound } from "lucide-react";
import type { WorkOrdersOverviewStats } from "@/lib/workOrdersOverviewStats";
import type { WorkOrdersOverviewFilter } from "@/lib/workOrdersOverviewStats";

type Props = {
  stats: WorkOrdersOverviewStats;
  filter: WorkOrdersOverviewFilter;
  onSelect: (filter: WorkOrdersOverviewFilter) => void;
};

const TILES: {
  key: WorkOrdersOverviewFilter;
  label: string;
  icon: typeof UserRound;
  count: (s: WorkOrdersOverviewStats) => number;
  danger?: boolean;
}[] = [
  { key: "MINE", label: "Mine", icon: UserRound, count: (s) => s.mine },
  { key: "DUE_TODAY", label: "Due today", icon: Calendar, count: (s) => s.dueToday },
  {
    key: "OVERDUE",
    label: "Overdue",
    icon: AlertTriangle,
    count: (s) => s.overdue,
    danger: true,
  },
];

/** Shift-start strip — Mine / Due today / Overdue (Procore/Dalux “my day”). */
export function WorkOrdersMyDayStrip({ stats, filter, onSelect }: Props) {
  return (
    <section
      aria-label="My day"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 shadow-[var(--enterprise-shadow-xs)]"
    >
      {TILES.map((t) => {
        const n = t.count(stats);
        const active = filter === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(active ? "ACTIVE" : t.key)}
            className={`flex min-h-14 flex-col items-start justify-center rounded-xl px-2.5 py-2 text-left transition ${
              active
                ? "bg-[var(--enterprise-primary)] text-white shadow-sm"
                : "bg-[var(--enterprise-bg)]/60 text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
            }`}
          >
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                active
                  ? "text-white/80"
                  : t.danger && n > 0
                    ? "text-red-600 dark:text-red-300"
                    : "text-[var(--enterprise-text-muted)]"
              }`}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {t.label}
            </span>
            <span className="mt-0.5 text-xl font-semibold tabular-nums leading-none">{n}</span>
          </button>
        );
      })}
    </section>
  );
}
