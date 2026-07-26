"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Link2, Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type {
  BimModelLevelDraft,
  DrawingMapDraft,
  DrawingSheetOption,
} from "@/lib/api-client/bim-publish";
import { fetchDrawingSheets, suggestBimDrawingMappings } from "@/lib/api-client/bim-publish";
import { suggestDrawingMappingsClient } from "@/lib/bim/suggestMappingsClient";
import type { CloudFile, Folder as ProjectFolder } from "@/types/projects";
import { ProjectPdfPicker } from "./ProjectPdfPicker";

export type LevelMapEntry = DrawingMapDraft & {
  pdfFileName: string;
  pdfFolderPath?: string | null;
  pageCount: number;
};

type PendingSheet = DrawingSheetOption & { selectedPages: number[] };

function formatElevation(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "";
  const sign = m >= 0 ? "+" : "";
  return `${sign}${m.toFixed(3)} m`;
}

function effectivePageCount(sheet: Pick<DrawingSheetOption, "pageCount">): number {
  return Math.max(1, sheet.pageCount);
}

function pendingPagesForSheet(sheet: DrawingSheetOption): number[] {
  return Array.from({ length: effectivePageCount(sheet) }, (_, i) => i);
}

// fallow-ignore-next-line complexity
export function ModelLevelSheetMapper(props: {
  projectId: string;
  ifcFileVersionId: string;
  levels: BimModelLevelDraft[];
  folders: ProjectFolder[];
  maps: LevelMapEntry[];
  onMapsChange: (maps: LevelMapEntry[]) => void;
  onUploadPdfs?: (files: File[]) => Promise<void>;
}) {
  const [sheets, setSheets] = useState<DrawingSheetOption[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLevelId, setPickerLevelId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [pendingSheets, setPendingSheets] = useState<PendingSheet[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const loadSheets = useCallback(async () => {
    setLoadingSheets(true);
    try {
      const data = await fetchDrawingSheets(props.projectId);
      setSheets(data.sheets);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load PDF sheets.");
    } finally {
      setLoadingSheets(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    void loadSheets();
  }, [loadSheets]);

  const sortedLevels = useMemo(
    () => [...props.levels].sort((a, b) => a.sortOrder - b.sortOrder),
    [props.levels],
  );

  // fallow-ignore-next-line complexity
  const mapsByLevel = useMemo(() => {
    const canonicalByAlias = new Map<string, string>();
    for (const level of props.levels) {
      const key = level.clientId ?? level.id ?? level.sourceName;
      canonicalByAlias.set(key, key);
      canonicalByAlias.set(level.sourceName, key);
      if (level.clientId) canonicalByAlias.set(level.clientId, key);
      if (level.id) canonicalByAlias.set(level.id, key);
    }
    const map = new Map<string, LevelMapEntry[]>();
    for (const m of props.maps) {
      const key = canonicalByAlias.get(m.bimModelLevelId) ?? m.bimModelLevelId;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [props.levels, props.maps]);

  function levelKey(level: BimModelLevelDraft): string {
    return level.clientId ?? level.id ?? level.sourceName;
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerLevelId(null);
    setSelectedFileIds(new Set());
    setPendingSheets([]);
  }

  function openPickerForLevel(levelId: string | null) {
    setPickerLevelId(levelId);
    setSelectedFileIds(new Set());
    setPendingSheets([]);
    setPickerOpen(true);
  }

  function toggleSelectedFile(fileId: string) {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function addFolderSheets(_folderId: string, folderLabel: string, fileIds: string[]) {
    const picked = sheets.filter((s) => fileIds.includes(s.fileId));
    if (picked.length === 0) return;
    setPendingSheets((prev) => {
      const existing = new Set(prev.map((p) => p.fileId));
      const added = picked
        .filter((s) => !existing.has(s.fileId))
        .map((s) => ({
          ...s,
          selectedPages: pendingPagesForSheet(s),
        }));
      toast.success(`${added.length} PDFs from ${folderLabel}`);
      return [...prev, ...added];
    });
    for (const id of fileIds) {
      setSelectedFileIds((prev) => new Set(prev).add(id));
    }
  }

  // fallow-ignore-next-line complexity
  function confirmPickerSelection() {
    const picked = sheets.filter((s) => selectedFileIds.has(s.fileId));
    if (picked.length === 0) {
      toast.error("Select at least one PDF.");
      return;
    }

    if (pickerLevelId) {
      const pending = picked.map((s) => ({
        ...s,
        selectedPages: pendingPagesForSheet(s),
      }));
      const allSinglePage = pending.every((s) => effectivePageCount(s) === 1);
      if (allSinglePage) {
        for (const sheet of pending) {
          assignPendingToLevel(pickerLevelId, sheet, 0);
        }
        toast.success(
          `Added ${pending.length} drawing${pending.length === 1 ? "" : "s"} to level.`,
        );
        closePicker();
        return;
      }
      setPendingSheets(pending);
      return;
    }

    setPendingSheets(
      picked.map((s) => ({
        ...s,
        selectedPages: pendingPagesForSheet(s),
      })),
    );
    setPickerOpen(false);
  }

  function assignPendingToLevel(levelId: string, sheet: PendingSheet, pageIndex: number) {
    const next: LevelMapEntry = {
      bimModelLevelId: levelId,
      pdfFileId: sheet.fileId,
      pdfFileVersionId: sheet.latestFileVersionId,
      pageIndex,
      pdfFileName: sheet.name,
      pdfFolderPath: sheet.folderPath,
      pageCount: effectivePageCount(sheet),
    };
    const filtered = props.maps.filter(
      (m) =>
        !(
          m.bimModelLevelId === levelId &&
          m.pdfFileId === sheet.fileId &&
          m.pageIndex === pageIndex
        ),
    );
    props.onMapsChange([...filtered, next]);
  }

  function removeMap(entry: LevelMapEntry) {
    props.onMapsChange(
      props.maps.filter(
        (m) =>
          !(
            m.bimModelLevelId === entry.bimModelLevelId &&
            m.pdfFileId === entry.pdfFileId &&
            m.pageIndex === entry.pageIndex
          ),
      ),
    );
  }

  // fallow-ignore-next-line complexity
  async function runAutoSuggest() {
    setSuggesting(true);
    try {
      let suggestions;
      try {
        const data = await suggestBimDrawingMappings(props.ifcFileVersionId, {
          pdfFileIds: sheets.map((s) => s.fileId),
        });
        suggestions = data.suggestions;
      } catch {
        suggestions = suggestDrawingMappingsClient({
          levels: props.levels,
          sheets,
        });
      }
      if (suggestions.length === 0) {
        toast.message("No confident suggestions — assign manually.");
        return;
      }
      const sheetById = new Map(sheets.map((s) => [s.fileId, s]));
      const next = [...props.maps];
      for (const s of suggestions) {
        const sheet = sheetById.get(s.pdfFileId);
        if (!sheet) continue;
        const levelId =
          props.levels.find(
            (l) => l.clientId === s.bimModelLevelId || l.sourceName === s.bimModelLevelId,
          )?.clientId ?? props.levels.find((l) => l.sourceName === s.bimModelLevelId)?.sourceName;
        if (!levelId) continue;
        const entry: LevelMapEntry = {
          bimModelLevelId: levelId,
          pdfFileId: s.pdfFileId,
          pdfFileVersionId: s.pdfFileVersionId ?? sheet.latestFileVersionId,
          pageIndex: s.pageIndex,
          pdfFileName: sheet.name,
          pdfFolderPath: sheet.folderPath,
          pageCount: sheet.pageCount,
        };
        if (
          !next.some(
            (m) =>
              m.bimModelLevelId === entry.bimModelLevelId &&
              m.pdfFileId === entry.pdfFileId &&
              m.pageIndex === entry.pageIndex,
          )
        ) {
          next.push(entry);
        }
      }
      props.onMapsChange(next);
      toast.success(`Applied ${suggestions.length} suggestions — review before publishing.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-suggest failed.");
    } finally {
      setSuggesting(false);
    }
  }

  // fallow-ignore-next-line complexity
  async function onUploadInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0 || !props.onUploadPdfs) return;
    try {
      await props.onUploadPdfs(files);
      await loadSheets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {props.onUploadPdfs ? (
          <>
            <input
              ref={uploadRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => void onUploadInput(e)}
            />
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => uploadRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload PDFs
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => openPickerForLevel(null)}
        >
          <Link2 className="h-3.5 w-3.5" />
          Add from project
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => openPickerForLevel(null)}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Add folder
        </button>
        <button
          type="button"
          disabled={suggesting || sheets.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          onClick={() => void runAutoSuggest()}
        >
          {suggesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Auto-suggest
        </button>
      </div>

      <div className="space-y-3">
        {sortedLevels.map(
          // fallow-ignore-next-line complexity
          (level) => {
            const id = levelKey(level);
            const levelMaps = mapsByLevel.get(id) ?? [];
            const unmapped = levelMaps.length === 0;
            return (
              <div
                key={id}
                className={`rounded-xl border p-3 ${unmapped ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--enterprise-text)]">
                      Level {String(level.sortOrder + 1).padStart(2, "0")} — {level.displayName}
                    </p>
                    {level.elevationMeters != null ? (
                      <p className="text-xs text-slate-500">
                        {formatElevation(level.elevationMeters)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => openPickerForLevel(id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add drawing
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {levelMaps.length === 0 ? (
                    <li className="text-xs text-slate-500">No drawing mapped</li>
                  ) : (
                    levelMaps.map((m) => (
                      <li
                        key={`${m.pdfFileId}:${m.pageIndex}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs"
                      >
                        <span className="min-w-0 truncate">
                          ✓ {m.pdfFolderPath ? `${m.pdfFolderPath} / ` : ""}
                          {m.pdfFileName} · page {m.pageIndex + 1}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                          onClick={() => removeMap(m)}
                          aria-label="Remove mapping"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          },
        )}
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 p-4 lg:items-center">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
                {pickerLevelId ? "Add drawing to level" : "Link project PDFs"}
              </h3>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={closePicker}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ProjectPdfPicker
                folders={props.folders}
                sheets={sheets}
                selectedFileIds={selectedFileIds}
                onToggleFile={toggleSelectedFile}
                onAddFolder={addFolderSheets}
                disciplineFilter={disciplineFilter}
                onDisciplineFilterChange={setDisciplineFilter}
                loading={loadingSheets}
              />
              {pendingSheets.length > 0 && pickerLevelId ? (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-600">Assign page to level</p>
                  {pendingSheets.map((sheet) => (
                    <div key={sheet.fileId} className="rounded-lg border border-slate-200 p-2">
                      <p className="truncate text-xs font-medium">{sheet.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {sheet.selectedPages.map((pi) => (
                          <button
                            key={pi}
                            type="button"
                            className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] hover:bg-slate-50"
                            onClick={() => {
                              assignPendingToLevel(pickerLevelId, sheet, pi);
                              closePicker();
                            }}
                          >
                            Page {pi + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onClick={closePicker}
              >
                Cancel
              </button>
              {!(pickerLevelId && pendingSheets.length > 0) ? (
                <button
                  type="button"
                  className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-semibold text-white"
                  onClick={confirmPickerSelection}
                >
                  {pickerLevelId ? "Add to level" : "Add selected"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
