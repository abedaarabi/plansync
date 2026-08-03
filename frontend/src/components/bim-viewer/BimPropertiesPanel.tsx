"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Filter, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { resolveElementDisplayColor } from "@/lib/bim/elementDisplay";
import type { BimQuantityIndex } from "@/lib/bim/types";
import type { IssueBimAnchor } from "@/lib/api-client/core-issues-takeoff";
import { selectionToBimAnchor } from "@/lib/bim/bimIssueAnchor";
import type { BimSelection } from "./bimEngine";

type PropertyTableRow = {
  key: string;
  group: string;
  property: string;
  value: string;
};

const SKIP_ATTRIBUTE_LABELS = new Set(["_localId"]);

// fallow-ignore-next-line complexity
function buildPropertyRows(
  selection: BimSelection,
  extras: PropertyTableRow[] = [],
): PropertyTableRow[] {
  const rows: PropertyTableRow[] = [...extras];
  const seen = new Set<string>();

  const push = (group: string, property: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const dedupeKey = `${group}\0${property}\0${trimmed}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push({
      key: `${group}-${property}-${rows.length}`,
      group,
      property,
      value: trimmed,
    });
  };

  if (selection.ifcGuid) push("General", "Element ID", selection.ifcGuid);
  if (selection.ifcType) push("General", "Category", selection.ifcType);
  if (selection.name) push("General", "Name", selection.name);
  if (selection.storey) push("General", "Level", selection.storey);
  if (selection.sourceLabel) push("General", "Model", selection.sourceLabel);
  push("General", "Local ID", String(selection.localId));

  for (const attr of selection.attributes) {
    if (SKIP_ATTRIBUTE_LABELS.has(attr.label)) continue;
    push("Attributes", attr.label, attr.value);
  }

  for (const pset of selection.psets) {
    for (const prop of pset.props) {
      push(pset.name, prop.label, prop.value);
    }
  }

  return rows;
}

function isCodeLikeValue(value: string): boolean {
  if (value.length >= 24 && /^[0-9a-f-]+$/i.test(value)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return true;
  return false;
}

function groupPropertyRows(rows: PropertyTableRow[]): [string, PropertyTableRow[]][] {
  const map = new Map<string, PropertyTableRow[]>();
  for (const row of rows) {
    const list = map.get(row.group) ?? [];
    list.push(row);
    map.set(row.group, list);
  }
  return [...map.entries()];
}

function PropertyList({
  rows,
  onFilterByProperty,
}: {
  rows: PropertyTableRow[];
  onFilterByProperty?: (group: string, property: string, value: string) => void;
}) {
  const sections = groupPropertyRows(rows);
  return (
    <div className="bim-property-list">
      {sections.map(([group, items]) => (
        <section key={group} aria-label={group}>
          <h3 className="bim-property-section__title">{group}</h3>
          <dl className="bim-property-section__rows">
            {items.map((row) => (
              <div key={row.key} className="bim-property-row group/prop">
                <dt>{row.property}</dt>
                <dd
                  data-variant={isCodeLikeValue(row.value) ? "code" : undefined}
                  className="flex items-start justify-between gap-1"
                >
                  <span className="min-w-0 flex-1">{row.value}</span>
                  {onFilterByProperty ? (
                    <button
                      type="button"
                      onClick={() => onFilterByProperty(group, row.property, row.value)}
                      title={`Filter by ${row.property}`}
                      aria-label={`Filter by ${row.property}`}
                      className="bim-focus-ring ml-1 inline-flex shrink-0 rounded p-0.5 text-[var(--bim-text-muted)] opacity-0 transition-opacity hover:bg-[var(--bim-hover)] hover:text-[var(--bim-accent)] group-hover/prop:opacity-100 focus:opacity-100"
                    >
                      <Filter className="h-3 w-3" aria-hidden />
                    </button>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

// fallow-ignore-next-line complexity
export function BimPropertiesPanel(props: {
  selection: BimSelection | null;
  quantityIndex: BimQuantityIndex | null;
  fileId: string;
  fileVersionId: string | null;
  projectId: string | null;
  variant?: "tab-content" | "sheet";
  onClose: () => void;
  onStartCreateIssue?: (anchor: IssueBimAnchor) => void;
  onAddFilterRule?: (group: string, property: string, value: string) => void;
}) {
  const { selection, variant = "tab-content" } = props;
  const [propertySearch, setPropertySearch] = useState("");
  const loadingDetails = selection?.detailsPending === true;

  useEffect(() => {
    setPropertySearch("");
  }, [selection?.ifcGuid, selection?.localId, selection?.modelId]);

  // fallow-ignore-next-line complexity
  const quantityEntry = useMemo(() => {
    if (!selection?.ifcGuid || !props.quantityIndex) return null;
    const matchFv = selection.fileVersionId;
    return (
      props.quantityIndex.elements.find(
        (e) =>
          e.guid === selection.ifcGuid &&
          (!matchFv || e.sourceFileVersionId === matchFv || !e.sourceFileVersionId),
      ) ??
      props.quantityIndex.elements.find((e) => e.guid === selection.ifcGuid) ??
      null
    );
  }, [selection?.ifcGuid, selection?.fileVersionId, props.quantityIndex]);

  const displayColor = useMemo(
    () => (quantityEntry ? resolveElementDisplayColor(quantityEntry) : null),
    [quantityEntry],
  );

  // fallow-ignore-next-line complexity
  const tableRows = useMemo(() => {
    if (!selection) return [];
    const extras: PropertyTableRow[] = [];
    if (displayColor) {
      extras.push({
        key: "appearance-color",
        group: "Appearance",
        property: "Display color",
        value: displayColor.hex,
      });
      extras.push({
        key: "appearance-source",
        group: "Appearance",
        property: "Color source",
        value:
          displayColor.source === "ifc"
            ? "Authored IFC surface color"
            : "Discipline fallback color",
      });
      if (quantityEntry?.material) {
        extras.push({
          key: "appearance-material",
          group: "Appearance",
          property: "Material",
          value: quantityEntry.material,
        });
      }
    }
    return buildPropertyRows(selection, extras);
  }, [selection, displayColor, quantityEntry?.material]);

  const filteredRows = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    if (!q) return tableRows;
    return tableRows.filter(
      (row) =>
        row.group.toLowerCase().includes(q) ||
        row.property.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q),
    );
  }, [tableRows, propertySearch]);

  if (!selection) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="text-[13px] font-medium text-[var(--bim-text)]">No element selected</p>
        <p className="max-w-[16rem] text-[12px] leading-relaxed text-[var(--bim-text-muted)]">
          Click an element in the model to view its properties.
        </p>
      </div>
    );
  }

  const body = (
    <>
      <div className="px-2.5 py-2">
        <div className="bim-property-search">
          <Search className="bim-property-search__icon" aria-hidden />
          <input
            type="search"
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
            placeholder="Filter properties…"
            aria-label="Filter properties"
            className="bim-property-search__input"
          />
          {propertySearch ? (
            <button
              type="button"
              onClick={() => setPropertySearch("")}
              aria-label="Clear property search"
              className="bim-property-search__clear"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </div>

        {propertySearch.trim() && tableRows.length > 0 ? (
          <p className="bim-property-search__meta">
            {filteredRows.length} of {tableRows.length} properties
          </p>
        ) : null}

        {loadingDetails ? (
          <div className="mb-2 flex items-center gap-1.5 rounded-md border border-[var(--bim-border)] bg-[var(--bim-hover)] px-2 py-1.5 text-[10px] text-[var(--bim-text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin text-[var(--bim-accent)]" aria-hidden />
            Loading parameters…
          </div>
        ) : null}

        {filteredRows.length > 0 ? (
          <PropertyList rows={filteredRows} onFilterByProperty={props.onAddFilterRule} />
        ) : tableRows.length > 0 ? (
          <p className="px-2 py-8 text-center text-[11px] text-[var(--bim-text-muted)]">
            No properties match &ldquo;{propertySearch.trim()}&rdquo;
          </p>
        ) : (
          <p className="px-2 py-8 text-center text-[11px] text-[var(--bim-text-muted)]">
            No properties loaded for this element yet.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--bim-border)] px-2.5 py-2.5">
        <button
          type="button"
          onClick={() => {
            if (!props.onStartCreateIssue) return;
            if (!selection) return;
            const anchor = selectionToBimAnchor(selection);
            if (!anchor) {
              toast.error("Could not anchor an issue to this element yet. Try again in a moment.");
              return;
            }
            props.onStartCreateIssue(anchor);
          }}
          disabled={
            !props.projectId || !props.fileVersionId || !selection || !props.onStartCreateIssue
          }
          className="bim-btn-primary w-full py-2 text-[12px]"
        >
          <CircleAlert className="h-4 w-4" aria-hidden />
          Create issue on this element
        </button>
      </div>
    </>
  );

  if (variant === "sheet") {
    return (
      <aside
        className="absolute z-20 flex flex-col overflow-hidden rounded-t-2xl border border-[var(--bim-border)] bg-[var(--bim-panel)] shadow-[var(--bim-panel-shadow)] inset-x-0 bottom-0 max-h-[55%] sm:bottom-3 sm:right-3 sm:top-3 sm:w-80 sm:rounded-lg"
        role="dialog"
        aria-label="Object properties"
      >
        <div className="bim-panel-header">
          <div className="min-w-0 flex-1">
            <p className="bim-panel-header-title">
              {selection.name ?? selection.ifcType ?? "Object"}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            className="bim-focus-ring bim-tool-btn"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="bim-dock-scroll">{body}</div>
      </aside>
    );
  }

  return <div className="flex min-h-0 flex-col">{body}</div>;
}
