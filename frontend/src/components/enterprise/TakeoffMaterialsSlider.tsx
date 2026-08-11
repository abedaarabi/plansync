"use client";

import { useMemo, useState } from "react";
import { Loader2, Package, Search } from "lucide-react";
import type { MaterialRow } from "@/lib/api-client";
import {
  EnterpriseSlideOver,
  SlideOverHeader,
  SLIDE_OVER_BTN_SECONDARY,
} from "@/components/enterprise/EnterpriseSlideOver";

export function TakeoffMaterialsSlider({
  open,
  onClose,
  workspaceId,
  materials,
  materialsLoading,
  materialsError,
  onAddMaterial,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string | null;
  materials: MaterialRow[];
  materialsLoading: boolean;
  materialsError: boolean;
  onAddMaterial: (materialId: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((m) =>
      `${m.category.name} ${m.name} ${m.sku ?? ""} ${m.unit}`.toLowerCase().includes(query),
    );
  }, [materials, q]);

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="takeoff-materials-title"
      panelMaxWidthClass="max-w-[min(calc(100dvw-16px),420px)]"
      header={
        <SlideOverHeader
          icon={Package}
          titleId="takeoff-materials-title"
          title="Workspace materials"
          description="Search catalog and add items to this takeoff."
        />
      }
      footer={
        <button type="button" onClick={onClose} className={SLIDE_OVER_BTN_SECONDARY}>
          Close
        </button>
      }
    >
      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, category, SKU…"
            className="enterprise-field-input enterprise-field-input--icon-sm"
          />
        </label>
        {!workspaceId ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            Open from a workspace project to load materials.
          </p>
        ) : materialsLoading ? (
          <p className="inline-flex items-center gap-2 text-sm text-[var(--enterprise-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : materialsError ? (
          <p className="text-sm text-[var(--enterprise-semantic-danger-text)]">
            Could not load materials.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--enterprise-border)] overflow-hidden rounded-md border border-[var(--enterprise-border)]">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                No matching materials
              </li>
            ) : (
              filtered.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                      {m.name}
                    </p>
                    <p className="truncate text-xs text-[var(--enterprise-text-muted)]">
                      {m.category.name}
                      {m.sku ? ` · ${m.sku}` : ""}
                      {m.unitPrice != null && m.unitPrice !== ""
                        ? ` · ${m.currency} ${m.unitPrice}/${m.unit}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddMaterial(m.id)}
                    className="shrink-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
                  >
                    Add
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </EnterpriseSlideOver>
  );
}
