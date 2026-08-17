"use client";

import { Bookmark, BookmarkPlus, Filter, Palette, Trash2 } from "lucide-react";
import { filterStateHasColorize, parseFilterState } from "@/lib/bim/bimFilters";
import type { BimSavedViewRecord } from "@/lib/bim/types";

export function BimSavedViewsPanel(props: {
  views: BimSavedViewRecord[];
  onSave: () => void;
  onApply: (view: BimSavedViewRecord) => void;
  onDelete: (viewId: string) => void;
}) {
  return (
    <div className="bim-detail-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="bim-section-title inline-flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
            Saved views
          </p>
          <p className="mt-1 text-[11px] text-[var(--bim-text-muted)]">
            Bookmark camera positions for reviews and coordination.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onSave}
          className="bim-btn-secondary shrink-0 py-1.5 text-[11px]"
        >
          <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
          Save
        </button>
      </div>

      {props.views.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--bim-border)] px-3 py-6 text-center">
          <Bookmark className="mx-auto mb-2 h-5 w-5 text-[var(--bim-text-muted)]" aria-hidden />
          <p className="text-[12px] text-[var(--bim-text-muted)]">No saved views yet.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {props.views.map((v) => (
            <li key={v.id}>
              <div className="bim-action-card flex items-center gap-1 p-1">
                <button
                  type="button"
                  onClick={() => props.onApply(v)}
                  className="bim-focus-ring bim-tree-row min-w-0 flex-1 border-0 bg-transparent"
                >
                  {filterStateHasColorize(parseFilterState(v.filtersJson)) ? (
                    <Palette
                      className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]"
                      aria-hidden
                    />
                  ) : parseFilterState(v.filtersJson) ? (
                    <Filter className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]" aria-hidden />
                  ) : (
                    <Bookmark
                      className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]"
                      aria-hidden
                    />
                  )}
                  <span className="truncate text-[12px]">{v.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${v.name}`}
                  onClick={() => props.onDelete(v.id)}
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
  );
}
