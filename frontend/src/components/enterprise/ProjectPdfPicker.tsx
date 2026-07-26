"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Filter, Folder, Search } from "lucide-react";
import type { Folder as ProjectFolder } from "@/types/projects";
import type { DrawingSheetOption } from "@/lib/api-client/bim-publish";

// fallow-ignore-next-line complexity
function folderPathLabel(folderId: string | null, folders: ProjectFolder[]): string {
  if (!folderId) return "Project root";
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let cur: string | null = folderId;
  while (cur) {
    const f = byId.get(cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return parts.join(" / ") || "Project root";
}

// fallow-ignore-next-line complexity
function collectDescendantFolderIds(rootId: string, folders: ProjectFolder[]): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        changed = true;
      }
    }
  }
  return ids;
}

// fallow-ignore-next-line complexity
export function ProjectPdfPicker(props: {
  folders: ProjectFolder[];
  sheets: DrawingSheetOption[];
  selectedFileIds: Set<string>;
  onToggleFile: (fileId: string) => void;
  onAddFolder: (folderId: string, folderLabel: string, fileIds: string[]) => void;
  disciplineFilter: string | null;
  onDisciplineFilterChange: (discipline: string | null) => void;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["__root__"]));
  const [query, setQuery] = useState("");

  const disciplines = useMemo(() => {
    const set = new Set<string>();
    for (const s of props.sheets) {
      for (const d of s.disciplines) set.add(d);
    }
    return [...set].sort();
  }, [props.sheets]);

  const filteredSheets = useMemo(() => {
    const q = query.trim().toLowerCase();
    // fallow-ignore-next-line complexity
    return props.sheets.filter((s) => {
      if (props.disciplineFilter && !s.disciplines.includes(props.disciplineFilter)) return false;
      if (!q) return true;
      const hay = `${s.name ?? s.fileName ?? ""} ${s.folderPath ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [props.sheets, props.disciplineFilter, query]);

  const sheetsByFolder = useMemo(() => {
    const map = new Map<string | null, DrawingSheetOption[]>();
    for (const s of filteredSheets) {
      const key = s.folderId;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }
    return map;
  }, [filteredSheets]);

  const rootFolders = props.folders.filter((f) => !f.parentId && f.canAccess !== false);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // fallow-ignore-next-line complexity
  function renderFolder(folder: ProjectFolder, depth: number) {
    const key = folder.id;
    const open = expanded.has(key);
    const childFolders = props.folders.filter(
      (f) => f.parentId === folder.id && f.canAccess !== false,
    );
    const files = sheetsByFolder.get(folder.id) ?? [];
    const folderIds = collectDescendantFolderIds(folder.id, props.folders);
    const folderPdfIds = props.sheets
      .filter((s) => s.folderId && folderIds.has(s.folderId))
      .filter((s) => !props.disciplineFilter || s.disciplines.includes(props.disciplineFilter))
      .map((s) => s.fileId);
    const folderLabel = folderPathLabel(folder.id, props.folders);

    return (
      <div key={folder.id}>
        <div
          className="flex items-center gap-1 rounded-lg py-1 pr-1 hover:bg-slate-50"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <button
            type="button"
            className="rounded p-0.5 text-slate-500"
            onClick={() => toggleExpand(key)}
            aria-label={open ? "Collapse folder" : "Expand folder"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Folder className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--enterprise-text)]">
            {folder.name}
          </span>
          {folderPdfIds.length > 0 ? (
            <button
              type="button"
              className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-white"
              onClick={() => props.onAddFolder(folder.id, folderLabel, folderPdfIds)}
            >
              Add folder ({folderPdfIds.length})
            </button>
          ) : null}
        </div>
        {open ? (
          <div>
            {childFolders.map((f) => renderFolder(f, depth + 1))}
            {files.map((sheet) => renderSheetRow(sheet, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderSheetRow(sheet: DrawingSheetOption, depth: number) {
    const checked = props.selectedFileIds.has(sheet.fileId);
    return (
      <label
        key={sheet.fileId}
        className="flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-2 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 12 + 28}px` }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => props.onToggleFile(sheet.fileId)}
          className="rounded border-slate-300"
        />
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--enterprise-text)]">
          {sheet.name}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">
          {sheet.pageCount} pg{sheet.pageCount === 1 ? "" : "s"}
        </span>
      </label>
    );
  }

  const rootFiles = sheetsByFolder.get(null) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PDFs…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => props.onDisciplineFilterChange(null)}
          className={`rounded-full px-2.5 py-1 text-xs ${props.disciplineFilter == null ? "bg-[var(--enterprise-primary)] text-white" : "border border-slate-200 text-slate-600"}`}
        >
          All
        </button>
        {disciplines.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => props.onDisciplineFilterChange(d)}
            className={`rounded-full px-2.5 py-1 text-xs ${props.disciplineFilter === d ? "bg-[var(--enterprise-primary)] text-white" : "border border-slate-200 text-slate-600"}`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
        {props.loading ? (
          <p className="p-4 text-sm text-slate-500">Loading project PDFs…</p>
        ) : filteredSheets.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No linkable PDFs match this filter.</p>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-1 px-1 py-1">
              <button
                type="button"
                className="rounded p-0.5 text-slate-500"
                onClick={() => toggleExpand("__root__")}
              >
                {expanded.has("__root__") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <span className="text-sm font-medium text-slate-700">Project root</span>
            </div>
            {expanded.has("__root__") ? (
              <>
                {rootFolders.map((f) => renderFolder(f, 1))}
                {rootFiles.map((s) => renderSheetRow(s, 1))}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
