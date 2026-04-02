"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  createIssue,
  fetchIssuesForFileVersion,
  fetchProject,
  fetchSheetAiChat,
  fetchSheetAiProposeActions,
  fetchSheetAiSummary,
  formatIssueLockHint,
  patchIssue,
  type SheetAiChatMessage,
  type SheetAiProposals,
  type SheetAiTocEntry,
  type SheetAiTocKind,
} from "@/lib/api-client";
import { issueStatusMarkerStrokeHex } from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { captureCanvasToPngBase64 } from "@/lib/sheetAiCapture";
import {
  applyItemToRawQuantity,
  computeRawQuantity,
  rectPolygonFromTwoCornersNorm,
} from "@/lib/takeoffCompute";
import { DEFAULT_TAKEOFF_COLOR, TAKEOFF_COLOR_PRESETS } from "@/lib/takeoffUi";
import type { TakeoffMeasurementType, TakeoffUnit } from "@/lib/takeoffTypes";
import { publishTakeoffZoneToProjectLine } from "@/lib/takeoffPublishCloud";
import { TAKEOFF_FOCUS_FIT_MARGIN } from "@/lib/takeoffFocus";
import { useViewerStore } from "@/store/viewerStore";
import { useViewerPageCanvasRef } from "@/components/pdf-viewer/ViewerCanvasContext";
import { SheetAiMarkdown } from "@/components/pdf-viewer/sidebar/SheetAiMarkdown";

function formatTocKind(kind: SheetAiTocKind): string {
  if (kind === "mep") return "MEP";
  return kind.replace(/_/g, " ");
}

function defaultUnitFor(mt: TakeoffMeasurementType): TakeoffUnit {
  if (mt === "area") return "m²";
  if (mt === "linear") return "m";
  return "ea";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function buildViewerSnapshot(
  pageIndex0: number,
  state: ReturnType<typeof useViewerStore.getState>,
  issues?: { title: string; status: string }[],
): Record<string, unknown> {
  return {
    currentPage1Based: pageIndex0 + 1,
    fileName: state.fileName,
    pageCalibrated: Boolean(state.calibrationByPage[pageIndex0]),
    takeoffZonesOnPage: state.takeoffZones.filter((z) => z.pageIndex === pageIndex0).length,
    takeoffItemCount: state.takeoffItems.length,
    markupsOnPage: state.annotations.filter(
      (a) =>
        a.pageIndex === pageIndex0 && !a.linkedIssueId && !a.issueDraft && a.type !== "measurement",
    ).length,
    openIssuesOnSheet: issues ?? [],
  };
}

export function SheetAiPanel() {
  const pageCanvasRef = useViewerPageCanvasRef();
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const qc = useQueryClient();

  const currentPage = useViewerStore((s) => s.currentPage);
  const pageIdx0 = currentPage - 1;
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const takeoffAddItem = useViewerStore((s) => s.takeoffAddItem);
  const takeoffAddZone = useViewerStore((s) => s.takeoffAddZone);
  const addAnnotation = useViewerStore((s) => s.addAnnotation);
  const displayName = useViewerStore((s) => s.displayName);
  const strokeWidth = useViewerStore((s) => s.strokeWidth);
  const textBoxFillFromFrame = useViewerStore((s) => s.textBoxFillFromFrame);

  const lastTocAnnotationIdsRef = useRef<string[]>([]);

  const { data: project } = useQuery({
    queryKey: qk.project(viewerProjectId ?? ""),
    queryFn: () => fetchProject(viewerProjectId!),
    enabled: Boolean(viewerProjectId),
  });
  const workspaceId = project?.workspaceId;

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
  const [tableOfContents, setTableOfContents] = useState<SheetAiTocEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<SheetAiChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [proposals, setProposals] = useState<SheetAiProposals | null>(null);
  const [proposePrompt, setProposePrompt] = useState("");
  const [proposeLoading, setProposeLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);

  const captureContext = useCallback(async () => {
    const cap = captureCanvasToPngBase64(pageCanvasRef?.current ?? null);
    if (!cap) throw new Error("Could not capture the sheet image.");
    const st = useViewerStore.getState();
    const snap = buildViewerSnapshot(pageIdx0, st, issuesSummary);
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
      const { summaryMarkdown, tableOfContents: toc } = await fetchSheetAiSummary(
        cloudFileVersionId,
        ctx,
      );
      if (lastTocAnnotationIdsRef.current.length > 0) {
        useViewerStore.getState().removeAnnotations(lastTocAnnotationIdsRef.current);
        lastTocAnnotationIdsRef.current = [];
      }
      setSummary(summaryMarkdown);
      setTableOfContents(toc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setSummaryLoading(false);
    }
  }, [cloudFileVersionId, captureContext]);

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

  useEffect(() => {
    if (!cloudFileVersionId) return;
    const t = window.setTimeout(() => {
      void runSummary();
    }, 500);
    return () => window.clearTimeout(t);
  }, [cloudFileVersionId, currentPage, runSummary]);

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
    } catch (e) {
      setChatMessages((prev) => prev.slice(0, -1));
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setChatLoading(false);
    }
  }, [cloudFileVersionId, chatInput, chatMessages, captureContext]);

  const runProposals = useCallback(async () => {
    if (!cloudFileVersionId) return;
    setProposeLoading(true);
    setProposals(null);
    try {
      const ctx = await captureContext();
      const { proposals: p } = await fetchSheetAiProposeActions(cloudFileVersionId, {
        ...ctx,
        userPrompt: proposePrompt.trim() || undefined,
      });
      setProposals(p);
      const n = p.takeoffZones.length + p.issueDrafts.length + p.markups.length;
      toast.success(
        n ? `Received ${n} suggestion(s) — review and apply.` : "No suggestions returned.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suggestions failed");
    } finally {
      setProposeLoading(false);
    }
  }, [cloudFileVersionId, captureContext, proposePrompt]);

  const applyTakeoffZones = useCallback(
    (zones: SheetAiProposals["takeoffZones"]) => {
      const cal = calibrationByPage[pageIdx0];
      const sz = pageSizePtByPage[pageIdx0];
      if (!cal || !sz) {
        toast.error("Calibrate this page before applying takeoff zones.");
        return 0;
      }
      let n = 0;
      for (let zi = 0; zi < zones.length; zi++) {
        const z = zones[zi]!;
        const st = useViewerStore.getState();
        const cfv = st.cloudFileVersionId;
        let pts = z.points.map((p) => ({ ...p }));
        if (z.measurementType === "area" && pts.length === 2) {
          pts = rectPolygonFromTwoCornersNorm(pts[0]!, pts[1]!);
        }
        const name = (z.suggestedItemName?.trim() || `AI — ${z.measurementType}`).slice(0, 200);
        let itemId = st.takeoffItems.find(
          (it) => it.name.trim().toLowerCase() === name.toLowerCase(),
        )?.id;
        if (!itemId) {
          const color =
            TAKEOFF_COLOR_PRESETS[zi % TAKEOFF_COLOR_PRESETS.length] ?? DEFAULT_TAKEOFF_COLOR;
          itemId = takeoffAddItem({
            name,
            unit: defaultUnitFor(z.measurementType),
            measurementType: z.measurementType,
            color,
          });
        }
        const item = useViewerStore.getState().takeoffItems.find((i) => i.id === itemId)!;
        const rawGeom = computeRawQuantity(
          z.measurementType,
          pts,
          sz.wPt,
          sz.hPt,
          cal.mmPerPdfUnit,
        );
        const computed = applyItemToRawQuantity(item, rawGeom);
        const newId = takeoffAddZone({
          itemId,
          pageIndex: pageIdx0,
          points: pts,
          measurementType: z.measurementType,
          rawQuantity: rawGeom,
          computedQuantity: computed,
          notes: z.notes?.trim() || undefined,
          createdBy: displayName,
        });
        n++;
        const st2 = useViewerStore.getState();
        const zNew = st2.takeoffZones.find((x) => x.id === newId);
        const itNew = st2.takeoffItems.find((i) => i.id === itemId);
        if (cfv && zNew && itNew) publishTakeoffZoneToProjectLine(cfv, itNew, zNew);
      }
      return n;
    },
    [calibrationByPage, pageIdx0, pageSizePtByPage, takeoffAddItem, takeoffAddZone, displayName],
  );

  const applyMarkups = useCallback(
    (markups: SheetAiProposals["markups"]) => {
      let n = 0;
      for (const m of markups) {
        const color = m.color ?? "#fbbf24";
        const sw = m.strokeWidth ?? strokeWidth;
        let points = m.points.map((p) => ({ ...p }));
        if (m.type === "highlight" && points.length === 2) {
          const r = rectPolygonFromTwoCornersNorm(points[0]!, points[1]!);
          points = [...r, { ...r[0]! }];
        }
        if (m.type === "text") {
          if (points.length < 1) continue;
          addAnnotation({
            pageIndex: pageIdx0,
            type: "text",
            color,
            strokeWidth: sw,
            points: [points[0]!],
            text: (m.text ?? "Note").slice(0, 4000),
            fontSize: 11,
            textColor: color,
            author: displayName,
          });
          n++;
          continue;
        }
        addAnnotation({
          pageIndex: pageIdx0,
          type: m.type,
          color,
          strokeWidth: sw,
          points,
          author: displayName,
        });
        n++;
      }
      return n;
    },
    [addAnnotation, displayName, pageIdx0, strokeWidth],
  );

  const applyIssueDrafts = useCallback(
    async (drafts: SheetAiProposals["issueDrafts"]) => {
      if (!workspaceId || !fileId || !cloudFileVersionId) {
        toast.error("Missing project or file context for issues.");
        return 0;
      }
      let n = 0;
      for (const d of drafts) {
        const pageNumber = d.pageNumber ?? currentPage;
        try {
          const row = await createIssue({
            workspaceId,
            fileId,
            fileVersionId: cloudFileVersionId,
            title: d.title.trim().slice(0, 300),
            description: d.description?.trim() || undefined,
            pageNumber,
          });
          if (d.pinNorm) {
            const pinN = 0.006;
            const x = d.pinNorm.x;
            const y = d.pinNorm.y;
            const strokeHex = issueStatusMarkerStrokeHex(row.status);
            const annId = useViewerStore.getState().addAnnotation({
              pageIndex: pageNumber - 1,
              type: "ellipse",
              color: strokeHex,
              strokeWidth: 0,
              points: [
                { x: x - pinN, y: y - pinN },
                { x: x + pinN, y: y + pinN },
              ],
              linkedIssueId: row.id,
              issueStatus: row.status,
              linkedIssueTitle: row.title,
              author: displayName,
            });
            await patchIssue(row.id, { annotationId: annId });
          }
          n++;
        } catch (e) {
          toast.error(formatIssueLockHint(e));
        }
      }
      void qc.invalidateQueries({ queryKey: qk.issuesForFileVersion(cloudFileVersionId) });
      return n;
    },
    [workspaceId, fileId, cloudFileVersionId, currentPage, displayName, qc],
  );

  const applyAllProposals = useCallback(async () => {
    if (!proposals) return;
    setApplyBusy(true);
    try {
      const a = applyTakeoffZones(proposals.takeoffZones);
      const b = applyMarkups(proposals.markups);
      const c = await applyIssueDrafts(proposals.issueDrafts);
      toast.success(`Applied ${a} takeoff zone(s), ${b} markup(s), ${c} issue(s).`);
      setProposals(null);
    } finally {
      setApplyBusy(false);
    }
  }, [proposals, applyTakeoffZones, applyMarkups, applyIssueDrafts]);

  if (!cloudFileVersionId) {
    return (
      <p className="px-1 text-[10px] leading-relaxed text-[#94A3B8]">
        Open a <strong className="text-[#F8FAFC]">cloud project</strong> sheet to use Sheet AI.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <p className="shrink-0 text-[9px] leading-snug text-[#64748b]">
        AI can misread drawings. Review suggestions — not professional advice.
      </p>

      <section className="shrink-0 rounded-md border border-[#334155] bg-[#1e293b]/60 p-1.5">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            <Sparkles className="h-3 w-3 text-violet-400" aria-hidden />
            Summary
          </h3>
          <button
            type="button"
            disabled={summaryLoading}
            onClick={() => void runSummary()}
            className="text-[9px] font-medium text-sky-400 hover:text-sky-300 disabled:opacity-40"
          >
            {summaryLoading ? "…" : "Regenerate"}
          </button>
        </div>
        {summaryLoading && !summary ? (
          <div className="flex items-center gap-1.5 py-2 text-[10px] text-[#94A3B8]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Analyzing…
          </div>
        ) : summary.trim() ? (
          <div className="max-h-[min(28vh,200px)] min-h-0 overflow-y-auto [scrollbar-width:thin]">
            <SheetAiMarkdown content={summary} variant="assistant" compact />
          </div>
        ) : (
          <div className="max-h-28 overflow-y-auto text-[10px] leading-snug text-[#94a3b8] [scrollbar-width:thin]">
            No summary yet.
          </div>
        )}
        {tableOfContents.length > 0 ? (
          <div className="mt-1.5 border-t border-[#334155] pt-1.5">
            <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              On sheet — click to zoom (MEP, envelope, details, notes…)
            </p>
            <ul className="max-h-[min(22vh,160px)] space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
              {tableOfContents.map((e, i) => (
                <li key={`${e.title}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onTocItemClick(e, i)}
                    className="flex w-full items-start gap-1.5 rounded border border-transparent px-1 py-0.5 text-left transition hover:border-slate-600 hover:bg-slate-800/80"
                  >
                    <span
                      className="mt-0.5 h-2.5 w-0.5 shrink-0 rounded-sm"
                      style={{
                        backgroundColor:
                          TAKEOFF_COLOR_PRESETS[i % TAKEOFF_COLOR_PRESETS.length] ??
                          DEFAULT_TAKEOFF_COLOR,
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-0.5">
                        <span className="text-[10px] font-medium leading-tight text-slate-100">
                          {e.title}
                        </span>
                        {e.kind ? (
                          <span className="rounded bg-slate-800/90 px-1 py-px text-[7px] font-semibold uppercase tracking-wide text-slate-400">
                            {formatTocKind(e.kind)}
                          </span>
                        ) : null}
                      </span>
                      {e.snippet ? (
                        <span className="mt-px line-clamp-2 block text-[9px] leading-tight text-slate-400">
                          {e.snippet}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#334155] bg-[#1e293b]/60">
        <h3 className="shrink-0 border-b border-[#334155] px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          Chat
        </h3>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1.5 py-1.5 [scrollbar-width:thin]">
          {chatMessages.length === 0 ? (
            <p className="text-[10px] text-[#64748b]">
              Ask about MEP, wall sections, insulation, or quantities on this page.
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
        <div className="shrink-0 border-t border-[#334155] p-1.5">
          <div className="flex gap-1">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message…"
              rows={2}
              className="min-h-0 flex-1 resize-none rounded border border-[#475569] bg-[#0f172a] px-1.5 py-1 text-[10px] text-[#f8fafc] placeholder:text-[#64748b] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40"
              title="Send"
            >
              {chatLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="shrink-0 rounded-md border border-[#334155] bg-[#1e293b]/60 p-1.5">
        <h3 className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          <Wand2 className="h-3 w-3 text-amber-400" aria-hidden />
          Suggestions
        </h3>
        <textarea
          value={proposePrompt}
          onChange={(e) => setProposePrompt(e.target.value)}
          placeholder="Optional focus (e.g. duct insulation, wall types)…"
          rows={2}
          className="mb-1 w-full resize-none rounded border border-[#475569] bg-[#0f172a] px-1.5 py-1 text-[10px] text-[#f8fafc] placeholder:text-[#64748b]"
        />
        <button
          type="button"
          disabled={proposeLoading}
          onClick={() => void runProposals()}
          className="mb-1 w-full rounded bg-amber-600/90 py-1.5 text-[10px] font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
        >
          {proposeLoading ? "Requesting…" : "Get suggestions"}
        </button>

        {proposals ? (
          <div className="space-y-1 border-t border-[#334155] pt-1.5">
            <p className="text-[9px] text-[#94A3B8]">
              Takeoff: {proposals.takeoffZones.length} · Issues: {proposals.issueDrafts.length} ·
              Markups: {proposals.markups.length}
            </p>
            <button
              type="button"
              disabled={
                applyBusy ||
                (proposals.takeoffZones.length === 0 &&
                  proposals.issueDrafts.length === 0 &&
                  proposals.markups.length === 0)
              }
              onClick={() => void applyAllProposals()}
              className="w-full rounded border border-emerald-600/60 bg-emerald-950/40 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-40"
            >
              {applyBusy ? "Applying…" : "Apply all to sheet"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
