"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSectionCard } from "@/components/enterprise/OmSectionCard";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import {
  deleteOmPartsInventoryItem,
  fetchOmPartsInventory,
  postOmPartsInventoryItem,
  ProRequiredError,
  type OmPartsInventoryRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

import { OM_COMPACT_INPUT, OM_COMPACT_LABEL, OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type Props = { projectId: string };

function stockTone(item: OmPartsInventoryRow): "success" | "warning" | "danger" {
  if (item.quantity <= 0) return "danger";
  if (item.lowStock) return "warning";
  return "success";
}

const STOCK_ACCENT = {
  success: "border-l-[var(--enterprise-semantic-success-text)]",
  warning: "border-l-[var(--enterprise-semantic-warning-text)]",
  danger: "border-l-[var(--enterprise-semantic-danger-muted)]",
};

const STOCK_BAR = {
  success: "bg-[var(--enterprise-primary)]",
  warning: "bg-[var(--enterprise-semantic-warning-text)]",
  danger: "bg-[var(--enterprise-semantic-danger-muted)]",
};

function PartListCard({ item, onDelete }: { item: OmPartsInventoryRow; onDelete: () => void }) {
  const tone = stockTone(item);
  const maxBar = Math.max(item.reorderLevel * 2, item.quantity, 1);
  const pct = Math.min(100, Math.round((item.quantity / maxBar) * 100));

  return (
    <li
      className={`flex items-center gap-2.5 border-l-[3px] bg-[var(--enterprise-surface)] px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5 ${STOCK_ACCENT[tone]}`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
        aria-hidden
      >
        <Package className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--enterprise-text)]">
            {item.name}
          </p>
          {item.lowStock ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] px-1.5 py-px text-[10px] font-semibold text-[var(--enterprise-semantic-warning-text)]">
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
              Low
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--enterprise-border)]/60">
              <div
                className={`h-full rounded-full transition-[width] ${STOCK_BAR[tone]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--enterprise-text)]">
            {item.quantity}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-[var(--enterprise-text-muted)]">
          Reorder {item.reorderLevel}
          {item.unitCost != null ? ` · $${item.unitCost.toFixed(2)} ea` : ""}
        </p>
      </div>
      <EnterpriseButton
        size="sm"
        variant="ghost"
        className="!min-h-8 !px-2 text-[var(--enterprise-semantic-danger-text)]"
        onClick={onDelete}
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </EnterpriseButton>
    </li>
  );
}

export function OmPartsInventoryClient({ projectId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [unitCost, setUnitCost] = useState("");

  const { data: items = [], isPending } = useQuery({
    queryKey: qk.omPartsInventory(projectId),
    queryFn: () => fetchOmPartsInventory(projectId),
  });

  const createMut = useMutation({
    mutationFn: () =>
      postOmPartsInventoryItem(projectId, {
        name: name.trim(),
        quantity: parseInt(quantity, 10) || 0,
        reorderLevel: parseInt(reorderLevel, 10) || 0,
        unitCost: unitCost.trim() ? parseFloat(unitCost) : undefined,
      }),
    onSuccess: async () => {
      setName("");
      setQuantity("0");
      setUnitCost("");
      await qc.invalidateQueries({ queryKey: qk.omPartsInventory(projectId) });
      toast.success("Part added.");
    },
    onError: (e: Error) => toast.error(e instanceof ProRequiredError ? "Pro required." : e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOmPartsInventoryItem(projectId, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.omPartsInventory(projectId) });
      toast.success("Part removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lowStockCount = items.filter((i) => i.lowStock).length;

  if (isPending) return <EnterpriseLoadingState message="Loading parts…" label="Loading" />;

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={Package}
        title="Parts inventory"
        description="Stock tracked when technicians complete work orders."
      />

      <OmSectionCard
        title="Add part"
        description="Quantity updates automatically on work order completion."
      >
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createMut.mutate();
          }}
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={OM_COMPACT_LABEL}>Part name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={OM_COMPACT_INPUT}
              required
            />
          </div>
          <div>
            <label className={OM_COMPACT_LABEL}>Qty</label>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={OM_COMPACT_INPUT}
            />
          </div>
          <div>
            <label className={OM_COMPACT_LABEL}>Reorder</label>
            <input
              type="number"
              min={0}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              className={OM_COMPACT_INPUT}
            />
          </div>
          <div>
            <label className={OM_COMPACT_LABEL}>Unit cost</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className={OM_COMPACT_INPUT}
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <EnterpriseButton
              type="submit"
              size="sm"
              loading={createMut.isPending}
              className="w-full lg:w-auto"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </EnterpriseButton>
          </div>
        </form>
      </OmSectionCard>

      {items.length === 0 ? (
        <OmEmptyState
          icon={Package}
          title="No parts in inventory"
          description="Track consumables and spares so completion forms can deduct stock automatically."
        />
      ) : (
        <OmSectionCard
          title="Stock on hand"
          description={
            lowStockCount > 0
              ? `${items.length} parts · ${lowStockCount} below reorder`
              : `${items.length} part${items.length === 1 ? "" : "s"} tracked`
          }
        >
          <ul className="divide-y divide-[var(--enterprise-border)]/80 overflow-hidden rounded-lg border border-[var(--enterprise-border)]">
            {items.map((p) => (
              <PartListCard key={p.id} item={p} onDelete={() => deleteMut.mutate(p.id)} />
            ))}
          </ul>
        </OmSectionCard>
      )}
    </div>
  );
}
