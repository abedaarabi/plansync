"use client";

import type { LucideIcon } from "lucide-react";
import { Layers, LayoutList, Package, Tags } from "lucide-react";

type Kpi = {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
};

type Props = {
  total: number;
  typeCount: number;
  customFieldCount: number;
  filtered: boolean;
};

export function MaterialsKpiStrip({ total, typeCount, customFieldCount, filtered }: Props) {
  const kpis: Kpi[] = [
    {
      label: "Catalog items",
      value: total,
      hint: filtered ? "Matching current filters" : "Across the workspace",
      icon: Package,
    },
    {
      label: "Material types",
      value: typeCount,
      hint: "Unique categories",
      icon: Layers,
    },
    {
      label: "Custom fields",
      value: customFieldCount,
      hint: customFieldCount > 0 ? "Catalog template columns" : "None configured",
      icon: LayoutList,
    },
    {
      label: "Scope",
      value: filtered ? "Filtered" : "All",
      hint: "Company-wide shared list",
      icon: Tags,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.label} className="enterprise-card flex gap-3 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
            <k.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-caption">{k.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
              {k.value}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">{k.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
