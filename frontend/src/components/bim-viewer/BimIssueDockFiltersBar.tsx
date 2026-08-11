"use client";

import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import {
  bimIssueDockFiltersActive,
  countBimIssueDockFilterMatches,
  type BimIssueDockFilters,
  type BimIssueDueFilter,
  type BimIssueTypeFilter,
} from "@/lib/bim/bimIssueDockFilters";

const TYPE_FILTERS: { key: BimIssueTypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "CONSTRUCTION", label: "Construction" },
  { key: "WORK_ORDER", label: "Work order" },
  { key: "OCCUPANT", label: "Occupant" },
];

const DUE_FILTERS: { key: BimIssueDueFilter; label: string }[] = [
  { key: "all", label: "Any due date" },
  { key: "overdue", label: "Overdue" },
  { key: "dueToday", label: "Due today" },
  { key: "dueSoon", label: "Due soon" },
];

function activeFilterCount(filters: BimIssueDockFilters): number {
  let n = 0;
  if (filters.type !== "all") n += 1;
  if (filters.due !== "all") n += 1;
  if (filters.startSoon) n += 1;
  return n;
}

// fallow-ignore-next-line complexity
function buildActiveFilterTags(
  filters: BimIssueDockFilters,
  onChange: (next: BimIssueDockFilters) => void,
) {
  const tags: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.type !== "all") {
    tags.push({
      key: "type",
      label: TYPE_FILTERS.find((f) => f.key === filters.type)?.label ?? "Type",
      onRemove: () => onChange({ ...filters, type: "all" }),
    });
  }
  if (filters.due !== "all") {
    tags.push({
      key: "due",
      label: DUE_FILTERS.find((f) => f.key === filters.due)?.label ?? "Due",
      onRemove: () => onChange({ ...filters, due: "all" }),
    });
  }
  if (filters.startSoon) {
    tags.push({
      key: "startSoon",
      label: "Starting soon",
      onRemove: () => onChange({ ...filters, startSoon: false }),
    });
  }
  return tags;
}

function IssueDockFilterPanel(props: {
  filters: BimIssueDockFilters;
  filterCounts: ReturnType<typeof countBimIssueDockFilterMatches>;
  onChange: (next: BimIssueDockFilters) => void;
  onResetFilters: () => void;
}) {
  const filtersActive = bimIssueDockFiltersActive(props.filters);

  return (
    <div className="space-y-2 rounded-xl border border-[var(--bim-border)] bg-[color-mix(in_srgb,var(--bim-panel)_88%,transparent)] p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 space-y-1">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-subtle)]">
            Type
          </span>
          <select
            value={props.filters.type}
            onChange={(e) =>
              props.onChange({ ...props.filters, type: e.target.value as BimIssueTypeFilter })
            }
            className="bim-select py-1.5 text-[11px]"
            aria-label="Filter by issue type"
          >
            {TYPE_FILTERS.map((f) => {
              const count = f.key === "all" ? props.filterCounts.all : props.filterCounts[f.key];
              return (
                <option key={f.key} value={f.key}>
                  {f.label}
                  {count > 0 ? ` (${count})` : ""}
                </option>
              );
            })}
          </select>
        </label>

        <label className="min-w-0 space-y-1">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-subtle)]">
            Due
          </span>
          <select
            value={props.filters.due}
            onChange={(e) =>
              props.onChange({ ...props.filters, due: e.target.value as BimIssueDueFilter })
            }
            className="bim-select py-1.5 text-[11px]"
            aria-label="Filter by due date"
          >
            {DUE_FILTERS.map((f) => {
              const count = f.key === "all" ? undefined : props.filterCounts[f.key];
              return (
                <option key={f.key} value={f.key}>
                  {f.label}
                  {count != null && count > 0 ? ` (${count})` : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--bim-border)] pt-2">
        <label className="flex min-w-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={props.filters.startSoon}
            onChange={(e) => props.onChange({ ...props.filters, startSoon: e.target.checked })}
            className="h-3.5 w-3.5 shrink-0 rounded border-[var(--bim-border)] accent-[var(--bim-accent)]"
          />
          <span className="text-[11px] text-[var(--bim-text)]">
            Starting soon
            {props.filterCounts.startSoon > 0 ? (
              <span className="ml-1 text-[var(--bim-text-muted)]">
                ({props.filterCounts.startSoon})
              </span>
            ) : null}
          </span>
        </label>

        {filtersActive ? (
          <button
            type="button"
            onClick={props.onResetFilters}
            className="bim-focus-ring inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-[var(--bim-text-muted)] hover:text-[var(--bim-text)]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

// fallow-ignore-next-line complexity
export function BimIssueDockFiltersBar(props: {
  query: string;
  onQueryChange: (value: string) => void;
  filters: BimIssueDockFilters;
  filterCounts: ReturnType<typeof countBimIssueDockFilterMatches>;
  open: boolean;
  onToggleOpen: () => void;
  onChange: (next: BimIssueDockFilters) => void;
  onResetFilters: () => void;
}) {
  const activeCount = activeFilterCount(props.filters);
  const filtersActive = bimIssueDockFiltersActive(props.filters);
  const activeTags = buildActiveFilterTags(props.filters, props.onChange);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bim-text-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={props.query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder="Search issues…"
            className="w-full rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] py-1.5 pl-8 pr-2 text-[12px] text-[var(--bim-text)] outline-none focus:border-[var(--bim-accent)]"
          />
        </div>
        <button
          type="button"
          aria-expanded={props.open}
          aria-label={props.open ? "Hide filters" : "Show filters"}
          onClick={props.onToggleOpen}
          className={`bim-focus-ring relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 ${
            props.open || filtersActive
              ? "border-[var(--bim-accent)] bg-[var(--bim-accent-muted)] text-[var(--bim-text)]"
              : "border-[var(--bim-border)] bg-[var(--bim-panel)] text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)] hover:text-[var(--bim-text)]"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          {activeCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bim-accent)] px-1 text-[9px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {!props.open && activeTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {activeTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={tag.onRemove}
              className="bim-focus-ring inline-flex items-center gap-1 rounded-full bg-[var(--bim-accent-muted)] py-0.5 pl-2 pr-1 text-[10px] font-medium text-[var(--bim-text)] ring-1 ring-[var(--bim-accent)]/40"
            >
              {tag.label}
              <X className="h-3 w-3 opacity-70" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={props.onResetFilters}
            className="bim-focus-ring inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--bim-text-muted)] hover:text-[var(--bim-text)]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Clear
          </button>
        </div>
      ) : null}

      {props.open ? (
        <IssueDockFilterPanel
          filters={props.filters}
          filterCounts={props.filterCounts}
          onChange={props.onChange}
          onResetFilters={props.onResetFilters}
        />
      ) : null}
    </div>
  );
}
