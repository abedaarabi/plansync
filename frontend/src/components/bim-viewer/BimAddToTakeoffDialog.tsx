"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Link2,
  Loader2,
  Package,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { fetchMaterials, fetchProject, type MaterialRow } from "@/lib/api-client";
import { importBimTakeoff } from "@/lib/api-client/bim-viewer";
import {
  formatModelQuantity,
  modelQuantityHint,
  pickModelQuantityAndUnit,
  type BimModelQuantityRollup,
} from "@/lib/bim/modelQuantity";
import type { BimCostGroup } from "@/lib/bim/takeoffGrouping";
import { useProjectMeasurementSystem } from "@/hooks/useProjectMeasurementSystem";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
} from "@/lib/mobileFormStyles";

export type BimTakeoffSelectionSummary = {
  elementCount: number;
  ifcTypes: string[];
  sampleName?: string | null;
  /** Recommended cost/takeoff groups (Type name preferred). */
  costGroups?: BimCostGroup[];
  costGroupingHint?: string;
};

function defaultLabel(m: MaterialRow): string {
  return `${m.category.name} — ${m.name}`;
}

const fieldInput = `${MOBILE_FIELD_INPUT} min-h-11 text-sm`;

// fallow-ignore-next-line complexity
export function BimAddToTakeoffDialog(props: {
  open: boolean;
  onClose: () => void;
  fileVersionId: string;
  projectId: string | null;
  selectedGuids: string[];
  selectionSummary: BimTakeoffSelectionSummary | null;
  resolveModelQuantities: () => Promise<BimModelQuantityRollup>;
  onSuccess?: () => void;
}) {
  const { measurementSystem } = useProjectMeasurementSystem(props.projectId ?? undefined);
  const [materialSearch, setMaterialSearch] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("ea");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [quantitiesLoading, setQuantitiesLoading] = useState(false);
  const [modelRollup, setModelRollup] = useState<BimModelQuantityRollup>({
    count: 0,
    length: null,
    area: null,
    volume: null,
  });
  const wasOpenRef = useRef(false);
  const loadedSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!props.open || !props.projectId) {
      setMaterials([]);
      setMaterialsLoading(false);
      return;
    }

    let cancelled = false;
    setMaterialsLoading(true);

    // fallow-ignore-next-line complexity
    void (async () => {
      try {
        const project = await fetchProject(props.projectId!);
        if (cancelled) return;
        const rows = await fetchMaterials(project.workspaceId);
        if (cancelled) return;
        setMaterials(rows);
      } catch (e) {
        if (cancelled) return;
        setMaterials([]);
        toast.error(e instanceof Error ? e.message : "Could not load materials.");
      } finally {
        if (!cancelled) setMaterialsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.open, props.projectId]);

  useEffect(() => {
    if (props.open && !wasOpenRef.current) {
      setMaterialSearch("");
      setSelectedMaterialId(null);
      setPickerOpen(true);
      setLabel("");
      setNotes("");
    }
    wasOpenRef.current = props.open;
  }, [props.open]);

  useEffect(() => {
    if (!props.open) {
      loadedSelectionKeyRef.current = null;
      return;
    }

    const selectionKey = [...props.selectedGuids].sort().join("|");
    if (selectionKey === loadedSelectionKeyRef.current) return;

    let cancelled = false;
    setQuantitiesLoading(true);

    // fallow-ignore-next-line complexity
    void (async () => {
      try {
        const rollup = await props.resolveModelQuantities();
        if (cancelled) return;
        loadedSelectionKeyRef.current = selectionKey;
        setModelRollup(rollup);
        const { quantity, unit: modelUnit } = pickModelQuantityAndUnit(
          rollup,
          undefined,
          measurementSystem,
        );
        setQuantity(formatModelQuantity(quantity));
        setUnit(modelUnit);
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Could not read model quantities.");
      } finally {
        if (!cancelled) setQuantitiesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.open, props.resolveModelQuantities, props.selectedGuids, measurementSystem]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => {
      const hay = `${m.category.name} ${m.name} ${m.sku ?? ""} ${m.supplier ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [materialSearch, materials]);

  function selectMaterial(m: MaterialRow) {
    setSelectedMaterialId(m.id);
    setLabel(defaultLabel(m));
    const materialUnit = m.unit?.trim() || "ea";
    const { quantity: qty } = pickModelQuantityAndUnit(
      modelRollup,
      materialUnit,
      measurementSystem,
    );
    setUnit(materialUnit);
    setQuantity(formatModelQuantity(qty));
    setPickerOpen(false);
  }

  function clearMaterial() {
    setSelectedMaterialId(null);
    setPickerOpen(true);
    setLabel("");
    const { quantity, unit: modelUnit } = pickModelQuantityAndUnit(
      modelRollup,
      undefined,
      measurementSystem,
    );
    setUnit(modelUnit);
    setQuantity(formatModelQuantity(quantity));
  }

  // fallow-ignore-next-line complexity
  const selectionLabel = useMemo(() => {
    const n = props.selectionSummary?.elementCount ?? props.selectedGuids.length;
    if (n === 0) return "No elements selected";
    const types = props.selectionSummary?.ifcTypes ?? [];
    const typeHint =
      types.length === 1
        ? types[0]
        : types.length > 1
          ? `${types.slice(0, 2).join(", ")}${types.length > 2 ? ` +${types.length - 2}` : ""}`
          : null;
    const base = n === 1 ? "1 element" : `${n} elements`;
    return typeHint ? `${base} · ${typeHint}` : base;
  }, [props.selectionSummary, props.selectedGuids.length]);

  const modelQtyHint = useMemo(
    () => modelQuantityHint(modelRollup, measurementSystem),
    [modelRollup, measurementSystem],
  );

  // fallow-ignore-next-line complexity
  async function submit() {
    if (props.selectedGuids.length === 0) {
      toast.error("Select at least one element in the model.");
      return;
    }
    if (!selectedMaterialId) {
      toast.error("Choose a catalog material.");
      return;
    }
    const qty = Number(quantity.replace(/,/g, "").trim());
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      toast.error("Enter a line label.");
      return;
    }

    setSubmitting(true);
    try {
      await importBimTakeoff(props.fileVersionId, {
        guids: props.selectedGuids,
        materialId: selectedMaterialId,
        quantity: qty,
        label: trimmedLabel,
        unit: unit.trim() || selectedMaterial?.unit || "ea",
        notes: notes.trim() || undefined,
      });
      toast.success("Added to project takeoff.");
      props.onSuccess?.();
      props.onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add takeoff line.");
    } finally {
      setSubmitting(false);
    }
  }

  const titleId = "bim-add-takeoff-title";
  const descId = "bim-add-takeoff-desc";
  const canSubmit =
    !submitting &&
    Boolean(selectedMaterialId) &&
    props.selectedGuids.length > 0 &&
    Boolean(props.projectId);

  // fallow-ignore-next-line complexity
  const materialRows = filteredMaterials.map((m) => {
    const active = m.id === selectedMaterialId;
    return (
      <li key={m.id}>
        <button
          type="button"
          role="option"
          aria-selected={active}
          onClick={() => selectMaterial(m)}
          className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition ${
            active
              ? "bg-[var(--enterprise-primary-soft)] ring-1 ring-inset ring-[var(--enterprise-primary)]/25"
              : "hover:bg-[var(--enterprise-hover-surface)]"
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-[var(--enterprise-text)]">{m.name}</span>
            <span className="block text-xs text-[var(--enterprise-text-muted)]">
              {m.category.name}
              {m.unit ? ` · ${m.unit}` : ""}
              {m.sku ? ` · ${m.sku}` : ""}
            </span>
          </span>
          {active ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]" />
          ) : null}
        </button>
      </li>
    );
  });

  return (
    <EnterpriseResponsiveDialog
      open={props.open}
      onClose={props.onClose}
      variant="enterprise"
      ariaLabelledBy={titleId}
      ariaDescribedBy={descId}
      panelClassName="max-w-xl rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-0"
      bodyClassName="p-0"
      footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3 lg:px-5"
      footer={
        <>
          <button
            type="button"
            onClick={props.onClose}
            disabled={submitting}
            className="rounded-lg border border-[var(--enterprise-border)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="h-4 w-4" aria-hidden />
            )}
            {submitting ? "Adding…" : "Add to takeoff"}
          </button>
        </>
      }
    >
      <div className="border-b border-[var(--enterprise-border)] px-4 py-4 lg:px-5">
        <h2
          id={titleId}
          className="inline-flex items-center gap-2 text-base font-semibold text-[var(--enterprise-text)]"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
            <Package className="h-4 w-4" aria-hidden />
          </span>
          Add selection to takeoff
        </h2>
        <p
          id={descId}
          className="mt-1.5 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
        >
          Link model elements to a catalog material. Quantity is suggested from the model and you
          can adjust it before saving.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 lg:px-5">
        <div className="rounded-xl border border-[var(--enterprise-border)] bg-slate-50/70 p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Model selection
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--enterprise-text)]">{selectionLabel}</p>
          {props.selectionSummary?.sampleName ? (
            <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
              {props.selectionSummary.sampleName}
            </p>
          ) : null}
          {props.selectionSummary?.costGroupingHint ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
              {props.selectionSummary.costGroupingHint}
            </p>
          ) : null}
          {props.selectionSummary?.costGroups && props.selectionSummary.costGroups.length > 1 ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-[var(--enterprise-text)]">
              {props.selectionSummary.costGroups.slice(0, 8).map((g) => (
                <li key={g.key} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{g.label}</span>
                  <span className="shrink-0 text-[var(--enterprise-text-muted)]">{g.count}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {modelQtyHint ? (
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              From model:{" "}
              <span className="font-medium text-[var(--enterprise-text)]">
                {quantitiesLoading ? "Loading…" : modelQtyHint}
              </span>
            </p>
          ) : quantitiesLoading ? (
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              Reading model quantities…
            </p>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
              <Package className="h-3.5 w-3.5" aria-hidden />
              Catalog material
            </p>
            {selectedMaterial ? (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
              >
                {pickerOpen ? (
                  <>
                    Hide list
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  </>
                ) : (
                  <>
                    Change
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </>
                )}
              </button>
            ) : null}
          </div>

          {selectedMaterial ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--enterprise-primary)]/30 bg-[var(--enterprise-primary-soft)]/50 px-3 py-2.5">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                  {selectedMaterial.name}
                </p>
                <p className="text-xs text-[var(--enterprise-text-muted)]">
                  {selectedMaterial.category.name}
                  {selectedMaterial.unit ? ` · ${selectedMaterial.unit}` : ""}
                  {selectedMaterial.sku ? ` · ${selectedMaterial.sku}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={clearMaterial}
                className="rounded-md p-1 text-[var(--enterprise-text-muted)] transition hover:bg-white/80 hover:text-[var(--enterprise-text)]"
                aria-label="Clear material"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {pickerOpen ? (
            <>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  placeholder="Search by name, category, SKU…"
                  className={`${fieldInput} pl-10`}
                />
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--enterprise-border)] enterprise-scrollbar">
                {!props.projectId ? (
                  <p className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                    Open this model from a project to link catalog materials.
                  </p>
                ) : materialsLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-[var(--enterprise-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading materials…
                  </div>
                ) : filteredMaterials.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                    {materials.length === 0
                      ? "No materials in this workspace yet."
                      : "No materials match your search."}
                  </p>
                ) : (
                  <ul
                    className="divide-y divide-[var(--enterprise-border)]"
                    role="listbox"
                    aria-label="Materials"
                  >
                    {materialRows}
                  </ul>
                )}
              </div>
              {!materialsLoading && materials.length > 0 ? (
                <p className="text-[11px] text-[var(--enterprise-text-muted)]">
                  {filteredMaterials.length} of {materials.length} materials
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div
          className={`space-y-3 rounded-xl border border-[var(--enterprise-border)] p-3 transition ${
            selectedMaterial ? "bg-white" : "bg-slate-50/50 opacity-60 pointer-events-none"
          }`}
          aria-hidden={!selectedMaterial}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            Takeoff line
          </p>
          {!selectedMaterial ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Select a material to edit the line.
            </p>
          ) : (
            <>
              <div>
                <label htmlFor="bim-takeoff-label" className={MOBILE_FIELD_LABEL}>
                  Label
                </label>
                <input
                  id="bim-takeoff-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Drywall — Type X"
                  className={fieldInput}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="bim-takeoff-qty" className={MOBILE_FIELD_LABEL}>
                    Quantity
                  </label>
                  <input
                    id="bim-takeoff-qty"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={quantitiesLoading}
                    className={fieldInput}
                  />
                  <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
                    Prefilled from model for this selection; edit if needed.
                  </p>
                </div>
                <div>
                  <label htmlFor="bim-takeoff-unit" className={MOBILE_FIELD_LABEL}>
                    Unit
                  </label>
                  <input
                    id="bim-takeoff-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={quantitiesLoading}
                    placeholder="ea"
                    className={fieldInput}
                  />
                  <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
                    Default from catalog; you can override.
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="bim-takeoff-notes" className={MOBILE_FIELD_LABEL}>
                  Notes{" "}
                  <span className="font-normal text-[var(--enterprise-text-muted)]">
                    (optional)
                  </span>
                </label>
                <textarea
                  id="bim-takeoff-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${MOBILE_FIELD_TEXTAREA} min-h-[5rem] text-sm`}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
