"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { BimQuantityIndex } from "@/lib/bim/types";
import { elementRowTintVars, resolveElementDisplayColor } from "@/lib/bim/elementDisplay";
import { filterBimElements } from "@/lib/bim/elementSearch";

export function BimElementSearchPanel(props: {
  index: BimQuantityIndex | null;
  selectedGuids: Set<string>;
  onSelect: (guid: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  const results = useMemo(() => filterBimElements(props.index, query, 40), [props.index, query]);

  const trimmed = query.trim();

  return (
    <div className="bim-bottom-search-panel bim-glass-surface" role="search">
      <div className="bim-bottom-search-panel__input-row">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--bim-chrome-text-muted)]" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search elements by name, type, GUID…"
          aria-label="Search elements"
          className="bim-bottom-search-panel__input"
          onKeyDown={(e) => {
            if (e.key === "Escape") props.onClose();
            if (e.key === "Enter" && results[0]) {
              props.onSelect(results[0].guid);
            }
          }}
        />
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close search"
          className="bim-bottom-search-panel__close"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {!props.index ? (
        <p className="bim-bottom-search-panel__hint">Index loading…</p>
      ) : !trimmed ? (
        <p className="bim-bottom-search-panel__hint">
          {props.index.elements.length.toLocaleString()} elements indexed
        </p>
      ) : results.length === 0 ? (
        <p className="bim-bottom-search-panel__hint">No elements match &ldquo;{trimmed}&rdquo;</p>
      ) : (
        <ul className="bim-bottom-search-panel__results" aria-label="Search results">
          {results.map((entry) => {
            const displayColor = resolveElementDisplayColor(entry);
            const selected = props.selectedGuids.has(entry.guid);
            return (
              <li key={entry.guid}>
                <button
                  type="button"
                  onClick={() => props.onSelect(entry.guid)}
                  data-selected={selected ? "true" : undefined}
                  style={elementRowTintVars(displayColor.hex)}
                  className="bim-bottom-search-panel__result"
                >
                  <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-[var(--bim-chrome-text)]">
                    {entry.name ?? entry.ifcType.replace(/^Ifc/i, "")}
                  </span>
                  <span className="shrink-0 truncate text-[10px] text-[var(--bim-chrome-text-muted)]">
                    {entry.ifcType.replace(/^Ifc/i, "")}
                    {entry.level ? ` · ${entry.level}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
