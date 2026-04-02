"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, LayoutTemplate, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { fetchIssue, fetchMe, fetchViewerState, putViewerState } from "@/lib/api-client";
import { findAnnotationById, normRectFromAnnotationPoints } from "@/lib/issueFocus";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { setupPdfWorker } from "@/lib/pdf";
import {
  calibrationFromPersisted,
  fileFingerprint,
  loadDisplayNameFromStorage,
  loadPersistedSession,
  savePersistedSession,
} from "@/lib/sessionPersistence";
import { qk } from "@/lib/queryKeys";
import { getViewerStateSyncPayload } from "@/lib/syncViewerStatePayload";
import { VIEWER_LOCAL_PDF_INPUT_ID } from "@/lib/viewerLocalPdfInput";
import { parseServerViewerState } from "@/lib/viewerStateCloud";
import { computeScaleToFitNormRect, scrollViewportToNorm } from "@/lib/viewScroll";
import { useViewerStore, VIEWER_SCALE_MAX, VIEWER_SCALE_MIN } from "@/store/viewerStore";
import { CollaborationSync } from "./CollaborationSync";
import { ViewerCanvasContext } from "./ViewerCanvasContext";
import { PdfPageMinimap, type MinimapFocusRect } from "./PdfPageMinimap";
import { PdfPageView } from "./PdfPageView";
import { ViewerOnboarding } from "./ViewerOnboarding";
import { ViewerRightPanel } from "./ViewerRightPanel";
import { ViewerSidebar } from "./ViewerSidebar";
import { IssueFormSlider } from "./IssueFormSlider";
import { TakeoffFormSlider } from "./TakeoffFormSlider";
import { TakeoffInventoryDrawer } from "./TakeoffInventoryDrawer";
import { SheetAiDrawer } from "./SheetAiDrawer";
import { TakeoffSummaryModal } from "./TakeoffSummaryModal";
import { ViewerTopBar } from "./ViewerTopBar";

export function PdfViewer() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const fileName = useViewerStore((s) => s.fileName);
  const numPages = useViewerStore((s) => s.numPages);
  const roomId = useViewerStore((s) => s.roomId);
  const setNumPages = useViewerStore((s) => s.setNumPages);
  const currentPage = useViewerStore((s) => s.currentPage);
  const scale = useViewerStore((s) => s.scale);
  const annotations = useViewerStore((s) => s.annotations);
  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffZones = useViewerStore((s) => s.takeoffZones);
  const takeoffPackageStatus = useViewerStore((s) => s.takeoffPackageStatus);
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const snapToGeometry = useViewerStore((s) => s.snapToGeometry);
  const snapRadiusPx = useViewerStore((s) => s.snapRadiusPx);
  const fitRequest = useViewerStore((s) => s.fitRequest);
  const clearFitRequest = useViewerStore((s) => s.clearFitRequest);
  const requestFit = useViewerStore((s) => s.requestFit);
  const setScale = useViewerStore((s) => s.setScale);
  const pageSizePtByPage = useViewerStore((s) => s.pageSizePtByPage);
  const setDisplayName = useViewerStore((s) => s.setDisplayName);
  const setRoomId = useViewerStore((s) => s.setRoomId);
  const compareMode = useViewerStore((s) => s.compareMode);
  const searchFocusRequest = useViewerStore((s) => s.searchFocusRequest);
  const clearSearchFocusRequest = useViewerStore((s) => s.clearSearchFocusRequest);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const takeoffInventoryDrawerFromSidebar = useViewerStore(
    (s) => s.takeoffInventoryDrawerFromSidebar,
  );
  const sheetAiDrawerFromSidebar = useViewerStore((s) => s.sheetAiDrawerFromSidebar);
  const setPendingProSidebarTab = useViewerStore((s) => s.setPendingProSidebarTab);
  const issuePlacementBanner = useViewerStore((s) => s.issuePlacement);
  const newIssuePlacementActive = useViewerStore((s) => s.newIssuePlacementActive);
  const issueCreateDraft = useViewerStore((s) => s.issueCreateDraft);
  const takeoffSliderOpen = useViewerStore((s) => s.takeoffSliderOpen);
  const takeoffRedrawZoneId = useViewerStore((s) => s.takeoffRedrawZoneId);
  const takeoffMoveZoneId = useViewerStore((s) => s.takeoffMoveZoneId);
  const takeoffVertexEditZoneId = useViewerStore((s) => s.takeoffVertexEditZoneId);
  const setTakeoffRedrawZoneId = useViewerStore((s) => s.setTakeoffRedrawZoneId);
  const setTakeoffMoveZoneId = useViewerStore((s) => s.setTakeoffMoveZoneId);
  const setTakeoffVertexEditZoneId = useViewerStore((s) => s.setTakeoffVertexEditZoneId);
  const setIssueCreateDraft = useViewerStore((s) => s.setIssueCreateDraft);
  const tool = useViewerStore((s) => s.tool);
  const takeoffDrawKind = useViewerStore((s) => s.takeoffDrawKind);

  const takeoffRedrawZoneKind = useMemo(() => {
    if (!takeoffRedrawZoneId) return null;
    return takeoffZones.find((z) => z.id === takeoffRedrawZoneId)?.measurementType ?? null;
  }, [takeoffRedrawZoneId, takeoffZones]);
  const onIssueCreateDialogClose = useCallback(
    () => setIssueCreateDraft(null),
    [setIssueCreateDraft],
  );
  const searchParams = useSearchParams();

  const { data: me, isPending: mePending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });
  const proBlocksLocalPdf = mePending || meHasProWorkspace(me ?? null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  /** Compare mode: separate scroll surfaces so each PDF sits in its own column. */
  const compareScrollOriginalRef = useRef<HTMLDivElement>(null);
  const compareScrollMarkupRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageCanvasCompareRef = useRef<HTMLCanvasElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperCompareRef = useRef<HTMLDivElement | null>(null);
  const restoredFpRef = useRef<string | null>(null);
  /** Pro cloud: false until initial GET viewer-state finishes (avoid overwriting DB with empty state). */
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const compareMinimapFocusRef = useRef<MinimapFocusRect>({
    fx0: 0,
    fy0: 0,
    fw: 1,
    fh: 1,
  });
  const issueFocusConsumedRef = useRef<string | null>(null);
  const issueIdParam = searchParams.get("issueId");
  /** One-time fit width per PDF load; skip when deep-linking to an issue (issue focus zooms). */
  const initialFitWidthAppliedRef = useRef(false);

  useEffect(() => {
    try {
      const name = loadDisplayNameFromStorage();
      if (name) setDisplayName(name);
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setRoomId(room);
  }, [setDisplayName, setRoomId]);

  useEffect(() => {
    restoredFpRef.current = null;
    initialFitWidthAppliedRef.current = false;
  }, [fileName, pdfUrl]);

  useEffect(() => {
    setCloudHydrated(false);
  }, [cloudFileVersionId]);

  useEffect(() => {
    if (!pdfUrl) {
      setPdfDoc(null);
      setLoadError(null);
      return;
    }

    setLoadError(null);
    setPdfDoc(null);

    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        const task = pdfjs.getDocument({ url: pdfUrl });
        const doc = await task.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load PDF";
          const lower = msg.toLowerCase();
          const fetchHint =
            lower.includes("failed to fetch") || lower.includes("networkerror")
              ? " Check that you are signed in, the API is running, and your connection is stable."
              : " If this is a protected or very large file, try re-saving it from your CAD/PDF tool or open a different copy.";
          setLoadError(`${msg}${fetchHint}`);
          setPdfDoc(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, setNumPages]);

  const pdfLoading = Boolean(pdfUrl && !pdfDoc && !loadError);

  /** Warm pdf.js cache for adjacent page (smoother page turns on large files). */
  useEffect(() => {
    if (!pdfDoc || numPages < 2) return;
    const next = currentPage >= numPages ? 1 : currentPage + 1;
    void pdfDoc.getPage(next).catch(() => {});
  }, [pdfDoc, currentPage, numPages]);

  useEffect(() => {
    if (!pdfDoc || !fileName || numPages < 1) return;
    if (useViewerStore.getState().cloudFileVersionId) return;
    const fp = fileFingerprint(fileName, numPages);
    if (restoredFpRef.current === fp) return;
    const data = loadPersistedSession();
    if (!data || data.fingerprint !== fp) return;
    restoredFpRef.current = fp;
    useViewerStore.setState({
      annotations: data.annotations,
      calibrationByPage: calibrationFromPersisted(data.calibrationByPage),
      scale: Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, data.scale)),
      currentPage: Math.min(numPages, Math.max(1, data.currentPage)),
      ...(data.measureUnit != null ? { measureUnit: data.measureUnit } : {}),
      ...(data.snapToGeometry != null ? { snapToGeometry: data.snapToGeometry } : {}),
      ...(data.snapRadiusPx != null ? { snapRadiusPx: data.snapRadiusPx } : {}),
      ...(data.takeoffItems != null ? { takeoffItems: data.takeoffItems } : {}),
      ...(data.takeoffZones != null ? { takeoffZones: data.takeoffZones } : {}),
      ...(data.takeoffPackageStatus != null
        ? { takeoffPackageStatus: data.takeoffPackageStatus }
        : {}),
    });
  }, [pdfDoc, fileName, numPages, cloudFileVersionId]);

  useEffect(() => {
    if (!pdfDoc || !fileName || numPages < 1) return;
    const cfv = useViewerStore.getState().cloudFileVersionId;
    if (!cfv) return;

    let cancelled = false;

    (async () => {
      try {
        const raw = await fetchViewerState(cfv);
        if (cancelled) return;
        const parsed = parseServerViewerState(raw);
        if (parsed) {
          useViewerStore.setState({
            annotations: parsed.annotations,
            calibrationByPage: calibrationFromPersisted(parsed.calibrationByPage),
            scale: Math.min(
              VIEWER_SCALE_MAX,
              Math.max(VIEWER_SCALE_MIN, parsed.scale ?? useViewerStore.getState().scale),
            ),
            currentPage: Math.min(
              numPages,
              Math.max(1, parsed.currentPage ?? useViewerStore.getState().currentPage),
            ),
            ...(parsed.measureUnit != null ? { measureUnit: parsed.measureUnit } : {}),
            ...(parsed.snapToGeometry != null ? { snapToGeometry: parsed.snapToGeometry } : {}),
            ...(parsed.snapRadiusPx != null ? { snapRadiusPx: parsed.snapRadiusPx } : {}),
            ...(parsed.takeoffItems != null ? { takeoffItems: parsed.takeoffItems } : {}),
            ...(parsed.takeoffZones != null ? { takeoffZones: parsed.takeoffZones } : {}),
            ...(parsed.takeoffPackageStatus != null
              ? { takeoffPackageStatus: parsed.takeoffPackageStatus }
              : {}),
            historyPast: [],
            historyFuture: [],
            selectedAnnotationIds: [],
          });
        } else {
          useViewerStore.setState({
            annotations: [],
            calibrationByPage: {},
            historyPast: [],
            historyFuture: [],
            selectedAnnotationIds: [],
          });
        }
      } catch {
        if (!cancelled) {
          useViewerStore.setState({
            annotations: [],
            calibrationByPage: {},
            historyPast: [],
            historyFuture: [],
            selectedAnnotationIds: [],
          });
        }
      } finally {
        if (!cancelled) setCloudHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, fileName, numPages, cloudFileVersionId]);

  useEffect(() => {
    if (!pdfDoc || numPages < 1) return;
    if (issueIdParam?.trim()) return;
    const cfv = useViewerStore.getState().cloudFileVersionId;
    if (cfv && !cloudHydrated) return;
    if (initialFitWidthAppliedRef.current) return;

    const idx = currentPage - 1;
    const sz = pageSizePtByPage[idx];
    if (!sz?.wPt || !sz?.hPt) return;

    initialFitWidthAppliedRef.current = true;
    requestFit("width");
  }, [pdfDoc, numPages, currentPage, pageSizePtByPage, cloudHydrated, issueIdParam, requestFit]);

  useEffect(() => {
    issueFocusConsumedRef.current = null;
  }, [issueIdParam]);

  /** Deep link: `/viewer?...&issueId=` zooms to linked markup after cloud state hydrates. */
  useEffect(() => {
    const id = issueIdParam?.trim();
    if (!id || !cloudHydrated || !pdfDoc || !cloudFileVersionId) return;
    if (issueFocusConsumedRef.current === id) return;

    let cancelled = false;
    void (async () => {
      try {
        const issue = await fetchIssue(id);
        if (cancelled) return;
        if (issue.fileVersionId !== cloudFileVersionId) {
          toast.error("This issue is for a different sheet version.");
          issueFocusConsumedRef.current = id;
          return;
        }
        if (!issue.annotationId) {
          setPendingProSidebarTab("issues");
          issueFocusConsumedRef.current = id;
          return;
        }
        const deadline = Date.now() + 3000;
        let ann = findAnnotationById(useViewerStore.getState().annotations, issue.annotationId);
        while (!ann && Date.now() < deadline && !cancelled) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          ann = findAnnotationById(useViewerStore.getState().annotations, issue.annotationId);
        }
        if (cancelled) return;
        if (!ann) {
          toast.error("Linked markup is not on this sheet anymore.");
          setPendingProSidebarTab("issues");
          issueFocusConsumedRef.current = id;
          return;
        }
        const rect = normRectFromAnnotationPoints(ann.points);
        useViewerStore.getState().requestSearchFocus({
          pageNumber: ann.pageIndex + 1,
          rectNorm: rect,
          selectAnnotationId: ann.id,
        });
        setPendingProSidebarTab("issues");
        issueFocusConsumedRef.current = id;
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not open issue.");
          issueFocusConsumedRef.current = id;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issueIdParam, cloudHydrated, pdfDoc, cloudFileVersionId, setPendingProSidebarTab]);

  useEffect(() => {
    if (!fileName || numPages < 1) return;
    const cfv = useViewerStore.getState().cloudFileVersionId;
    if (cfv) {
      if (!cloudHydrated) return;
      const t = window.setTimeout(() => {
        void putViewerState(cfv, getViewerStateSyncPayload()).catch(() => {});
      }, 500);
      return () => window.clearTimeout(t);
    }

    const fp = fileFingerprint(fileName, numPages);
    const t = window.setTimeout(() => {
      const s = useViewerStore.getState();
      const payload = getViewerStateSyncPayload();
      savePersistedSession({
        fingerprint: fp,
        currentPage: s.currentPage,
        scale: s.scale,
        annotations: payload.annotations,
        calibrationByPage: payload.calibrationByPage ?? {},
        measureUnit: payload.measureUnit,
        snapToGeometry: payload.snapToGeometry,
        snapRadiusPx: payload.snapRadiusPx,
        takeoffItems: payload.takeoffItems,
        takeoffZones: payload.takeoffZones,
        takeoffPackageStatus: payload.takeoffPackageStatus,
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    annotations,
    calibrationByPage,
    scale,
    currentPage,
    fileName,
    numPages,
    measureUnit,
    snapToGeometry,
    snapRadiusPx,
    cloudFileVersionId,
    cloudHydrated,
    takeoffItems,
    takeoffZones,
    takeoffPackageStatus,
  ]);

  useEffect(() => {
    if (!fitRequest) return;
    const scroll = compareMode ? compareScrollMarkupRef.current : pdfScrollRef.current;
    if (!scroll) return;
    const idx = currentPage - 1;
    const sz = pageSizePtByPage[idx];
    if (!sz?.wPt || !sz?.hPt) return;
    const pad = 36;
    const cw = Math.max(120, scroll.clientWidth - pad);
    const ch = Math.max(120, scroll.clientHeight - pad);
    const sw = cw / sz.wPt;
    const sh = ch / sz.hPt;
    const nextScale = fitRequest.mode === "width" ? sw : Math.min(sw, sh);
    setScale(nextScale);
    clearFitRequest();
  }, [fitRequest, compareMode, currentPage, pageSizePtByPage, setScale, clearFitRequest]);

  /** After search result: zoom to fit match region and scroll it into view. */
  useEffect(() => {
    if (!searchFocusRequest || !pdfDoc) return;
    clearFitRequest();
    const { pageNumber, rectNorm, fitMargin } = searchFocusRequest;
    const idx = pageNumber - 1;

    let cancelled = false;
    let attempts = 0;

    const tryFocus = () => {
      if (cancelled) return;
      const scroll = compareMode ? compareScrollMarkupRef.current : pdfScrollRef.current;
      const pageWrapper = pageWrapperRef.current;
      const sz = pageSizePtByPage[idx];
      if (!scroll || !pageWrapper || !sz?.wPt || !sz?.hPt) {
        attempts++;
        if (attempts < 40) {
          requestAnimationFrame(tryFocus);
        } else {
          clearSearchFocusRequest();
        }
        return;
      }

      const pad = 36;
      const cw = Math.max(120, scroll.clientWidth - pad);
      const ch = Math.max(120, scroll.clientHeight - pad);
      const minW = Math.max(rectNorm.w, 0.04);
      const minH = Math.max(rectNorm.h, 0.04);
      const margin = fitMargin ?? 0.85;
      const nextScale = computeScaleToFitNormRect(minW, minH, cw, ch, sz.wPt, sz.hPt, margin);
      const clamped = Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, nextScale));
      setScale(clamped);

      const cx = rectNorm.x + rectNorm.w / 2;
      const cy = rectNorm.y + rectNorm.h / 2;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          const sc = compareMode ? compareScrollMarkupRef.current : pdfScrollRef.current;
          const pw = pageWrapperRef.current;
          if (!sc || !pw) {
            clearSearchFocusRequest();
            return;
          }
          scrollViewportToNorm(sc, pw, cx, cy);
          const pickId = useViewerStore.getState().searchFocusRequest?.selectAnnotationId;
          clearSearchFocusRequest();
          if (pickId) {
            useViewerStore.setState({
              selectedAnnotationIds: [pickId],
              tool: "select",
            });
          }
        });
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(tryFocus);
    });
    return () => {
      cancelled = true;
    };
  }, [
    searchFocusRequest,
    pdfDoc,
    compareMode,
    pageSizePtByPage,
    setScale,
    clearFitRequest,
    clearSearchFocusRequest,
  ]);

  /** Keep compare panes scrolled together (same PDF region). */
  useEffect(() => {
    if (!compareMode) return;
    const left = compareScrollOriginalRef.current;
    const right = compareScrollMarkupRef.current;
    if (!left || !right) return;

    const maybeSync = (from: HTMLElement, to: HTMLElement) => {
      if (
        Math.abs(to.scrollTop - from.scrollTop) < 0.5 &&
        Math.abs(to.scrollLeft - from.scrollLeft) < 0.5
      ) {
        return;
      }
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
    };

    const onLeft = () => maybeSync(left, right);
    const onRight = () => maybeSync(right, left);
    left.addEventListener("scroll", onLeft, { passive: true });
    right.addEventListener("scroll", onRight, { passive: true });
    return () => {
      left.removeEventListener("scroll", onLeft);
      right.removeEventListener("scroll", onRight);
    };
  }, [compareMode, pdfDoc, currentPage]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const st = useViewerStore.getState();
      const easyWheelZoom =
        st.tool === "measure" ||
        st.tool === "calibrate" ||
        st.tool === "zoomArea" ||
        st.tool === "takeoff";
      const ctrlOrPinch = e.ctrlKey || e.metaKey;
      if (!easyWheelZoom && !ctrlOrPinch) return;

      e.preventDefault();

      const delta = e.deltaY;
      const factor = delta > 0 ? 0.96 : delta < 0 ? 1.04 : 1;
      if (factor === 1) return;

      const oldScale = st.scale;
      const newScale = Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, oldScale * factor));
      if (Math.abs(newScale - oldScale) < 1e-9) return;

      const ratio = newScale / oldScale;
      const el = e.currentTarget as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;

      st.setScale(newScale);

      requestAnimationFrame(() => {
        const syncPair = (sc: HTMLDivElement) => {
          const nextLeft = sc.scrollLeft * ratio + relativeX * (ratio - 1);
          const nextTop = sc.scrollTop * ratio + relativeY * (ratio - 1);
          const maxL = Math.max(0, sc.scrollWidth - sc.clientWidth);
          const maxT = Math.max(0, sc.scrollHeight - sc.clientHeight);
          sc.scrollLeft = Math.min(maxL, Math.max(0, nextLeft));
          sc.scrollTop = Math.min(maxT, Math.max(0, nextTop));
        };

        if (compareMode) {
          const o1 = compareScrollOriginalRef.current;
          const o2 = compareScrollMarkupRef.current;
          if (o1) syncPair(o1);
          if (o2) syncPair(o2);
        } else {
          const sc = pdfScrollRef.current;
          if (!sc) return;
          syncPair(sc);
        }
      });
    };

    if (compareMode) {
      const o1 = compareScrollOriginalRef.current;
      const o2 = compareScrollMarkupRef.current;
      o1?.addEventListener("wheel", onWheel, { passive: false });
      o2?.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        o1?.removeEventListener("wheel", onWheel);
        o2?.removeEventListener("wheel", onWheel);
      };
    }

    const el = pdfScrollRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdfDoc, compareMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) useViewerStore.getState().redo();
        else useViewerStore.getState().undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ViewerCanvasContext.Provider value={{ pageCanvasRef }}>
      <div className="viewer-shell-bg relative grid min-h-0 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] gap-x-px gap-y-0 overflow-hidden bg-[var(--viewer-border)]">
        <CollaborationSync roomId={roomId} />
        <div className="col-span-3 row-start-1 min-h-0 min-w-0 self-start overflow-visible bg-[var(--viewer-chrome-top)]">
          <ViewerTopBar pdfDoc={pdfDoc} exportCanvasRef={pageCanvasRef} />
        </div>
        <div className="col-start-1 row-start-2 row-end-3 min-h-0 min-w-0 self-stretch overflow-hidden bg-[var(--viewer-chrome-bottom)]">
          <ViewerSidebar />
        </div>
        <div className="viewer-canvas-area relative col-start-2 row-start-2 row-end-3 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--viewer-canvas)] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] print:overflow-visible md:shadow-[inset_0_0_0_1px_rgba(51,65,85,0.08)]">
          {newIssuePlacementActive ? (
            <div
              className="no-print pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
              role="status"
              aria-live="polite"
            >
              <div className="max-w-[min(100%,36rem)] rounded-lg border border-sky-500/45 bg-sky-950/92 px-3 py-2 text-center text-[11px] font-medium leading-snug text-sky-50 shadow-lg ring-1 ring-sky-500/25 backdrop-blur-sm">
                <span className="text-sky-200/90">Click the plan to place a new issue pin —</span>{" "}
                <span className="text-white">then fill in title, dates, and assignee</span>
                <span className="text-sky-200/80"> · Esc to cancel</span>
              </div>
            </div>
          ) : issuePlacementBanner ? (
            <div
              className="no-print pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
              role="status"
              aria-live="polite"
            >
              <div className="max-w-[min(100%,36rem)] rounded-lg border border-amber-500/50 bg-amber-950/92 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-50 shadow-lg ring-1 ring-amber-500/25 backdrop-blur-sm">
                <span className="text-amber-200/90">Drop pin on the drawing —</span>{" "}
                <span className="text-white">{issuePlacementBanner.title}</span>
                <span className="text-amber-200/80"> · Esc to cancel</span>
              </div>
            </div>
          ) : takeoffRedrawZoneId ? (
            <div
              className="no-print pointer-events-auto absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
              role="status"
            >
              <div className="max-w-[min(100%,36rem)] rounded-lg border border-violet-500/45 bg-violet-950/92 px-3 py-2 text-center text-[11px] font-medium leading-snug text-violet-50 shadow-lg ring-1 ring-violet-500/25 backdrop-blur-sm">
                <span className="text-violet-200/90">Redraw takeoff zone</span> —{" "}
                {takeoffRedrawZoneKind === "count" ? (
                  <>
                    place count marks with the takeoff tool, then in the sidebar choose{" "}
                    <span className="text-white">Add to zone</span> or{" "}
                    <span className="text-white">Replace all</span>.{" "}
                  </>
                ) : (
                  <>draw the new shape with the takeoff tool. </>
                )}
                <button
                  type="button"
                  className="pointer-events-auto font-semibold text-white underline decoration-violet-300/70 underline-offset-2 hover:text-violet-100"
                  onClick={() => setTakeoffRedrawZoneId(null)}
                >
                  Cancel
                </button>
                <span className="text-violet-200/75"> · Esc</span>
              </div>
            </div>
          ) : takeoffMoveZoneId ? (
            <div
              className="no-print pointer-events-auto absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
              role="status"
            >
              <div className="max-w-[min(100%,36rem)] rounded-lg border border-cyan-500/45 bg-cyan-950/92 px-3 py-2 text-center text-[11px] font-medium leading-snug text-cyan-50 shadow-lg ring-1 ring-cyan-500/25 backdrop-blur-sm">
                <span className="text-cyan-200/90">Move zone</span> — drag the highlighted shape.{" "}
                <button
                  type="button"
                  className="pointer-events-auto font-semibold text-white underline decoration-cyan-300/70 underline-offset-2 hover:text-cyan-100"
                  onClick={() => setTakeoffMoveZoneId(null)}
                >
                  Cancel
                </button>
                <span className="text-cyan-200/75"> · Esc</span>
              </div>
            </div>
          ) : takeoffVertexEditZoneId ? (
            <div
              className="no-print pointer-events-auto absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
              role="status"
            >
              <div className="max-w-[min(100%,36rem)] rounded-lg border border-teal-500/45 bg-teal-950/92 px-3 py-2 text-center text-[11px] font-medium leading-snug text-teal-50 shadow-lg ring-1 ring-teal-500/25 backdrop-blur-sm">
                <span className="text-teal-200/90">Edit corners</span> — drag white handles on
                vertices.{" "}
                <button
                  type="button"
                  className="pointer-events-auto font-semibold text-white underline decoration-teal-300/70 underline-offset-2 hover:text-teal-100"
                  onClick={() => setTakeoffVertexEditZoneId(null)}
                >
                  Cancel
                </button>
                <span className="text-teal-200/75"> · Esc</span>
              </div>
            </div>
          ) : tool === "takeoff" && cloudFileVersionId && viewerProjectId ? (
            <div
              className="no-print pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
              role="status"
              aria-live="polite"
            >
              <div className="max-w-[min(100%,36rem)] rounded-lg border border-sky-500/45 bg-sky-950/92 px-3 py-2 text-center text-[11px] font-medium leading-snug text-sky-50 shadow-lg ring-1 ring-sky-500/25 backdrop-blur-sm">
                <span className="text-sky-200/90">Drawing takeoff</span> —{" "}
                <span className="text-white">
                  {takeoffDrawKind === "area"
                    ? "Area"
                    : takeoffDrawKind === "linear"
                      ? "Linear"
                      : "Count"}{" "}
                  mode
                </span>
                <span className="text-sky-200/85">
                  {" "}
                  · Click the sheet to place geometry · Inventory below
                </span>
                <span className="text-sky-200/75"> · Esc cancels some modes</span>
              </div>
            </div>
          ) : null}
          {issueCreateDraft ? (
            <IssueFormSlider
              variant="create"
              open
              annotationId={issueCreateDraft.annotationId}
              onClose={onIssueCreateDialogClose}
            />
          ) : null}
          {takeoffSliderOpen ? <TakeoffFormSlider /> : null}
          <TakeoffSummaryModal />
          {pdfLoading && (
            <div
              className="viewer-loading-canvas no-print absolute inset-0 z-40 flex flex-col items-center justify-center p-6"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="relative w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-[var(--viewer-border-strong)] bg-[var(--viewer-panel)]/98 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] ring-1 ring-[var(--viewer-primary)]/25 backdrop-blur-md">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--viewer-primary)]/70 to-transparent"
                  aria-hidden
                />
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-2xl border border-[var(--viewer-border-strong)] bg-[color-mix(in_srgb,var(--viewer-input-bg)_90%,transparent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                      aria-hidden
                    />
                    <div
                      className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.12),transparent_65%)]"
                      aria-hidden
                    />
                    <Loader2
                      className="relative h-8 w-8 animate-spin text-[var(--viewer-primary)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="sr-only">Loading PDF</span>
                  </div>
                  <div className="w-full space-y-1">
                    <p className="text-[15px] font-semibold tracking-tight text-[var(--viewer-text)]">
                      Opening your plan
                    </p>
                    {fileName ? (
                      <p className="text-[11px] leading-snug text-[var(--viewer-text-muted)] line-clamp-2 break-all">
                        {fileName}
                      </p>
                    ) : null}
                    <p className="pt-1 text-[10px] leading-relaxed text-[var(--viewer-text-muted)]">
                      Parsing pages and preparing the canvas…
                    </p>
                  </div>
                  <div className="w-full overflow-hidden rounded-full bg-slate-800/80 py-px">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-700/60">
                      <div className="viewer-pdf-load-indeterminate h-full w-[42%] rounded-full bg-gradient-to-r from-[var(--viewer-primary)] to-[#60a5fa]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {!pdfUrl && (
            <div className="viewer-loading-canvas flex min-h-0 flex-1 cursor-crosshair flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--viewer-border-strong)] bg-[color-mix(in_srgb,var(--viewer-input-bg)_92%,transparent)] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)] ring-1 ring-[var(--viewer-primary)]/15">
                <LayoutTemplate
                  className="h-9 w-9 text-[var(--viewer-text-muted)]"
                  strokeWidth={1.25}
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-[var(--viewer-text)]">
                  Open a PDF plan to get started
                </p>
                {proBlocksLocalPdf ? (
                  <p className="mt-2 max-w-sm text-[12px] leading-relaxed tracking-tight text-[var(--viewer-text-muted)]">
                    Pro opens drawings from the cloud. Use{" "}
                    <span className="font-medium text-[var(--viewer-text)]">Projects</span> in the
                    toolbar to pick a file. Markup tools appear after the plan loads.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed tracking-tight text-[var(--viewer-text-muted)]">
                      Your PDF stays on this device. Choose a file below or use{" "}
                      <span className="font-medium text-[var(--viewer-text)]">Open</span> in the
                      toolbar — then calibrate scale and measure.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(
                          VIEWER_LOCAL_PDF_INPUT_ID,
                        ) as HTMLInputElement | null;
                        el?.click();
                      }}
                      className="viewer-focus-ring mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--viewer-primary)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[var(--viewer-primary-glow)] transition hover:bg-[var(--viewer-primary-hover)] active:scale-[0.98]"
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      Choose PDF…
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {loadError && (
            <div className="max-h-40 overflow-y-auto border-b border-red-900/40 bg-red-950/30 p-4 text-center text-sm text-red-200">
              {loadError}
            </div>
          )}
          {pdfDoc && pdfUrl && (
            <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
              <ViewerOnboarding />
              {compareMode ? (
                <>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-slate-600/45 md:flex-row md:divide-x md:divide-y-0 print:hidden">
                    <div
                      ref={compareScrollOriginalRef}
                      className="viewer-compare-pane min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
                    >
                      <div className="mx-auto max-w-[min(100%,960px)] p-4 sm:p-5">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Original (reference)
                        </p>
                        <PdfPageView
                          pdfDoc={pdfDoc}
                          pageNumber={currentPage}
                          compareReferenceOnly
                          scrollContainerRef={compareScrollOriginalRef}
                          pageCanvasRef={pageCanvasCompareRef}
                          pageWrapperRef={pageWrapperCompareRef}
                        />
                      </div>
                    </div>
                    <div
                      ref={compareScrollMarkupRef}
                      className="viewer-compare-pane min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
                    >
                      <div className="mx-auto max-w-[min(100%,960px)] p-4 sm:p-5">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          With markups
                        </p>
                        <PdfPageView
                          pdfDoc={pdfDoc}
                          pageNumber={currentPage}
                          scrollContainerRef={compareScrollMarkupRef}
                          pageCanvasRef={pageCanvasRef}
                          pageWrapperRef={pageWrapperRef}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Same floating position as single-view minimap (bottom-right of canvas, by the right drawer). */}
                  <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex max-w-[calc(100%-1rem)] flex-col items-end gap-2 sm:max-w-none sm:flex-row sm:items-end sm:gap-3 print:hidden">
                    <div className="pointer-events-auto">
                      <PdfPageMinimap
                        scrollRef={compareScrollMarkupRef}
                        viewportScrollRef={compareScrollOriginalRef}
                        sourceCanvasRef={pageCanvasRef}
                        pageWrapperRef={pageWrapperRef}
                        compareCanvasRef={pageCanvasCompareRef}
                        comparePageWrapperRef={pageWrapperCompareRef}
                        scale={scale}
                        pageNumber={currentPage}
                        comparePane="original"
                        sharedFocusRef={compareMinimapFocusRef}
                      />
                    </div>
                    <div className="pointer-events-auto">
                      <PdfPageMinimap
                        scrollRef={compareScrollMarkupRef}
                        sourceCanvasRef={pageCanvasRef}
                        pageWrapperRef={pageWrapperRef}
                        compareCanvasRef={pageCanvasCompareRef}
                        comparePageWrapperRef={pageWrapperCompareRef}
                        scale={scale}
                        pageNumber={currentPage}
                        comparePane="markup"
                        sharedFocusRef={compareMinimapFocusRef}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    ref={pdfScrollRef}
                    className="min-h-0 flex-1 overflow-auto overscroll-contain print:block print:overflow-visible"
                  >
                    <div className="mx-auto max-w-[min(100%,1920px)] px-4 py-5 sm:px-6 sm:py-6 print:p-0 print:max-w-none">
                      <PdfPageView
                        pdfDoc={pdfDoc}
                        pageNumber={currentPage}
                        scrollContainerRef={pdfScrollRef}
                        pageCanvasRef={pageCanvasRef}
                        pageWrapperRef={pageWrapperRef}
                      />
                    </div>
                  </div>
                  <PdfPageMinimap
                    scrollRef={pdfScrollRef}
                    sourceCanvasRef={pageCanvasRef}
                    pageWrapperRef={pageWrapperRef}
                    compareCanvasRef={pageCanvasCompareRef}
                    comparePageWrapperRef={pageWrapperCompareRef}
                    scale={scale}
                    pageNumber={currentPage}
                  />
                </>
              )}
            </div>
          )}
          {/* Drawer z-[25]: must stay below TakeoffFormSlider (z-[85]) and modals (z-[90]). */}
          {cloudFileVersionId &&
          viewerProjectId &&
          (takeoffInventoryDrawerFromSidebar || sheetAiDrawerFromSidebar) ? (
            <div className="no-print pointer-events-none absolute inset-x-0 bottom-0 z-[25] flex flex-col-reverse items-stretch gap-px px-1 pb-0 sm:px-2">
              {takeoffInventoryDrawerFromSidebar ? <TakeoffInventoryDrawer embedded /> : null}
              {sheetAiDrawerFromSidebar ? (
                <SheetAiDrawer key={cloudFileVersionId ?? "sheet-ai"} />
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="col-start-3 row-start-2 row-end-3 min-h-0 min-w-0 self-stretch overflow-hidden bg-[var(--viewer-chrome-bottom)] print:hidden">
          <ViewerRightPanel />
        </div>
      </div>
    </ViewerCanvasContext.Provider>
  );
}
