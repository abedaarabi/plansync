"use client";

import { Search } from "lucide-react";

type TypeOption = { id: string; name: string };

type Props = {
  q: string;
  onQChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  types: TypeOption[];
  isFetching: boolean;
  showCustomSearchNote: boolean;
};

export function MaterialsCatalogToolbar({
  q,
  onQChange,
  typeFilter,
  onTypeFilterChange,
  types,
  isFetching,
  showCustomSearchNote,
}: Props) {
  return (
    <div className="shrink-0 flex flex-col gap-3 border-b border-[var(--enterprise-border)] px-3.5 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-4">
      <div className="relative min-w-0 max-w-xl flex-1">
        <label htmlFor="materials-catalog-search" className="enterprise-type-caption">
          Search catalog
        </label>
        <div className="relative mt-1.5">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            id="materials-catalog-search"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Name, SKU, supplier, specification…"
            className="enterprise-field-input enterprise-field-input--icon min-h-9 py-1.5 text-sm"
          />
        </div>
        {showCustomSearchNote ? (
          <p className="enterprise-type-caption mt-2">
            Custom columns are not included in search yet.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-end gap-2">
        {isFetching ? (
          <span className="pb-2 text-xs font-medium text-[var(--enterprise-primary)]">
            Updating…
          </span>
        ) : null}
        <div>
          <label htmlFor="materials-type-filter" className="enterprise-type-caption">
            Filter by type
          </label>
          <select
            id="materials-type-filter"
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="enterprise-field-input mt-1.5 min-h-9 min-w-[10rem] py-1.5 text-sm"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
