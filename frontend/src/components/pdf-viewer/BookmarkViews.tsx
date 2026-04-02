"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { Bookmark, Trash2 } from "lucide-react";
import { loadBookmarks, saveBookmarks, type SavedViewBookmark } from "@/lib/viewBookmarks";
import { useViewerStore } from "@/store/viewerStore";

export function BookmarkViews() {
  const fileName = useViewerStore((s) => s.fileName);
  const numPages = useViewerStore((s) => s.numPages);
  const scale = useViewerStore((s) => s.scale);
  const currentPage = useViewerStore((s) => s.currentPage);
  const snapToGeometry = useViewerStore((s) => s.snapToGeometry);
  const snapRadiusPx = useViewerStore((s) => s.snapRadiusPx);
  const snapLayerIds = useViewerStore((s) => s.snapLayerIds);
  const setScale = useViewerStore((s) => s.setScale);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const setSnapToGeometry = useViewerStore((s) => s.setSnapToGeometry);
  const setSnapRadiusPx = useViewerStore((s) => s.setSnapRadiusPx);
  const setSnapLayerIds = useViewerStore((s) => s.setSnapLayerIds);

  const [list, setList] = useState<SavedViewBookmark[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setList(loadBookmarks(fileName, numPages));
  }, [fileName, numPages]);

  const persist = (next: SavedViewBookmark[]) => {
    setList(next);
    saveBookmarks(fileName, numPages, next);
  };

  const saveCurrent = () => {
    if (!name.trim() || !fileName || numPages < 1) return;
    persist([
      ...list,
      {
        id: nanoid(),
        name: name.trim(),
        page: currentPage,
        scale,
        snapToGeometry,
        snapRadiusPx,
        snapLayerIds: snapLayerIds === null ? null : [...snapLayerIds],
      },
    ]);
    setName("");
  };

  const apply = (b: SavedViewBookmark) => {
    setCurrentPage(b.page);
    setScale(b.scale);
    setSnapToGeometry(b.snapToGeometry);
    setSnapRadiusPx(b.snapRadiusPx);
    setSnapLayerIds(b.snapLayerIds);
  };

  if (!fileName || numPages < 1) return null;

  return (
    <div className="viewer-card mb-4 space-y-2 p-2.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this view"
          className="min-w-0 flex-1 rounded-lg border border-[var(--viewer-border-strong)] bg-[var(--viewer-input-bg)] px-2 py-1.5 text-[11px] tracking-tight text-[var(--viewer-text)] placeholder:text-[var(--viewer-text-muted)]/70 outline-none transition focus:border-[var(--viewer-primary)] focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
          title="Name for the current zoom, page, and snap settings"
        />
        <button
          type="button"
          onClick={saveCurrent}
          disabled={!name.trim()}
          className="shrink-0 rounded-lg bg-[var(--viewer-primary)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-[var(--viewer-primary-glow)] transition hover:bg-[var(--viewer-primary-hover)] disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-[10px] tracking-tight text-[var(--viewer-text-muted)]">
          No saved views yet.
        </p>
      ) : (
        <ul className="max-h-28 space-y-1 overflow-y-auto [scrollbar-width:thin]">
          {list.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-1 rounded-lg border border-[var(--viewer-border-strong)]/80 bg-[color-mix(in_srgb,var(--viewer-input-bg)_80%,transparent)] px-1.5 py-1"
            >
              <button
                type="button"
                onClick={() => apply(b)}
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-[10px] tracking-tight text-[var(--viewer-text)] hover:text-white"
                title={`Page ${b.page} · ${Math.round(b.scale * 100)}%`}
              >
                <Bookmark
                  className="h-3 w-3 shrink-0 text-[var(--viewer-primary)]"
                  strokeWidth={1.75}
                />
                <span className="truncate">{b.name}</span>
              </button>
              <button
                type="button"
                onClick={() => persist(list.filter((x) => x.id !== b.id))}
                className="shrink-0 rounded p-0.5 text-[var(--viewer-text-muted)] hover:bg-[var(--viewer-input-bg)] hover:text-[var(--viewer-error)]"
                aria-label={`Delete ${b.name}`}
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
