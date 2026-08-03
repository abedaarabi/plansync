"use client";

import { useMemo, useState } from "react";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  Palette,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { BimQuantityIndex, BimSavedViewRecord } from "@/lib/bim/types";
import {
  BIM_FILTER_FIELD_OPTIONS,
  type BimFilterField,
  type BimFilterRule,
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

const PICKER_FIELDS = ["ifcType", "level", "model"] as const satisfies readonly BimFilterField[];

const PICKER_LABELS: Record<(typeof PICKER_FIELDS)[number], string> = {
  ifcType: "Category",
  level: "Level",
  model: "Model",
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
  savedViews: BimSavedViewRecord[];
  onSaveFilter: () => void;
  onApplySavedView: (view: BimSavedViewRecord) => void;
  onDeleteSavedView: (viewId: string) => void;
}) {
  const { filterState, onFilterStateChange } = props;
  const [pickerField, setPickerField] = useState<(typeof PICKER_FIELDS)[number]>("ifcType");
  const [pickerQuery, setPickerQuery] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);

  const active = hasActiveFilter(filterState);
  const colorizeOn = Boolean(filterState.colorize?.enabled);

  const pickerOptions = useMemo(
    () => listFilterFieldValues(props.index, pickerField, pickerQuery),
    [props.index, pickerField, pickerQuery],
  );

  const patch = (partial: Partial<BimFilterState>) => {
    onFilterStateChange({ ...filterState, ...partial });
  };

  /** One active rule per field — picking a new value replaces the previous. */
  const setFieldRule = (rule: Omit<BimFilterRule, "id">) => {
    const next = filterState.rules.filter((r) => r.field !== rule.field);
    const existing = filterState.rules.find(
      (r) => r.field === rule.field && r.op === rule.op && r.value === rule.value,
    );
    if (existing) {
      patch({ rules: next });
      return;
    }
    patch({ rules: [...next, { ...rule, id: createFilterRuleId() }] });
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
  };

  if (!props.index) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Layers className="h-8 w-8 text-[var(--bim-text-muted)]" aria-hidden />
        <p className="text-[13px] font-medium text-[var(--bim-text)]">Loading model index</p>
        <p className="max-w-[14rem] text-[11px] text-[var(--bim-text-muted)]">
          Categories appear here once indexing completes.
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
            Pick a category, level, or model to filter the view.
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

        <div className="bim-segment bim-segment-compact mb-2">
          {PICKER_FIELDS.map((field) => (
            <button
              key={field}
              type="button"
              data-active={pickerField === field}
              onClick={() => setPickerField(field)}
              className="bim-segment-btn text-[10px]"
            >
              {PICKER_LABELS[field]}
            </button>
          ))}
        </div>

        <ul
          className="bim-dock-scroll rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)]"
          aria-label={`${PICKER_LABELS[pickerField]} list`}
        >
          {pickerOptions.length === 0 ? (
            <li className="px-4 py-8 text-center text-[11px] text-[var(--bim-text-muted)]">
              No results. Try another search or press Enter to filter by text.
            </li>
          ) : (
            pickerOptions.map((opt) => {
              const selected = filterState.rules.some(
                (r) => r.field === pickerField && r.op === "eq" && r.value === opt.value,
              );
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() =>
                      setFieldRule({
                        field: pickerField,
                        op: "eq",
                        value: opt.value,
                        label: PICKER_LABELS[pickerField],
                      })
                    }
                    className="bim-focus-ring flex w-full items-center gap-2.5 border-b border-[var(--bim-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--bim-hover)]"
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
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--bim-text)]">
                      {opt.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--bim-hover)] px-1.5 py-px text-[10px] tabular-nums text-[var(--bim-text-muted)]">
                      {opt.count?.toLocaleString()}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* View options */}
      <div className="space-y-3 border-t border-[var(--bim-border)] px-3 py-3">
        <div>
          <p className="bim-section-title mb-2">Display</p>
          <div className="grid grid-cols-3 gap-1.5">
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
                  className={`bim-focus-ring flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors ${
                    selected
                      ? "border-[var(--bim-accent)] bg-[var(--bim-accent-muted)] text-[var(--bim-text)]"
                      : "border-[var(--bim-border)] bg-[var(--bim-panel)] text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[10px] font-medium">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)] p-2.5">
          <label className="flex cursor-pointer items-center gap-2.5">
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
