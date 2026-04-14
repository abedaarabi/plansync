"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  fetchIssuesForFileVersion,
  fetchSheetAiSheetCache,
  fetchTakeoffAssistDetect,
  type TakeoffAssistCachePayload,
  type TakeoffAssistCategory,
  type TakeoffAssistItem,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { captureCanvasToPngBase64 } from "@/lib/sheetAiCapture";
import { buildSheetAiViewerSnapshot } from "@/lib/sheetAiViewerSnapshot";
import { DEFAULT_TAKEOFF_COLOR, TAKEOFF_COLOR_PRESETS } from "@/lib/takeoffUi";
import { TAKEOFF_FOCUS_FIT_MARGIN } from "@/lib/takeoffFocus";
import { useViewerStore } from "@/store/viewerStore";
import { useViewerPageCanvasRef } from "@/components/pdf-viewer/ViewerCanvasContext";

const CATEGORY_ORDER: TakeoffAssistCategory[] = ["windows", "doors", "walls", "rooms"];

const CATEGORY_LABEL: Record<TakeoffAssistCategory, string> = {
  windows: "Windows",
  doors: "Doors",
  walls: "Walls",
  rooms: "Rooms",
};

const CATEGORY_COLOR: Record<TakeoffAssistCategory, string> = {
  windows: TAKEOFF_COLOR_PRESETS[0] ?? DEFAULT_TAKEOFF_COLOR,
  doors: TAKEOFF_COLOR_PRESETS[1] ?? DEFAULT_TAKEOFF_COLOR,
  walls: TAKEOFF_COLOR_PRESETS[2] ?? DEFAULT_TAKEOFF_COLOR,
  rooms: TAKEOFF_COLOR_PRESETS[3] ?? DEFAULT_TAKEOFF_COLOR,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function selectionToCategories(
  sel: Record<TakeoffAssistCategory, boolean>,
): TakeoffAssistCategory[] {
  return CATEGORY_ORDER.filter((c) => sel[c]);
}

function emptySelection(): Record<TakeoffAssistCategory, boolean> {
  return { windows: false, doors: false, walls: false, rooms: false };
}

export function SheetAiPanel() {
  const pageCanvasRef = useViewerPageCanvasRef();
  const qc = useQueryClient();

  const currentPage = useViewerStore((s) => s.currentPage);
  const pageIdx0 = currentPage - 1;
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const displayName = useViewerStore((s) => s.displayName);
  const textBoxFillFromFrame = useViewerStore((s) => s.textBoxFillFromFrame);

  const assistAnnotationIdsRef = useRef<string[]>([]);

  const { data: issuesRows = [] } = useQuery({
    queryKey: qk.issuesForFileVersion(cloudFileVersionId ?? ""),
    queryFn: () => fetchIssuesForFileVersion(cloudFileVersionId!),
    enabled: Boolean(cloudFileVersionId),
  });

  const issuesSummary = useMemo(
    () => issuesRows.map((i) => ({ title: i.title, status: i.status })),
    [issuesRows],
  );

  const [selected, setSelected] = useState(emptySelection);
  const [takeoffResult, setTakeoffResult] = useState<TakeoffAssistCachePayload | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);

  const { data: sheetCache, isSuccess: sheetCacheReady } = useQuery({
    queryKey: qk.sheetAiSheetCache(cloudFileVersionId ?? "", pageIdx0),
    queryFn: () => fetchSheetAiSheetCache(cloudFileVersionId!, pageIdx0),
    enabled: Boolean(cloudFileVersionId),
    staleTime: 60_000,
  });

  const clearAssistOverlays = useCallback(() => {
    if (assistAnnotationIdsRef.current.length === 0) return;
    useViewerStore.getState().removeAnnotations(assistAnnotationIdsRef.current);
    assistAnnotationIdsRef.current = [];
  }, []);

  const drawTakeoffItems = useCallback(
    (items: TakeoffAssistItem[]) => {
      clearAssistOverlays();
      const st = useViewerStore.getState();
      const ids: string[] = [];
      for (const it of items) {
        if (it.pageIndex !== pageIdx0) continue;
        let minX = clamp01(it.minX);
        let minY = clamp01(it.minY);
        let maxX = clamp01(it.maxX);
        let maxY = clamp01(it.maxY);
        if (maxX <= minX) maxX = Math.min(1, minX + 0.04);
        if (maxY <= minY) maxY = Math.min(1, minY + 0.04);
        const color = CATEGORY_COLOR[it.category] ?? DEFAULT_TAKEOFF_COLOR;
        const rectId = st.addAnnotation({
          pageIndex: it.pageIndex,
          type: "rect",
          color,
          strokeWidth: 3,
          points: [
            { x: minX, y: minY },
            { x: maxX, y: maxY },
          ],
          author: displayName,
          fromSheetAi: true,
        });
        ids.push(rectId);
        const labelY = Math.max(0.01, minY - 0.024);
        const short =
          it.label?.trim().slice(0, 48) || CATEGORY_LABEL[it.category].slice(0, 3).toUpperCase();
        const textId = st.addAnnotation({
          pageIndex: it.pageIndex,
          type: "text",
          color,
          strokeWidth: 2,
          points: [{ x: minX, y: labelY }],
          text: short,
          fontSize: 8,
          textColor: color,
          textBoxFillFromFrame,
          author: displayName,
          fromSheetAi: true,
        });
        ids.push(textId);
      }
      assistAnnotationIdsRef.current = ids;
    },
    [clearAssistOverlays, displayName, pageIdx0, textBoxFillFromFrame],
  );

  const captureContext = useCallback(async () => {
    const cap = captureCanvasToPngBase64(pageCanvasRef?.current ?? null);
    if (!cap) throw new Error("Could not capture the sheet image.");
    const st = useViewerStore.getState();
    const snap = buildSheetAiViewerSnapshot(pageIdx0, st, issuesSummary);
    return {
      pageIndex: pageIdx0,
      imageBase64: cap.base64,
      mimeType: cap.mimeType,
      viewerSnapshot: snap,
    };
  }, [pageCanvasRef, pageIdx0, issuesSummary]);

  const runDetect = useCallback(async () => {
    if (!cloudFileVersionId) return;
    const categories = selectionToCategories(selected);
    if (categories.length === 0) return;
    setDetectLoading(true);
    try {
      const ctx = await captureContext();
      const { takeoffAssist } = await fetchTakeoffAssistDetect(cloudFileVersionId, {
        ...ctx,
        categories,
      });
      setTakeoffResult(takeoffAssist);
      void qc.invalidateQueries({
        queryKey: qk.sheetAiSheetCache(cloudFileVersionId, pageIdx0),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detect failed");
    } finally {
      setDetectLoading(false);
    }
  }, [cloudFileVersionId, captureContext, qc, pageIdx0, selected]);

  useEffect(() => {
    setTakeoffResult(null);
    setSelected(emptySelection());
    clearAssistOverlays();
  }, [cloudFileVersionId, currentPage, clearAssistOverlays]);

  useEffect(() => {
    if (!cloudFileVersionId || !sheetCacheReady || !sheetCache || sheetCache.cached !== true) {
      return;
    }
    const ta = sheetCache.takeoffAssist;
    if (!ta || ta.categories.length === 0) return;
    setTakeoffResult(ta);
    setSelected({
      windows: ta.categories.includes("windows"),
      doors: ta.categories.includes("doors"),
      walls: ta.categories.includes("walls"),
      rooms: ta.categories.includes("rooms"),
    });
  }, [cloudFileVersionId, pageIdx0, sheetCache, sheetCacheReady]);

  useEffect(() => {
    if (!takeoffResult?.items.length) {
      clearAssistOverlays();
      return;
    }
    drawTakeoffItems(takeoffResult.items);
  }, [takeoffResult, drawTakeoffItems, clearAssistOverlays]);

  const focusCategory = useCallback(
    (cat: TakeoffAssistCategory) => {
      const it = takeoffResult?.items.find((x) => x.category === cat && x.pageIndex === pageIdx0);
      if (!it) return;
      let minX = clamp01(it.minX);
      let minY = clamp01(it.minY);
      let maxX = clamp01(it.maxX);
      let maxY = clamp01(it.maxY);
      if (maxX <= minX) maxX = Math.min(1, minX + 0.06);
      if (maxY <= minY) maxY = Math.min(1, minY + 0.06);
      useViewerStore.getState().requestSearchFocus({
        pageNumber: it.pageIndex + 1,
        rectNorm: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        fitMargin: TAKEOFF_FOCUS_FIT_MARGIN,
      });
    },
    [pageIdx0, takeoffResult],
  );

  const toggleCategory = useCallback((cat: TakeoffAssistCategory) => {
    setSelected((s) => ({ ...s, [cat]: !s[cat] }));
  }, []);

  const selectedCategories = useMemo(() => selectionToCategories(selected), [selected]);
  const hasServerTakeoff =
    sheetCacheReady && sheetCache?.cached === true && Boolean(sheetCache.takeoffAssist);

  if (!cloudFileVersionId) {
    return (
      <p className="px-1 text-[10px] leading-relaxed text-[#94A3B8]">
        Open a <strong className="text-[#F8FAFC]">cloud project</strong> sheet to use Takeoff
        assist.
      </p>
    );
  }

  const tableCategories = takeoffResult?.categories.length
    ? takeoffResult.categories
    : selectedCategories;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 rounded border border-[#334155]/70 bg-[#1e293b]/40 px-1 py-0.5">
        <h3 className="flex flex-1 items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          <Sparkles className="h-2.5 w-2.5 text-violet-400" aria-hidden />
          Takeoff assist
        </h3>
      </div>
      <p className="shrink-0 px-0.5 text-[8px] leading-tight text-[#64748b]">
        Estimates from this view only — verify counts on the sheet.
      </p>

      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-[#334155]/70 bg-[#1e293b]/40"
        aria-label="Takeoff assist"
      >
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1 [scrollbar-width:thin]">
          <div>
            <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Detect
            </p>
            <div className="flex flex-col gap-0.5 rounded border border-[#334155]/60 bg-slate-900/40 px-1 py-1">
              {CATEGORY_ORDER.map((cat) => (
                <label
                  key={cat}
                  className="flex cursor-pointer items-center gap-1.5 text-[9px] text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={selected[cat]}
                    onChange={() => toggleCategory(cat)}
                    className="h-3 w-3 shrink-0 rounded border-[#475569] bg-[#0f172a] text-violet-500"
                  />
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: CATEGORY_COLOR[cat] }}
                    aria-hidden
                  />
                  {CATEGORY_LABEL[cat]}
                </label>
              ))}
            </div>
          </div>

          {hasServerTakeoff ? (
            <p className="text-[7px] leading-tight text-[#64748b]">
              Saved on server for this page.
            </p>
          ) : null}

          <button
            type="button"
            disabled={detectLoading || selectedCategories.length === 0}
            onClick={() => void runDetect()}
            className="w-full rounded border border-violet-500/40 bg-violet-600/85 py-1 text-[9px] font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {detectLoading ? "Detecting…" : "Detect"}
          </button>

          {detectLoading ? (
            <div className="flex items-center gap-1 py-0.5 text-[9px] text-[#94A3B8]">
              <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
              Analyzing…
            </div>
          ) : null}

          {takeoffResult && tableCategories.length > 0 ? (
            <div className="border-t border-[#334155] pt-1">
              <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                Quantities
              </p>
              <div className="max-h-[min(40vh,280px)] overflow-auto rounded border border-[#334155] [scrollbar-width:thin]">
                <table className="w-full min-w-50 border-collapse text-left text-[9px] text-slate-200">
                  <thead>
                    <tr className="border-b border-[#334155] bg-slate-900/80">
                      <th className="w-2 px-1 py-1" aria-hidden />
                      <th className="px-1 py-1 font-semibold text-[#94a3b8]">Category</th>
                      <th className="px-1 py-1 font-semibold text-[#94a3b8]">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableCategories.map((cat) => {
                      const n = takeoffResult.counts[cat] ?? 0;
                      return (
                        <tr
                          key={cat}
                          className="border-b border-[#334155]/80 align-top last:border-b-0 hover:bg-slate-800/40"
                        >
                          <td className="px-1 py-1">
                            <span
                              className="inline-block h-3 w-1 rounded-sm"
                              style={{ backgroundColor: CATEGORY_COLOR[cat] }}
                              aria-hidden
                            />
                          </td>
                          <td className="px-1 py-1">
                            <button
                              type="button"
                              onClick={() => focusCategory(cat)}
                              className="text-left font-medium text-sky-400 hover:text-sky-300 hover:underline"
                            >
                              {CATEGORY_LABEL[cat]}
                            </button>
                          </td>
                          <td className="px-1 py-1 tabular-nums text-slate-100">{n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !detectLoading ? (
            <p className="text-[9px] leading-snug text-[#64748b]">
              Choose categories, then <strong className="text-slate-400">Detect</strong> to show
              counts and highlights on the sheet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
