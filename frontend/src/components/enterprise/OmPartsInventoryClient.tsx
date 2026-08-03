"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
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

type PartsFilter = "ALL" | "LOW" | "OUT" | "OK";

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

// fallow-ignore-next-line complexity
export function OmPartsInventoryClient({ projectId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [unitCost, setUnitCost] = useState("");
  const [filter, setFilter] = useState<PartsFilter>("ALL");

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

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    let ok = 0;
    let inventoryValue = 0;
    for (const i of items) {
      if (i.quantity <= 0) out += 1;
      else if (i.lowStock) low += 1;
      else ok += 1;
      if (i.unitCost != null) inventoryValue += i.unitCost * i.quantity;
    }
    return { total: items.length, low, out, ok, inventoryValue };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "LOW") return items.filter((i) => i.lowStock && i.quantity > 0);
    if (filter === "OUT") return items.filter((i) => i.quantity <= 0);
    if (filter === "OK") return items.filter((i) => !i.lowStock && i.quantity > 0);
    return items;
  }, [items, filter]);

  if (isPending) return <EnterpriseLoadingState message="Loading parts…" label="Loading" />;

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={Package}
        title="Parts inventory"
        description="Stock tracked when technicians complete work orders."
      />

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <EnterpriseOverviewKpiTile
            label="Total"
            value={stats.total}
            borderClass="border-l-[var(--enterprise-primary)]"
            hint={
              stats.inventoryValue > 0
                ? `On-hand value ≈ $${stats.inventoryValue.toFixed(0)}`
                : undefined
            }
            active={filter === "ALL"}
            onClick={() => setFilter("ALL")}
          />
          <EnterpriseOverviewKpiTile
            label="In stock"
            value={stats.ok}
            borderClass="border-l-[var(--enterprise-semantic-success-text)]"
            active={filter === "OK"}
            onClick={() => setFilter("OK")}
          />
          <EnterpriseOverviewKpiTile
            label="Low stock"
            value={stats.low}
            borderClass={
              stats.low > 0
                ? "border-l-[var(--enterprise-semantic-warning-text)]"
                : "border-l-[var(--enterprise-border)]"
            }
            active={filter === "LOW"}
            onClick={() => setFilter("LOW")}
          />
          <EnterpriseOverviewKpiTile
            label="Out of stock"
            value={stats.out}
            borderClass={
              stats.out > 0
                ? "border-l-[var(--enterprise-semantic-danger-muted)]"
                : "border-l-[var(--enterprise-border)]"
            }
            active={filter === "OUT"}
            onClick={() => setFilter("OUT")}
          />
        </div>
      ) : null}

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
            filter === "ALL"
              ? stats.low + stats.out > 0
                ? `${items.length} parts · ${stats.low + stats.out} need attention`
                : `${items.length} part${items.length === 1 ? "" : "s"} tracked`
              : `${filteredItems.length} of ${items.length} shown`
          }
        >
          {filteredItems.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              No parts match this filter.{" "}
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className="font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Clear filter
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-[var(--enterprise-border)]/80 overflow-hidden rounded-lg border border-[var(--enterprise-border)]">
              {filteredItems.map((p) => (
                <PartListCard key={p.id} item={p} onDelete={() => deleteMut.mutate(p.id)} />
              ))}
            </ul>
          )}
        </OmSectionCard>
      )}
    </div>
  );
}
