"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";
import { elementRowTintVars, resolveElementDisplayColor } from "@/lib/bim/elementDisplay";

// fallow-ignore-next-line complexity
export function BimElementCatalog(props: {
  index: BimQuantityIndex | null;
  conversionStatus?: string;
  errorMessage?: string | null;
  selectedGuids: Set<string>;
  onSelectGuids: (guids: string[], additive: boolean) => void;
  onSelectType: (ifcType: string, additive: boolean) => void;
  searchQuery?: string;
}) {
  const [search, setSearch] = useState("");
  const effectiveSearch = props.searchQuery?.trim() ? props.searchQuery : search;
  const [selectionOpen, setSelectionOpen] = useState(true);
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
    const waiting =
      props.conversionStatus === "running" ||
      props.conversionStatus === "summary_ready" ||
      props.conversionStatus === "pending";
    const message =
      props.errorMessage ??
      (waiting
        ? "Building quantity index…"
        : props.conversionStatus === "failed"
          ? "Quantity index build failed."
          : "Quantity index loading…");
    return <p className="px-4 py-3 text-[12px] text-[var(--bim-text-muted)]">{message}</p>;
  }

  const partialNote = props.index.partial ? " · quantities loading" : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-[var(--bim-border)] bg-[var(--bim-hover)] px-4 py-2.5 text-[11px] text-[var(--bim-text-muted)]">
        {props.index.elements.length.toLocaleString()} elements indexed ·{" "}
        {Object.keys(props.index.byType).length.toLocaleString()} types ·{" "}
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
            placeholder="Search by type, name, GUID…"
            className="bim-input pl-8"
            aria-label="Search elements"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {selectedEntries.length > 0 ? (
          <CatalogSection
            title="Selection"
            open={selectionOpen}
            onToggle={() => setSelectionOpen((v) => !v)}
          >
            {selectedEntries.map((el) => (
              <ElementRow
                key={el.guid}
                entry={el}
                selected
                onClick={(e) => props.onSelectGuids([el.guid], e.ctrlKey || e.metaKey)}
              />
            ))}
          </CatalogSection>
        ) : null}

        <CatalogSection title="By type" open={typesOpen} onToggle={() => setTypesOpen((v) => !v)}>
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
        {entry.name ?? entry.ifcType.replace(/^Ifc/i, "")}
      </span>
      {entry.lodFlags.color ? (
        <span className="shrink-0 rounded-full bg-[var(--bim-hover)] px-1.5 py-px text-[9px] font-semibold text-[var(--bim-text-muted)]">
          IFC
        </span>
      ) : null}
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
      <button
        type="button"
        onClick={props.onToggle}
        className="bim-focus-ring mb-1 flex w-full items-center gap-1 px-2"
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
      {props.open ? props.children : null}
    </div>
  );
}
