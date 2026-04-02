"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  fetchIssuesForFileVersion,
  fetchSheetAiChat,
  fetchSheetAiSheetCache,
  fetchSheetAiSummary,
  type SheetAiChatMessage,
  type SheetAiReadingRow,
  type SheetAiTocEntry,
  type SheetAiTocKind,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { captureCanvasToPngBase64 } from "@/lib/sheetAiCapture";
import { buildSheetAiViewerSnapshot } from "@/lib/sheetAiViewerSnapshot";
import { DEFAULT_TAKEOFF_COLOR, TAKEOFF_COLOR_PRESETS } from "@/lib/takeoffUi";
import { TAKEOFF_FOCUS_FIT_MARGIN } from "@/lib/takeoffFocus";
import { useViewerStore } from "@/store/viewerStore";
import { useViewerPageCanvasRef } from "@/components/pdf-viewer/ViewerCanvasContext";
import { SheetAiMarkdown } from "@/components/pdf-viewer/sidebar/SheetAiMarkdown";

function formatTocKind(kind: SheetAiTocKind): string {
  if (kind === "mep") return "MEP";
  return kind.replace(/_/g, " ");
}

function formatReadingKind(kind: SheetAiTocKind | undefined): string {
  if (!kind) return "—";
  return formatTocKind(kind);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Neutral segment style so tabs read as “view mode”, not the same as the violet Generate CTA. */
function sheetAiDrawerTabClass(selected: boolean): string {
  return `viewer-focus-ring flex h-7 flex-1 items-center justify-center gap-1 rounded-md px-2 text-[9px] font-medium transition-colors ${
    selected
      ? "bg-slate-700/90 text-slate-50 shadow-sm ring-1 ring-white/10"
      : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
  }`;
}

export function SheetAiPanel() {
  const pageCanvasRef = useViewerPageCanvasRef();
  const qc = useQueryClient();

  const currentPage = useViewerStore((s) => s.currentPage);
  const pageIdx0 = currentPage - 1;
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const displayName = useViewerStore((s) => s.displayName);
  const textBoxFillFromFrame = useViewerStore((s) => s.textBoxFillFromFrame);

  const lastTocAnnotationIdsRef = useRef<string[]>([]);

  const { data: issuesRows = [] } = useQuery({
    queryKey: qk.issuesForFileVersion(cloudFileVersionId ?? ""),
    queryFn: () => fetchIssuesForFileVersion(cloudFileVersionId!),
    enabled: Boolean(cloudFileVersionId),
  });

  const issuesSummary = useMemo(
    () => issuesRows.map((i) => ({ title: i.title, status: i.status })),
    [issuesRows],
  );

  const [summary, setSummary] = useState("");
  const [readingsTable, setReadingsTable] = useState<SheetAiReadingRow[]>([]);
  const [tableOfContents, setTableOfContents] = useState<SheetAiTocEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<SheetAiChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"generate" | "chat">("generate");

  const { data: sheetCache, isSuccess: sheetCacheReady } = useQuery({
    queryKey: qk.sheetAiSheetCache(cloudFileVersionId ?? "", pageIdx0),
    queryFn: () => fetchSheetAiSheetCache(cloudFileVersionId!, pageIdx0),
    enabled: Boolean(cloudFileVersionId),
    staleTime: 60_000,
  });

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

  const runSummary = useCallback(async () => {
    if (!cloudFileVersionId) return;
    setSummaryLoading(true);
    try {
      const ctx = await captureContext();
      const {
        summaryMarkdown,
        readingsTable: rows,
        tableOfContents: toc,
      } = await fetchSheetAiSummary(cloudFileVersionId, ctx);
      if (lastTocAnnotationIdsRef.current.length > 0) {
        useViewerStore.getState().removeAnnotations(lastTocAnnotationIdsRef.current);
        lastTocAnnotationIdsRef.current = [];
      }
      setSummary(summaryMarkdown);
      setReadingsTable(rows);
      setTableOfContents(toc);
      void qc.invalidateQueries({
        queryKey: qk.sheetAiSheetCache(cloudFileVersionId, pageIdx0),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setSummaryLoading(false);
    }
  }, [cloudFileVersionId, captureContext, qc, pageIdx0]);

  useEffect(() => {
    setSummary("");
    setReadingsTable([]);
    setTableOfContents([]);
    setChatMessages([]);
    if (lastTocAnnotationIdsRef.current.length > 0) {
      useViewerStore.getState().removeAnnotations(lastTocAnnotationIdsRef.current);
      lastTocAnnotationIdsRef.current = [];
    }
  }, [cloudFileVersionId, currentPage]);

  useEffect(() => {
    if (!cloudFileVersionId || !sheetCacheReady || !sheetCache) return;
    if (sheetCache.cached !== true) return;
    setSummary(sheetCache.summaryMarkdown);
    setReadingsTable(sheetCache.readingsTable);
    setTableOfContents(sheetCache.tableOfContents);
    setChatMessages(sheetCache.chatMessages ?? []);
  }, [cloudFileVersionId, pageIdx0, sheetCache, sheetCacheReady]);

  const onTocItemClick = useCallback(
    (entry: SheetAiTocEntry, colorIndex: number) => {
      const color =
        TAKEOFF_COLOR_PRESETS[colorIndex % TAKEOFF_COLOR_PRESETS.length] ?? DEFAULT_TAKEOFF_COLOR;
      let minX = clamp01(entry.minX);
      let minY = clamp01(entry.minY);
      let maxX = clamp01(entry.maxX);
      let maxY = clamp01(entry.maxY);
      if (maxX <= minX) maxX = Math.min(1, minX + 0.06);
      if (maxY <= minY) maxY = Math.min(1, minY + 0.06);
      const pageIndex0 = entry.pageIndex;

      const st = useViewerStore.getState();
      if (lastTocAnnotationIdsRef.current.length > 0) {
        st.removeAnnotations(lastTocAnnotationIdsRef.current);
        lastTocAnnotationIdsRef.current = [];
      }

      const rectId = st.addAnnotation({
        pageIndex: pageIndex0,
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
      const labelY = Math.max(0.012, minY - 0.028);
      const sheetLabel = (() => {
        const t = entry.title.trim();
        const s = entry.snippet?.trim();
        if (!s) return t.slice(0, 160);
        const combined = `${t} · ${s}`;
        return combined.length > 220 ? `${combined.slice(0, 217)}…` : combined;
      })();
      const textId = st.addAnnotation({
        pageIndex: pageIndex0,
        type: "text",
        color,
        strokeWidth: 2,
        points: [{ x: minX, y: labelY }],
        text: sheetLabel,
        fontSize: entry.snippet ? 9 : 10,
        textColor: color,
        textBoxFillFromFrame,
        author: displayName,
        fromSheetAi: true,
      });
      lastTocAnnotationIdsRef.current = [rectId, textId];

      st.requestSearchFocus({
        pageNumber: pageIndex0 + 1,
        rectNorm: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        fitMargin: TAKEOFF_FOCUS_FIT_MARGIN,
      });
    },
    [displayName, textBoxFillFromFrame],
  );

  const sendChat = useCallback(async () => {
    if (!cloudFileVersionId || !chatInput.trim()) return;
    setChatLoading(true);
    const userMsg: SheetAiChatMessage = { role: "user", content: chatInput.trim() };
    const nextThread = [...chatMessages, userMsg];
    setChatMessages(nextThread);
    setChatInput("");
    try {
      const ctx = await captureContext();
      const { reply } = await fetchSheetAiChat(cloudFileVersionId, {
        ...ctx,
        messages: nextThread,
      });
      setChatMessages((prev) => [...prev, { role: "model", content: reply }]);
      void qc.invalidateQueries({
        queryKey: qk.sheetAiSheetCache(cloudFileVersionId, pageIdx0),
      });
    } catch (e) {
      setChatMessages((prev) => prev.slice(0, -1));
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setChatLoading(false);
    }
  }, [cloudFileVersionId, chatInput, chatMessages, captureContext, qc, pageIdx0]);

  if (!cloudFileVersionId) {
    return (
      <p className="px-1 text-[10px] leading-relaxed text-[#94A3B8]">
        Open a <strong className="text-[#F8FAFC]">cloud project</strong> sheet to use Sheet AI.
      </p>
    );
  }

  const hasSmartSheet =
    summary.trim().length > 0 || readingsTable.length > 0 || tableOfContents.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
      <div
        className="flex shrink-0 gap-1 rounded-lg bg-slate-950/90 p-1 ring-1 ring-slate-700/70"
        role="tablist"
        aria-label="Sheet AI: choose panel"
      >
        <button
          type="button"
          role="tab"
          aria-selected={drawerTab === "generate"}
          id="sheet-ai-tab-generate"
          aria-controls="sheet-ai-panel-generate"
          onClick={() => setDrawerTab("generate")}
          className={sheetAiDrawerTabClass(drawerTab === "generate")}
        >
          <Sparkles
            className={`h-2.5 w-2.5 shrink-0 ${drawerTab === "generate" ? "text-violet-300" : "text-slate-500"}`}
            aria-hidden
          />
          Smart sheet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={drawerTab === "chat"}
          id="sheet-ai-tab-chat"
          aria-controls="sheet-ai-panel-chat"
          onClick={() => setDrawerTab("chat")}
          className={sheetAiDrawerTabClass(drawerTab === "chat")}
        >
          <MessageSquare
            className={`h-2.5 w-2.5 shrink-0 ${drawerTab === "chat" ? "text-sky-300" : "text-slate-500"}`}
            aria-hidden
          />
          Chat
        </button>
      </div>
      <p className="shrink-0 px-0.5 text-[8px] leading-tight text-[#64748b]">
        AI can misread drawings — verify on the sheet.
      </p>

      <div className="min-h-0 flex-1 overflow-hidden">
        {drawerTab === "generate" ? (
          <section
            id="sheet-ai-panel-generate"
            role="tabpanel"
            aria-labelledby="sheet-ai-tab-generate"
            className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-[#334155]/70 bg-[#1e293b]/40"
          >
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1 [scrollbar-width:thin]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                    <Sparkles className="h-2.5 w-2.5 text-violet-400" aria-hidden />
                    Smart sheet
                  </h3>
                  {hasSmartSheet ? (
                    <button
                      type="button"
                      disabled={summaryLoading}
                      onClick={() => void runSummary()}
                      className="shrink-0 text-[8px] font-medium text-sky-400 hover:text-sky-300 disabled:opacity-40"
                    >
                      {summaryLoading ? "…" : "Regenerate"}
                    </button>
                  ) : null}
                </div>
                {sheetCacheReady && sheetCache?.cached === true && hasSmartSheet ? (
                  <p className="text-[7px] leading-tight text-[#64748b]">
                    Saved on server — Regenerate runs the model again.
                  </p>
                ) : null}
                {!hasSmartSheet ? (
                  <button
                    type="button"
                    disabled={summaryLoading}
                    onClick={() => void runSummary()}
                    className="w-full rounded border border-violet-500/40 bg-violet-600/85 py-1 text-[9px] font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                  >
                    {summaryLoading ? "Generating…" : "Generate smart sheet"}
                  </button>
                ) : null}
              </div>
              {summaryLoading && !hasSmartSheet ? (
                <div className="flex items-center gap-1 py-1 text-[9px] text-[#94A3B8]">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
                  Analyzing…
                </div>
              ) : null}
              {summary.trim() ? (
                <div>
                  <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Overview
                  </p>
                  <div className="max-h-[min(24vh,160px)] min-h-0 overflow-y-auto rounded border border-[#334155]/60 [scrollbar-width:thin]">
                    <SheetAiMarkdown content={summary} variant="assistant" compact />
                  </div>
                </div>
              ) : !summaryLoading && !hasSmartSheet ? (
                <p className="text-[9px] leading-snug text-[#64748b]">
                  Use <strong className="text-slate-400">Generate smart sheet</strong> for overview,
                  tables, and zoom regions.
                </p>
              ) : null}
              {readingsTable.length > 0 ? (
                <div className="border-t border-[#334155] pt-1.5">
                  <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                    Elements & details
                  </p>
                  <div className="max-h-[min(32vh,260px)] overflow-auto rounded border border-[#334155] [scrollbar-width:thin]">
                    <table className="w-full min-w-[280px] border-collapse text-left text-[9px] text-slate-200">
                      <thead>
                        <tr className="border-b border-[#334155] bg-slate-900/80">
                          <th className="px-1.5 py-1 font-semibold text-[#94a3b8]">Element</th>
                          <th className="px-1.5 py-1 font-semibold text-[#94a3b8]">Kind</th>
                          <th className="px-1.5 py-1 font-semibold text-[#94a3b8]">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readingsTable.map((row, i) => (
                          <tr
                            key={`${row.element}-${i}`}
                            className="border-b border-[#334155]/80 align-top last:border-b-0 hover:bg-slate-800/40"
                          >
                            <td className="max-w-[100px] px-1.5 py-1 font-medium text-slate-100">
                              {row.element}
                            </td>
                            <td className="whitespace-nowrap px-1.5 py-1 text-[8px] uppercase tracking-wide text-slate-500">
                              {formatReadingKind(row.kind)}
                            </td>
                            <td className="px-1.5 py-1 text-slate-300">{row.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {tableOfContents.length > 0 ? (
                <div className="border-t border-[#334155] pt-1.5">
                  <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                    On sheet — click row to zoom
                  </p>
                  <div className="max-h-[min(28vh,220px)] overflow-auto rounded border border-[#334155] [scrollbar-width:thin]">
                    <table className="w-full min-w-[260px] border-collapse text-left text-[9px]">
                      <thead>
                        <tr className="border-b border-[#334155] bg-slate-900/80">
                          <th className="w-2 px-1 py-1" aria-hidden />
                          <th className="px-1 py-1 font-semibold text-[#94a3b8]">Region</th>
                          <th className="px-1 py-1 font-semibold text-[#94a3b8]">Kind</th>
                          <th className="px-1 py-1 font-semibold text-[#94a3b8]">Read</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableOfContents.map((e, i) => (
                          <tr
                            key={`${e.title}-${i}`}
                            className="border-b border-[#334155]/80 align-top last:border-b-0"
                          >
                            <td className="px-1 py-1">
                              <span
                                className="inline-block h-3 w-1 rounded-sm"
                                style={{
                                  backgroundColor:
                                    TAKEOFF_COLOR_PRESETS[i % TAKEOFF_COLOR_PRESETS.length] ??
                                    DEFAULT_TAKEOFF_COLOR,
                                }}
                                aria-hidden
                              />
                            </td>
                            <td className="px-1 py-1">
                              <button
                                type="button"
                                onClick={() => onTocItemClick(e, i)}
                                className="text-left font-medium text-sky-400 hover:text-sky-300 hover:underline"
                              >
                                {e.title}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-1 py-1 text-[8px] uppercase text-slate-500">
                              {e.kind ? formatTocKind(e.kind) : "—"}
                            </td>
                            <td className="max-w-[140px] px-1 py-1 text-slate-400">
                              {e.snippet ? <span className="line-clamp-2">{e.snippet}</span> : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section
            id="sheet-ai-panel-chat"
            role="tabpanel"
            aria-labelledby="sheet-ai-tab-chat"
            className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-[#334155]/70 bg-[#1e293b]/40"
          >
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1 [scrollbar-width:thin]">
              {chatMessages.length === 0 ? (
                <p className="text-[9px] leading-snug text-[#64748b]">
                  Ask about this sheet — MEP, envelope, quantities.
                </p>
              ) : (
                chatMessages.map((m, i) => (
                  <div
                    key={`${i}-${m.role}`}
                    className={`rounded px-1.5 py-1 text-[10px] leading-snug ${
                      m.role === "user"
                        ? "ml-3 bg-sky-950/50 text-sky-100"
                        : "mr-3 bg-slate-800/80 text-slate-200"
                    }`}
                  >
                    <span className="mb-0.5 block text-[8px] font-semibold uppercase text-[#64748b]">
                      {m.role === "user" ? "You" : "Sheet AI"}
                    </span>
                    <SheetAiMarkdown
                      content={m.content}
                      variant={m.role === "user" ? "user" : "assistant"}
                      compact
                    />
                  </div>
                ))
              )}
            </div>
            <div className="shrink-0 border-t border-[#334155]/70 p-1">
              <div className="flex items-end gap-1">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message…"
                  rows={2}
                  className="min-h-9 min-w-0 flex-1 resize-none rounded border border-[#475569] bg-[#0f172a] px-1.5 py-1 text-[9px] leading-snug text-[#f8fafc] placeholder:text-[#64748b] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={chatLoading || !chatInput.trim()}
                  onClick={() => void sendChat()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40"
                  title="Send"
                >
                  {chatLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
