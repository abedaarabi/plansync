"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Filter, Link2, Package, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { fetchTakeoffLinesForFileVersion, type TakeoffLineRow } from "@/lib/api-client";
import { autoMapBimTakeoff, bimQuantityExportUrl } from "@/lib/api-client/bim-viewer";
import { hasActiveFilter, ruleLabel, type BimFilterState } from "@/lib/bim/bimFilters";
import { BimAddToTakeoffDialog, type BimTakeoffSelectionSummary } from "./BimAddToTakeoffDialog";
import type { BimModelQuantityRollup } from "@/lib/bim/modelQuantity";
import type { BimQuantityEntry } from "@/lib/bim/types";
import { qk } from "@/lib/queryKeys";

export function BimTakeoffPanel(props: {
  fileVersionId: string | null;
  projectId: string | null;
  selectedGuids: string[];
  selectedEntries: BimQuantityEntry[];
  elementEntries: BimQuantityEntry[];
  selectionSummary: BimTakeoffSelectionSummary | null;
  resolveModelQuantities: () => Promise<BimModelQuantityRollup>;
  filterState: BimFilterState;
  filterMatches: BimQuantityEntry[];
  onFocusGuids: (guids: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const linesQuery = useQuery({
    queryKey: qk.takeoffForFileVersion(props.fileVersionId ?? ""),
    queryFn: () => fetchTakeoffLinesForFileVersion(props.fileVersionId!),
    enabled: Boolean(props.fileVersionId),
  });

  if (!props.fileVersionId) return null;

  // fallow-ignore-next-line complexity
  async function autoMap() {
    setBusy(true);
    try {
      const res = await autoMapBimTakeoff(props.fileVersionId!, { createLines: true });
      if (res.createdLineIds.length === 0) {
        toast.warning(
          res.errors?.length
            ? res.errors[0]
            : "No takeoff lines created. Rebuild the quantity index if the Objects list is empty.",
        );
        return;
      }
      const mappedCount = res.mapped.filter((m) => m.materialId).length;
      toast.success(
        `Auto-mapped ${res.createdLineIds.length} takeoff lines` +
          (mappedCount > 0 ? ` (${mappedCount} matched to catalog materials).` : "."),
      );
      await queryClient.invalidateQueries({
        queryKey: qk.takeoffForFileVersion(props.fileVersionId!),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-map failed.");
    } finally {
      setBusy(false);
    }
  }

  function openAddDialog() {
    if (props.selectedGuids.length === 0) {
      toast.error("Select at least one element.");
      return;
    }
    setDialogOpen(true);
  }

  const hasSelection = props.selectedGuids.length > 0;

  return (
    <>
      <div className="bim-detail-card">
        <div className="mb-3 flex items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="bim-section-title">Takeoff actions</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
              Link selections to catalog materials. Quantities are suggested from the model and
              editable before save.
            </p>
          </div>
        </div>

        <TakeoffFilterSummary
          filterState={props.filterState}
          matchCount={props.filterMatches.length}
        />

        <TakeoffElementList entries={props.selectedEntries} onFocusGuids={props.onFocusGuids} />

        <button
          type="button"
          disabled={busy || !hasSelection}
          onClick={openAddDialog}
          className="bim-btn-primary mb-2 w-full py-2.5"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Add selection to takeoff
        </button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void autoMap()}
            className="bim-btn-secondary w-full py-2"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Auto-map types
          </button>
          <a
            href={bimQuantityExportUrl(props.fileVersionId)}
            className="bim-btn-secondary w-full py-2"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      <SavedTakeoffLines
        lines={linesQuery.data ?? []}
        loading={linesQuery.isPending}
        entries={props.elementEntries}
        onFocusGuids={props.onFocusGuids}
      />

      <BimAddToTakeoffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fileVersionId={props.fileVersionId}
        projectId={props.projectId}
        selectedGuids={props.selectedGuids}
        selectionSummary={props.selectionSummary}
        resolveModelQuantities={props.resolveModelQuantities}
        onSuccess={() =>
          void queryClient.invalidateQueries({
            queryKey: qk.takeoffForFileVersion(props.fileVersionId!),
          })
        }
      />
    </>
  );
}

function TakeoffFilterSummary(props: { filterState: BimFilterState; matchCount: number }) {
  if (!hasActiveFilter(props.filterState)) return null;
  const labels = props.filterState.rules.map(ruleLabel);
  const query = props.filterState.textQuery.trim();
  if (query) labels.push(`Search: "${query}"`);

  return (
    <div className="mb-3 rounded-lg border border-[var(--bim-border)] bg-[var(--bim-hover)] p-3">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--bim-text-muted)]">
        <Filter className="h-3.5 w-3.5" aria-hidden />
        Active filter
      </p>
      <p className="mt-1 text-[12px] font-medium text-[var(--bim-text)]">
        {props.matchCount.toLocaleString()} matching elements
      </p>
      {labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded border border-[var(--bim-border)] bg-[var(--bim-panel)] px-1.5 py-0.5 text-[10px] text-[var(--bim-text-muted)]"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
        Select matching elements in Filters, then add the selection to this takeoff.
      </p>
    </div>
  );
}

function TakeoffElementList(props: {
  entries: BimQuantityEntry[];
  onFocusGuids: (guids: string[]) => void;
}) {
  if (props.entries.length === 0) return null;
  const preview = props.entries.slice(0, 8);
  return (
    <div className="mb-3 border-t border-[var(--bim-border)] pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="bim-section-title">Elements for this takeoff</p>
        <button
          type="button"
          onClick={() => props.onFocusGuids(props.entries.map((entry) => entry.guid))}
          className="text-[11px] font-medium text-[var(--bim-accent)] hover:underline"
        >
          Focus all
        </button>
      </div>
      <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)]">
        {preview.map((entry) => (
          <li key={entry.guid}>
            <button
              type="button"
              onClick={() => props.onFocusGuids([entry.guid])}
              className="flex w-full items-center justify-between gap-3 border-b border-[var(--bim-border)] px-2.5 py-2 text-left last:border-b-0 hover:bg-[var(--bim-hover)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium text-[var(--bim-text)]">
                  {elementLabel(entry)}
                </span>
                <span className="block truncate text-[10px] text-[var(--bim-text-muted)]">
                  {entry.ifcType} · {entry.guid}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {props.entries.length > preview.length ? (
        <p className="mt-1.5 text-[10px] text-[var(--bim-text-muted)]">
          +{props.entries.length - preview.length} more selected elements
        </p>
      ) : null}
    </div>
  );
}

function SavedTakeoffLines(props: {
  lines: TakeoffLineRow[];
  loading: boolean;
  entries: BimQuantityEntry[];
  onFocusGuids: (guids: string[]) => void;
}) {
  const entriesByGuid = useMemo(
    () => new Map(props.entries.map((entry) => [entry.guid, entry])),
    [props.entries],
  );
  const bimLines = props.lines.filter((line) => line.sourceType === "bim");

  return (
    <div className="bim-detail-card mt-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
          <Package className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="bim-section-title">Added to project takeoff</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
            Material, estimated cost, and source model elements for this revision.
          </p>
        </div>
      </div>

      {props.loading ? (
        <p className="text-[12px] text-[var(--bim-text-muted)]">Loading takeoff lines…</p>
      ) : bimLines.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-[var(--bim-text-muted)]">
          No BIM elements have been added to takeoff yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {bimLines.map((line) => (
            <SavedTakeoffLine
              key={line.id}
              line={line}
              entriesByGuid={entriesByGuid}
              onFocusGuids={props.onFocusGuids}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedTakeoffLine(props: {
  line: TakeoffLineRow;
  entriesByGuid: Map<string, BimQuantityEntry>;
  onFocusGuids: (guids: string[]) => void;
}) {
  const guids = props.line.sourceIfcGuids?.length
    ? props.line.sourceIfcGuids
    : props.line.sourceIfcGuid
      ? [props.line.sourceIfcGuid]
      : [];
  const elementNames = guids
    .map((guid) => props.entriesByGuid.get(guid))
    .filter((entry): entry is BimQuantityEntry => entry != null)
    .map(elementLabel);
  const unitPrice = Number(props.line.material?.unitPrice ?? 0);
  const total = unitPrice * Number(props.line.quantity);
  const currency = props.line.material?.currency ?? "USD";

  return (
    <li className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[var(--bim-text)]">
            {props.line.label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--bim-text-muted)]">
            {props.line.material
              ? `${props.line.material.categoryName} · ${props.line.material.name}`
              : "No catalog material"}
          </p>
        </div>
        {guids.length > 0 ? (
          <button
            type="button"
            onClick={() => props.onFocusGuids(guids)}
            className="shrink-0 text-[11px] font-medium text-[var(--bim-accent)] hover:underline"
          >
            Show {guids.length}
          </button>
        ) : null}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--bim-border)] pt-2 text-[11px]">
        <TakeoffMeta label="Quantity" value={`${props.line.quantity} ${props.line.unit}`} />
        <TakeoffMeta
          label="Unit cost"
          value={props.line.material ? formatMoney(unitPrice, currency) : "—"}
        />
        <TakeoffMeta
          label="Estimated cost"
          value={props.line.material ? formatMoney(total, currency) : "—"}
        />
        <TakeoffMeta label="Elements" value={String(guids.length)} />
      </dl>
      {elementNames.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
          {elementNames.join(" · ")}
          {guids.length > elementNames.length
            ? ` · +${guids.length - elementNames.length} more`
            : ""}
        </p>
      ) : null}
    </li>
  );
}

function TakeoffMeta(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--bim-text-muted)]">{props.label}</dt>
      <dd className="font-medium text-[var(--bim-text)]">{props.value}</dd>
    </div>
  );
}

function elementLabel(entry: BimQuantityEntry): string {
  return entry.typeName?.trim() || entry.name?.trim() || entry.ifcType;
}

function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
