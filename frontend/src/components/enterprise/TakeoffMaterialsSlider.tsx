"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";
import type { MaterialRow } from "@/lib/api-client";

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
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((m) =>
      `${m.category.name} ${m.name} ${m.sku ?? ""} ${m.unit}`.toLowerCase().includes(query),
    );
  }, [materials, q]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverflowX = document.body.style.overflowX;
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overflowX = prevOverflowX;
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden overscroll-x-none overscroll-y-none bg-black/40"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="ml-auto flex h-full w-full min-w-0 max-w-xl flex-col overflow-hidden border-l border-[#334155] bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">Workspace materials</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-[#F1F5F9]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, category, SKU..."
              className="w-full rounded-md border border-[#E2E8F0] py-2 pl-8 pr-3 text-sm"
            />
          </label>
          {!workspaceId ? (
            <p className="mt-4 text-sm text-[#64748B]">
              Open from a workspace project to load materials.
            </p>
          ) : materialsLoading ? (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </p>
          ) : materialsError ? (
            <p className="mt-4 text-sm text-red-700">Could not load materials.</p>
          ) : (
            <ul className="mt-3 max-h-[calc(100vh-9rem)] overflow-y-auto divide-y divide-[#E2E8F0] rounded-md border border-[#E2E8F0]">
              {filtered.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{m.name}</p>
                    <p className="truncate text-xs text-[#64748B]">
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
                    className="shrink-0 rounded-md border border-[#2563EB] bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#1D4ED8]"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
