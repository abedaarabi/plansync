"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Boxes,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileBox,
  Layers,
  MousePointerSquareDashed,
  Palette,
  Search,
  Shapes,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import type { BimQuantityIndex, BimSavedViewRecord } from "@/lib/bim/types";
import {
  BIM_FILTER_FIELD_OPTIONS,
  type BimFilterField,
  type BimFilterState,
  type BimFilterVisualize,
  buildColorizeFromElements,
  createFilterRuleId,
  filterStateHasColorize,
  hasActiveFilter,
  listFilterFieldValues,
  matchFilteredElements,
  parseFilterState,
  ruleLabel,
} from "@/lib/bim/bimFilters";
import type { ColorizeLegendEntry } from "@/lib/bim/colorizePalette";

const PICKER_FIELDS = [
  "ifcType",
  "typeName",
  "name",
  "level",
  "model",
  "discipline",
] as const satisfies readonly BimFilterField[];

const PICKER_META: Record<
  (typeof PICKER_FIELDS)[number],
  { label: string; hint: string; icon: typeof Shapes }
> = {
  ifcType: { label: "Category", hint: "IFC class — walls, doors, ducts…", icon: Shapes },
  typeName: {
    label: "Type name",
    hint: "IFC type object — best for cost / takeoff grouping",
    icon: Boxes,
  },
  name: { label: "Name", hint: "Instance / element name", icon: Tag },
  level: { label: "Level", hint: "Building storey / level", icon: Layers },
  model: { label: "Model", hint: "Federated file / model", icon: FileBox },
  discipline: { label: "Discipline", hint: "Architectural, MEP, structure…", icon: Wrench },
};

const DISPLAY_MODES: {
  id: BimFilterVisualize;
  label: string;
  hint: string;
  icon: typeof Eye;
}[] = [
  { id: "ghost", label: "Ghost", hint: "Dim the rest of the model", icon: Layers },
  { id: "isolate", label: "Hide", hint: "Hide non-matching elements", icon: EyeOff },
  { id: "none", label: "All", hint: "Keep full model visible", icon: Eye },
];

// fallow-ignore-next-line complexity
export function BimFiltersPanel(props: {
  index: BimQuantityIndex | null;
  filterState: BimFilterState;
  onFilterStateChange: (state: BimFilterState) => void;
  matchCount: number;
  legend: ColorizeLegendEntry[];
  selectMatches: boolean;
  onToggleSelectMatches: (next: boolean) => void;
  /** Restores the camera after filters clear (home / fit view). */
  onResetCamera?: () => void;
  savedViews: BimSavedViewRecord[];
  onSaveFilter: () => void;
  onApplySavedView: (view: BimSavedViewRecord) => void;
  onDeleteSavedView: (viewId: string) => void;
}) {
  const { filterState, onFilterStateChange } = props;
  const [pickerField, setPickerField] = useState<(typeof PICKER_FIELDS)[number]>("ifcType");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerMenuOpen, setPickerMenuOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const pickerMenuRef = useRef<HTMLDivElement>(null);

  const active = hasActiveFilter(filterState);
  const colorizeOn = Boolean(filterState.colorize?.enabled);
  const activePicker = PICKER_META[pickerField];
  const ActivePickerIcon = activePicker.icon;

  useEffect(() => {
    if (!pickerMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (pickerMenuRef.current?.contains(e.target as Node)) return;
      setPickerMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerMenuOpen]);

  const pickerOptions = useMemo(() => {
    if (pickerField === "name") {
      // Prefer names that match the search; without a query show the densest names.
      return listFilterFieldValues(props.index, "name", pickerQuery).slice(0, 200);
    }
    return listFilterFieldValues(props.index, pickerField, pickerQuery);
  }, [props.index, pickerField, pickerQuery]);

  const patch = (partial: Partial<BimFilterState>) => {
    onFilterStateChange({ ...filterState, ...partial });
  };

  /** Toggle a value for a field — multiple Type/Level picks OR together. */
  const toggleFieldValue = (field: BimFilterField, value: string, label: string) => {
    const existing = filterState.rules.find(
      (r) => r.field === field && r.op === "eq" && r.value === value,
    );
    if (existing) {
      patch({ rules: filterState.rules.filter((r) => r.id !== existing.id) });
      return;
    }
    patch({
      rules: [...filterState.rules, { id: createFilterRuleId(), field, op: "eq", value, label }],
    });
  };

  const applyTextFilter = () => {
    const q = pickerQuery.trim();
    if (!q) return;
    const withoutAny = filterState.rules.filter((r) => r.field !== "any");
    patch({
      rules: [
        ...withoutAny,
        {
          id: createFilterRuleId(),
          field: "any",
          op: "contains",
          value: q,
          label: "Search",
        },
      ],
      textQuery: "",
    });
    setPickerQuery("");
  };

  const clearAll = () => {
    onFilterStateChange({
      rules: [],
      textQuery: "",
      colorize: null,
      visualize: "ghost",
    });
    setPickerQuery("");
    props.onResetCamera?.();
  };

  if (!props.index) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Layers className="h-8 w-8 text-[var(--bim-text-muted)]" aria-hidden />
        <p className="text-[13px] font-medium text-[var(--bim-text)]">Loading model index</p>
        <p className="max-w-[14rem] text-[11px] text-[var(--bim-text-muted)]">
          Filter values appear here once indexing completes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Status bar */}
      <div className="border-b border-[var(--bim-border)] bg-[var(--bim-hover)] px-3 py-2.5">
        {active ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-[var(--bim-text)]">
              <span className="tabular-nums text-[var(--bim-accent)]">
                {props.matchCount.toLocaleString()}
              </span>{" "}
              elements
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="bim-focus-ring rounded-md px-2 py-1 text-[11px] font-medium text-[var(--bim-accent)] hover:bg-[var(--bim-panel)]"
            >
              Reset
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--bim-text-muted)]">
            Filter by category, name, level, model, or discipline. Pick several values to combine
            them.
          </p>
        )}
        {filterState.rules.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {filterState.rules.map((rule) => (
              <span
                key={rule.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--bim-panel)] py-0.5 pl-2 pr-0.5 text-[10px] text-[var(--bim-text)] ring-1 ring-[var(--bim-border)]"
              >
                <span className="truncate">{ruleLabel(rule)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${ruleLabel(rule)}`}
                  onClick={() =>
                    patch({ rules: filterState.rules.filter((r) => r.id !== rule.id) })
                  }
                  className="bim-focus-ring rounded p-0.5 text-[var(--bim-text-muted)] hover:text-[var(--bim-text)]"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Find & pick */}
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-3">
        <p className="bim-section-title mb-2">Find elements</p>
        <div className="bim-property-search mb-2">
          <Search className="bim-property-search__icon" aria-hidden />
          <input
            type="search"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyTextFilter();
              }
            }}
            placeholder="Door, duct, level name…"
            aria-label="Find filter values"
            className="bim-property-search__input"
          />
          {pickerQuery ? (
            <button
              type="button"
              onClick={() => setPickerQuery("")}
              aria-label="Clear"
              className="bim-property-search__clear"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="relative mb-2" ref={pickerMenuRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={pickerMenuOpen}
            aria-label="Filter by field"
            onClick={() => setPickerMenuOpen((open) => !open)}
            className="bim-focus-ring flex w-full items-center gap-2.5 rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] px-3 py-2.5 text-left hover:bg-[var(--bim-hover)]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
              <ActivePickerIcon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-[var(--bim-text)]">
                {activePicker.label}
              </span>
              <span className="block truncate text-[10px] text-[var(--bim-text-muted)]">
                {activePicker.hint}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--bim-text-muted)] transition-transform ${
                pickerMenuOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {pickerMenuOpen ? (
            <ul
              role="listbox"
              aria-label="Filter fields"
              className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] py-1 shadow-[var(--bim-panel-shadow)]"
            >
              {PICKER_FIELDS.map((field) => {
                const meta = PICKER_META[field];
                const Icon = meta.icon;
                const selected = pickerField === field;
                return (
                  <li key={field} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerField(field);
                        setPickerMenuOpen(false);
                        setPickerQuery("");
                      }}
                      className={`bim-focus-ring flex w-full items-center gap-2.5 px-2.5 py-2 text-left ${
                        selected ? "bg-[var(--bim-accent-muted)]" : "hover:bg-[var(--bim-hover)]"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          selected
                            ? "bg-[var(--bim-accent)] text-white"
                            : "bg-[var(--bim-hover)] text-[var(--bim-accent)]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-[var(--bim-text)]">
                          {meta.label}
                        </span>
                        <span className="block truncate text-[10px] text-[var(--bim-text-muted)]">
                          {meta.hint}
                        </span>
                      </span>
                      {selected ? (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <ul
          className="bim-dock-scroll rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)]"
          aria-label={`${activePicker.label} list`}
        >
          {pickerOptions.length === 0 ? (
            <li className="px-4 py-8 text-center text-[11px] text-[var(--bim-text-muted)]">
              {pickerField === "typeName"
                ? "No type names in this index yet. Rebuild the model index (Quality panel) to extract them."
                : "No results. Try another search or press Enter to filter by text."}
            </li>
          ) : (
            pickerOptions.map((opt) => {
              const selected = filterState.rules.some(
                (r) => r.field === pickerField && r.op === "eq" && r.value === opt.value,
              );
              const countLabel = opt.count != null ? opt.count.toLocaleString() : null;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    title={countLabel ? `${opt.label} · ${countLabel} elements` : opt.label}
                    onClick={() => toggleFieldValue(pickerField, opt.value, activePicker.label)}
                    className="bim-focus-ring flex w-full items-center gap-2 border-b border-[var(--bim-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--bim-hover)]"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-[var(--bim-accent)] bg-[var(--bim-accent)] text-white"
                          : "border-[var(--bim-border)] bg-transparent"
                      }`}
                      aria-hidden
                    >
                      {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[12px] text-[var(--bim-text)] [scrollbar-width:thin] [scrollbar-color:var(--bim-border)_transparent]">
                      {opt.label}
                    </span>
                    {countLabel ? (
                      <span
                        className="shrink-0 rounded-md border border-[var(--bim-border)] bg-[var(--bim-panel)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--bim-text)]"
                        aria-label={`${countLabel} elements`}
                      >
                        {countLabel}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* View options — compact so the type list keeps the room */}
      <div className="space-y-2.5 border-t border-[var(--bim-border)] px-3 py-2.5">
        <div>
          <p className="bim-section-title mb-1.5">Display</p>
          <div className="bim-segment bim-segment-compact" role="group" aria-label="Display mode">
            {DISPLAY_MODES.map((mode) => {
              const Icon = mode.icon;
              const selected = filterState.visualize === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  data-active={selected}
                  title={mode.hint}
                  onClick={() => patch({ visualize: mode.id })}
                  className="bim-segment-btn inline-flex items-center justify-center gap-1 text-[10px]"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] px-2.5 py-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={props.selectMatches}
              onChange={(e) => props.onToggleSelectMatches(e.target.checked)}
              className="rounded border-[var(--bim-border)]"
            />
            <MousePointerSquareDashed
              className="h-3.5 w-3.5 text-[var(--bim-accent)]"
              aria-hidden
            />
            <span className="flex-1 text-[12px] font-medium text-[var(--bim-text)]">
              Select matches
            </span>
          </label>
          <p className="mt-1 pl-6 text-[10px] leading-relaxed text-[var(--bim-text-subtle)]">
            Selects all {props.matchCount.toLocaleString()} matching elements in the viewer for
            properties, issues, and takeoff.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] px-2.5 py-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={colorizeOn}
              // fallow-ignore-next-line complexity
              onChange={(e) => {
                if (!e.target.checked) {
                  patch({ colorize: null });
                  return;
                }
                const field = filterState.colorize?.field ?? pickerField;
                patch({
                  colorize: {
                    enabled: true,
                    field,
                    label: BIM_FILTER_FIELD_OPTIONS.find((o) => o.field === field)?.label,
                  },
                });
              }}
              className="rounded border-[var(--bim-border)]"
            />
            <Palette className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
            <span className="flex-1 text-[12px] font-medium text-[var(--bim-text)]">
              Color by property
            </span>
          </label>
          {colorizeOn ? (
            <select
              value={filterState.colorize?.field ?? pickerField}
              onChange={(e) => {
                const field = e.target.value as BimFilterField;
                patch({
                  colorize: {
                    enabled: true,
                    field,
                    label: BIM_FILTER_FIELD_OPTIONS.find((o) => o.field === field)?.label,
                  },
                });
              }}
              className="bim-input mt-2 w-full text-[11px]"
              aria-label="Colorize property"
            >
              {BIM_FILTER_FIELD_OPTIONS.map((opt) => (
                <option key={opt.field} value={opt.field}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}
          {colorizeOn && props.legend.length > 0 ? (
            <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto" aria-label="Legend">
              {props.legend.map((entry) => (
                <li
                  key={entry.value}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[10px]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.value}</span>
                  <span className="tabular-nums text-[var(--bim-text-muted)]">{entry.count}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Saved */}
      <div className="border-t border-[var(--bim-border)] px-3 py-2">
        <button
          type="button"
          onClick={() => setSavedOpen((v) => !v)}
          className="bim-focus-ring flex w-full items-center justify-between rounded-lg py-2 text-[11px] font-medium text-[var(--bim-text-muted)]"
          aria-expanded={savedOpen}
        >
          <span className="inline-flex items-center gap-1.5">
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
            Saved filters
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            {props.savedViews.length}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${savedOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>
        {savedOpen ? (
          <div className="pb-2">
            <button
              type="button"
              onClick={props.onSaveFilter}
              disabled={!active && !colorizeOn}
              className="bim-btn-secondary mb-2 w-full py-2 text-[11px] disabled:opacity-40"
            >
              Save current view
            </button>
            {props.savedViews.length === 0 ? (
              <p className="text-center text-[11px] text-[var(--bim-text-muted)]">Nothing saved.</p>
            ) : (
              <ul className="space-y-0.5">
                {props.savedViews.map((view) => (
                  <li key={view.id}>
                    <div className="flex items-center gap-0.5 rounded-lg hover:bg-[var(--bim-hover)]">
                      <button
                        type="button"
                        onClick={() => props.onApplySavedView(view)}
                        className="bim-focus-ring min-w-0 flex-1 truncate px-2 py-2 text-left text-[11px] text-[var(--bim-text)]"
                      >
                        {filterStateHasColorize(parseFilterState(view.filtersJson)) ? "◆ " : ""}
                        {view.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${view.name}`}
                        onClick={() => props.onDeleteSavedView(view.id)}
                        className="bim-focus-ring bim-tool-btn shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Compute match count and colorize legend for the current filter state. */
export function useBimFilterPreview(
  index: BimQuantityIndex | null,
  filterState: BimFilterState,
): { matches: ReturnType<typeof matchFilteredElements>; legend: ColorizeLegendEntry[] } {
  // fallow-ignore-next-line complexity
  return useMemo(() => {
    const colorizeActive = Boolean(filterState.colorize?.enabled);
    const filtered = matchFilteredElements(index, filterState);
    const hasFilter = hasActiveFilter(filterState);

    let colorizePool = index?.elements ?? [];
    if (hasFilter) colorizePool = filtered;

    if (!colorizeActive || !filterState.colorize || colorizePool.length === 0) {
      return { matches: filtered, legend: [] };
    }

    return {
      matches: filtered,
      legend: buildColorizeFromElements(colorizePool, filterState.colorize),
    };
  }, [index, filterState]);
}
