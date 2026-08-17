"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";
import { elementRowTintVars, resolveElementDisplayColor } from "@/lib/bim/elementDisplay";
import { bimIndexBuilding, bimIndexStatusLabel } from "@/lib/bim/indexStatus";

// fallow-ignore-next-line complexity
export function BimElementCatalog(props: {
  index: BimQuantityIndex | null;
  conversionStatus?: string;
  indexProgress?: number | null;
  indexPhase?: "summary" | "full" | null;
  errorMessage?: string | null;
  selectedGuids: Set<string>;
  onSelectGuids: (guids: string[], additive: boolean) => void;
  onSelectType: (ifcType: string, additive: boolean) => void;
  onSelectTypeName?: (typeName: string, additive: boolean) => void;
  onRebuildIndex?: () => void;
  searchQuery?: string;
}) {
  const [search, setSearch] = useState("");
  const effectiveSearch = props.searchQuery?.trim() ? props.searchQuery : search;
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [typeNamesOpen, setTypeNamesOpen] = useState(true);
  const [typesOpen, setTypesOpen] = useState(true);
  const [levelsOpen, setLevelsOpen] = useState(true);

  const byGuid = useMemo(() => {
    const map = new Map<string, BimQuantityEntry>();
    for (const el of props.index?.elements ?? []) map.set(el.guid, el);
    return map;
  }, [props.index]);

  const selectedEntries = useMemo(() => {
    return [...props.selectedGuids]
      .map((guid) => byGuid.get(guid))
      .filter((el): el is BimQuantityEntry => el != null);
  }, [props.selectedGuids, byGuid]);

  const filteredTypeNames = useMemo(() => {
    if (!props.index) return [];
    const q = effectiveSearch.trim().toLowerCase();
    const fromAgg = props.index.byTypeName ? Object.values(props.index.byTypeName) : null;
    if (fromAgg && fromAgg.length > 0) {
      return fromAgg
        .filter((t) => !q || t.typeName.toLowerCase().includes(q))
        .sort((a, b) => b.count - a.count || a.typeName.localeCompare(b.typeName));
    }
    const counts = new Map<string, { typeName: string; count: number; guids: string[] }>();
    for (const el of props.index.elements) {
      const typeName = el.typeName?.trim();
      if (!typeName) continue;
      if (q && !typeName.toLowerCase().includes(q)) continue;
      let row = counts.get(typeName);
      if (!row) {
        row = { typeName, count: 0, guids: [] };
        counts.set(typeName, row);
      }
      row.count += 1;
      row.guids.push(el.guid);
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.typeName.localeCompare(b.typeName),
    );
  }, [props.index, effectiveSearch]);

  const filteredTypes = useMemo(() => {
    if (!props.index) return [];
    const q = effectiveSearch.trim().toLowerCase();
    return Object.values(props.index.byType).filter(
      (t) => !q || t.ifcType.toLowerCase().includes(q),
    );
  }, [props.index, effectiveSearch]);

  const filteredLevels = useMemo(() => {
    if (!props.index) return [];
    const q = effectiveSearch.trim().toLowerCase();
    return Object.values(props.index.byLevel).filter(
      (l) => !q || l.level.toLowerCase().includes(q),
    );
  }, [props.index, effectiveSearch]);

  if (!props.index) {
    const waiting = bimIndexBuilding(props.conversionStatus ?? "");
    const indexingPct =
      props.indexProgress != null && Number.isFinite(props.indexProgress)
        ? Math.max(0, Math.min(100, Math.round(props.indexProgress)))
        : null;
    const message =
      props.errorMessage ??
      (waiting
        ? bimIndexStatusLabel(props.conversionStatus ?? "pending", props.indexPhase)
        : props.conversionStatus === "failed"
          ? "Quantity index build failed."
          : "Quantity index loading…");
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--bim-text)]">
          {waiting || !props.errorMessage ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--bim-accent)]" aria-hidden />
          ) : null}
          <span>{message}</span>
          {waiting && indexingPct != null ? (
            <span className="ml-auto tabular-nums text-[var(--bim-text-muted)]">
              {indexingPct}%
            </span>
          ) : null}
        </div>
        {waiting ? (
          <div className="bim-loading-progress__track mt-3">
            {indexingPct != null ? (
              <div className="bim-loading-progress__fill" style={{ width: `${indexingPct}%` }} />
            ) : (
              <div className="bim-loading-bar bim-loading-progress__fill bim-loading-progress__fill--indeterminate" />
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const partialNote = props.index.partial ? " · quantities loading" : "";
  const typeNameCount = filteredTypeNames.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-[var(--bim-border)] bg-[var(--bim-hover)] px-4 py-2.5 text-[11px] text-[var(--bim-text-muted)]">
        {props.index.elements.length.toLocaleString()} elements indexed ·{" "}
        {typeNameCount.toLocaleString()} type names ·{" "}
        {Object.keys(props.index.byType).length.toLocaleString()} categories ·{" "}
        {Object.keys(props.index.byLevel).length.toLocaleString()} levels
        {partialNote}
      </p>
      <div className="border-b border-[var(--bim-border)] px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bim-text-muted)]" />
          <input
            type="search"
            value={props.searchQuery != null ? props.searchQuery : search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by type name, category, GUID…"
            className="bim-input bim-input--icon"
            aria-label="Search elements"
          />
        </div>
      </div>
      {selectedEntries.length > 0 ? (
        <div className="flex max-h-[min(32dvh,260px)] min-h-0 shrink-0 flex-col border-b border-[var(--bim-border)] px-2 pt-2">
          <SectionHeader
            title={`Selection (${selectedEntries.length.toLocaleString()})`}
            open={selectionOpen}
            onToggle={() => setSelectionOpen((v) => !v)}
          />
          {selectionOpen ? (
            <div className="bim-dock-scroll mb-2 rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)]">
              {selectedEntries.map((el) => (
                <ElementRow
                  key={el.guid}
                  entry={el}
                  selected
                  onClick={(e) => props.onSelectGuids([el.guid], e.ctrlKey || e.metaKey)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bim-dock-scroll px-2 py-2">
        <CatalogSection
          title="By type name"
          open={typeNamesOpen}
          onToggle={() => setTypeNamesOpen((v) => !v)}
        >
          {filteredTypeNames.length === 0 ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
                No type names in this index yet. Rebuild the quantity index to extract IFC type
                names for selection and cost grouping.
              </p>
              {props.onRebuildIndex ? (
                <button
                  type="button"
                  onClick={props.onRebuildIndex}
                  className="bim-focus-ring text-[11px] font-medium text-[var(--bim-accent)] hover:underline"
                >
                  Rebuild index
                </button>
              ) : null}
            </div>
          ) : (
            filteredTypeNames.map((t) => (
              <button
                key={t.typeName}
                type="button"
                onClick={(e) => {
                  if (props.onSelectTypeName) {
                    props.onSelectTypeName(t.typeName, e.ctrlKey || e.metaKey);
                    return;
                  }
                  props.onSelectGuids(t.guids, e.ctrlKey || e.metaKey);
                }}
                className="bim-focus-ring bim-tree-row"
              >
                <span className="min-w-0 flex-1 truncate">{t.typeName}</span>
                <span className="text-[10px] text-[var(--bim-text-muted)]">{t.count}</span>
              </button>
            ))
          )}
        </CatalogSection>

        <CatalogSection
          title="By category"
          open={typesOpen}
          onToggle={() => setTypesOpen((v) => !v)}
        >
          {filteredTypes.map((t) => (
            <button
              key={t.ifcType}
              type="button"
              onClick={(e) => props.onSelectType(t.ifcType, e.ctrlKey || e.metaKey)}
              className="bim-focus-ring bim-tree-row"
            >
              <span className="min-w-0 flex-1 truncate">{t.ifcType.replace(/^Ifc/i, "")}</span>
              <span className="text-[10px] text-[var(--bim-text-muted)]">{t.count}</span>
            </button>
          ))}
        </CatalogSection>

        <CatalogSection
          title="By level"
          open={levelsOpen}
          onToggle={() => setLevelsOpen((v) => !v)}
        >
          {filteredLevels.map((l) => (
            <button
              key={l.level}
              type="button"
              onClick={(e) => props.onSelectGuids(l.guids, e.ctrlKey || e.metaKey)}
              className="bim-focus-ring bim-tree-row"
            >
              <span className="min-w-0 flex-1 truncate">{l.level}</span>
              <span className="text-[10px] text-[var(--bim-text-muted)]">{l.count}</span>
            </button>
          ))}
        </CatalogSection>

        {effectiveSearch ? (
          <div className="mt-2">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--bim-text-muted)]">
              Matching elements
            </p>
            {props.index.elements
              .filter((el) => {
                const q = effectiveSearch.toLowerCase();
                return (
                  el.guid.toLowerCase().includes(q) ||
                  (el.name?.toLowerCase().includes(q) ?? false) ||
                  (el.typeName?.toLowerCase().includes(q) ?? false) ||
                  el.ifcType.toLowerCase().includes(q)
                );
              })
              .slice(0, 40)
              .map((el) => (
                <ElementRow
                  key={el.guid}
                  entry={el}
                  selected={props.selectedGuids.has(el.guid)}
                  onClick={(e) => props.onSelectGuids([el.guid], e.ctrlKey || e.metaKey)}
                />
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// fallow-ignore-next-line complexity
function ElementRow(props: {
  entry: BimQuantityEntry;
  selected?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { entry } = props;
  const displayColor = resolveElementDisplayColor(entry);

  return (
    <button
      type="button"
      onClick={props.onClick}
      data-selected={props.selected ? "true" : undefined}
      data-tint="true"
      style={elementRowTintVars(displayColor.hex)}
      title={`${displayColor.label}: ${displayColor.hex}`}
      className="bim-focus-ring bim-tree-row py-1.5"
    >
      <span className="min-w-0 flex-1 truncate text-[11px]">
        {entry.sourceLabel ? (
          <span className="text-[10px] text-[var(--bim-text-muted)]">{entry.sourceLabel} · </span>
        ) : null}
        {entry.name ?? entry.typeName ?? entry.ifcType.replace(/^Ifc/i, "")}
      </span>
      {entry.lodFlags.color ? (
        <span className="shrink-0 rounded-full bg-[var(--bim-hover)] px-1.5 py-px text-[9px] font-semibold text-[var(--bim-text-muted)]">
          IFC
        </span>
      ) : null}
    </button>
  );
}

function SectionHeader(props: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="bim-focus-ring mb-1 flex w-full shrink-0 items-center gap-1 px-2"
    >
      {props.open ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--bim-text-muted)]">
        {props.title}
      </span>
    </button>
  );
}

function CatalogSection(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-2">
      <SectionHeader title={props.title} open={props.open} onToggle={props.onToggle} />
      {props.open ? props.children : null}
    </div>
  );
}
