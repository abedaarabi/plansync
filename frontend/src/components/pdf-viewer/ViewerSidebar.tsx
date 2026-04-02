"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Circle,
  Cloud,
  Diamond,
  ListChecks,
  MessageSquare,
  Minus,
  Package,
  Paintbrush,
  Pencil,
  PenTool,
  Pentagon,
  Ruler,
  Route,
  Scaling,
  Square,
  Trash2,
  PanelLeft,
  ListTree,
  Triangle,
  Type,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useViewerProSheetFeatures } from "@/hooks/useViewerProSheetFeatures";
import { MARKUP_STROKE_COLOR_PRESETS } from "@/lib/markupUi";
import { useViewerStore } from "@/store/viewerStore";
import {
  annotationIsIssuePin,
  filterAnnotationIdsExcludingIssuePins,
} from "@/lib/annotationIssues";
import type { MeasureUnit } from "@/lib/coords";
import type { Annotation, AnnotationType, MarkupShape, MeasureKind } from "@/store/viewerStore";
import { SidebarOutlineTab } from "./SidebarOutlineTab";
import { SidebarPagesTab } from "./SidebarPagesTab";
import { TextCommentDialog } from "./TextCommentDialog";
import { CalibrationGuide, CalibrateTargetRow } from "./CalibrationGuide";
import { AnnotationListContextMenu } from "./AnnotationListContextMenu";
import { SidebarIssuesTab } from "./sidebar/SidebarIssuesTab";
import { SidebarTakeoffTab } from "./sidebar/SidebarTakeoffTab";

const markupShapes: {
  id: MarkupShape;
  label: string;
  hint: string;
  icon: typeof PenTool;
}[] = [
  { id: "freehand", label: "Pen", hint: "Freehand stroke", icon: PenTool },
  { id: "highlight", label: "Hi", hint: "Semi-transparent highlighter stroke", icon: Paintbrush },
  { id: "line", label: "Line", hint: "Two-click straight line", icon: Minus },
  { id: "arrow", label: "Arrow", hint: "Line with arrowhead", icon: ArrowRight },
  { id: "rect", label: "Rect", hint: "Drag to draw rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", hint: "Drag bounding box for ellipse", icon: Circle },
  { id: "cross", label: "X", hint: "Diagonal cross in a box", icon: X },
  { id: "diamond", label: "Diamond", hint: "Diamond inside drag box", icon: Diamond },
  {
    id: "polygon",
    label: "Poly",
    hint: "Click corners — Enter or click first point to close",
    icon: Pentagon,
  },
  { id: "cloud", label: "Cloud", hint: "Revision cloud — drag a box", icon: Cloud },
  { id: "text", label: "Text", hint: "Click to place a comment", icon: MessageSquare },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="viewer-section-title">{children}</h3>;
}

/** Same filled blue active state as viewer-toolbar-btn-active (top bar icons). */
function sidebarPanelTabClass(selected: boolean): string {
  return `viewer-focus-ring flex flex-col items-center gap-0.5 rounded-md border px-0.5 pb-2 pt-2 text-[8px] font-semibold uppercase tracking-[0.08em] transition duration-150 ${
    selected
      ? "border-[rgba(37,99,235,0.55)] bg-[#2563EB] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
      : "border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:border-[#475569] hover:bg-[#334155] hover:text-[#F8FAFC]"
  }`;
}

function formatAnnotationCreatedTooltip(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function measurementKindIcon(mk?: MeasureKind): LucideIcon {
  switch (mk) {
    case "area":
      return Square;
    case "angle":
      return Triangle;
    case "perimeter":
      return Route;
    case "line":
    default:
      return Minus;
  }
}

function markupAnnotationIcon(a: Annotation): LucideIcon {
  const t = a.type;
  switch (t) {
    case "polyline":
      return PenTool;
    case "highlight":
      return Paintbrush;
    case "line":
      return a.arrowHead ? ArrowRight : Minus;
    case "rect":
      return Square;
    case "ellipse":
      return Circle;
    case "cross":
      return X;
    case "diamond":
      return Diamond;
    case "polygon":
      return Pentagon;
    case "cloud":
      return Cloud;
    case "text":
      return MessageSquare;
    default:
      return Pencil;
  }
}

function annotationKindLabel(t: AnnotationType, measurementKind?: MeasureKind): string {
  switch (t) {
    case "polyline":
      return "Pen";
    case "highlight":
      return "Highlight";
    case "line":
      return "Line";
    case "rect":
      return "Rectangle";
    case "ellipse":
      return "Ellipse";
    case "cross":
      return "Cross";
    case "diamond":
      return "Diamond";
    case "polygon":
      return "Polygon";
    case "cloud":
      return "Cloud";
    case "text":
      return "Text";
    case "measurement":
      switch (measurementKind) {
        case "area":
          return "Area";
        case "angle":
          return "Angle";
        case "perimeter":
          return "Path";
        case "line":
        default:
          return "Measure";
      }
    default:
      return t;
  }
}

const measureKindOptions: {
  id: MeasureKind;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    id: "line",
    label: "Line",
    hint: "Drag start/end or the segment to reposition; then offset the dimension line — click or Enter to place",
    icon: Minus,
  },
  {
    id: "area",
    label: "Area",
    hint: "Corners in order — Enter or click first point to close",
    icon: Square,
  },
  {
    id: "angle",
    label: "Angle",
    hint: "Vertex, point on first ray, point on second ray",
    icon: Triangle,
  },
  {
    id: "perimeter",
    label: "Path",
    hint: "Each click adds a vertex — Enter to finish",
    icon: Route,
  },
];

export function ViewerSidebar() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const tool = useViewerStore((s) => s.tool);
  const currentPage = useViewerStore((s) => s.currentPage);
  const strokeColor = useViewerStore((s) => s.strokeColor);
  const setStrokeColor = useViewerStore((s) => s.setStrokeColor);
  const strokeWidth = useViewerStore((s) => s.strokeWidth);
  const markupShape = useViewerStore((s) => s.markupShape);
  const annotations = useViewerStore((s) => s.annotations);
  const selectedAnnotationIds = useViewerStore((s) => s.selectedAnnotationIds);
  const setSelectedAnnotationId = useViewerStore((s) => s.setSelectedAnnotationId);
  const setSelectedAnnotationIds = useViewerStore((s) => s.setSelectedAnnotationIds);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);

  const setTool = useViewerStore((s) => s.setTool);
  const updateAnnotation = useViewerStore((s) => s.updateAnnotation);
  const removeAnnotation = useViewerStore((s) => s.removeAnnotation);
  const removeAnnotations = useViewerStore((s) => s.removeAnnotations);
  const copyAnnotationsToClipboard = useViewerStore((s) => s.copyAnnotationsToClipboard);
  const duplicateAnnotationsOnPage = useViewerStore((s) => s.duplicateAnnotationsOnPage);

  const [editTextOpen, setEditTextOpen] = useState(false);
  const [listMenu, setListMenu] = useState<{
    clientX: number;
    clientY: number;
    id: string;
  } | null>(null);
  const [sidebarTab, setSidebarTab] = useState<
    "draw" | "measure" | "pages" | "outline" | "issues" | "takeoff"
  >("draw");
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const pendingProSidebarTab = useViewerStore((s) => s.pendingProSidebarTab);
  const setPendingProSidebarTab = useViewerStore((s) => s.setPendingProSidebarTab);
  const takeoffMode = useViewerStore((s) => s.takeoffMode);
  const setTakeoffMode = useViewerStore((s) => s.setTakeoffMode);
  const setTakeoffInventoryDrawerFromSidebar = useViewerStore(
    (s) => s.setTakeoffInventoryDrawerFromSidebar,
  );
  const { enabled: proSheetFeatures } = useViewerProSheetFeatures();
  const showProTabs = Boolean(pdfUrl && proSheetFeatures && viewerProjectId);

  const pageIdx0 = currentPage - 1;
  const selectedOnPageIds = useMemo(
    () =>
      selectedAnnotationIds.filter((id) =>
        annotations.some((a) => a.id === id && a.pageIndex === pageIdx0),
      ),
    [selectedAnnotationIds, annotations, pageIdx0],
  );

  const selectedAnn = useMemo((): Annotation | undefined => {
    if (selectedOnPageIds.length !== 1) return undefined;
    return annotations.find((a) => a.id === selectedOnPageIds[0] && a.pageIndex === pageIdx0);
  }, [annotations, selectedOnPageIds, pageIdx0]);

  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.createdAt - b.createdAt;
    });
  }, [annotations]);

  const measureAnnotations = useMemo(
    () => sortedAnnotations.filter((a) => a.type === "measurement"),
    [sortedAnnotations],
  );

  const markupAnnotations = useMemo(
    () =>
      sortedAnnotations.filter(
        (a) => a.type !== "measurement" && !a.linkedIssueId && !a.issueDraft,
      ),
    [sortedAnnotations],
  );

  useEffect(() => {
    const valid = selectedAnnotationIds.filter((id) => annotations.some((a) => a.id === id));
    if (valid.length !== selectedAnnotationIds.length) {
      setSelectedAnnotationIds(valid);
    }
  }, [annotations, selectedAnnotationIds, setSelectedAnnotationIds]);

  useEffect(() => {
    if (tool !== "select") setEditTextOpen(false);
  }, [tool]);

  useEffect(() => {
    if (!selectedAnn) setEditTextOpen(false);
  }, [selectedAnn]);

  /** Next markup uses the selected shape's color (mirrors takeoff pen ↔ inventory row). */
  useEffect(() => {
    if (tool !== "select") return;
    if (!selectedAnn) return;
    if (selectedAnn.type === "measurement" || annotationIsIssuePin(selectedAnn)) return;
    setStrokeColor(selectedAnn.color);
  }, [tool, selectedAnn, selectedAnn?.id, selectedAnn?.color, setStrokeColor]);

  /** Keep sidebar tab aligned with what you selected on the sheet (when on Draw or Measure panels). */
  useEffect(() => {
    if (!selectedAnn) return;
    setSidebarTab((t) => {
      if (t === "pages" || t === "outline") return t;
      if (annotationIsIssuePin(selectedAnn)) return "issues";
      if (t === "takeoff") return t;
      return selectedAnn.type === "measurement" ? "measure" : "draw";
    });
  }, [
    selectedAnn,
    selectedAnn?.id,
    selectedAnn?.type,
    selectedAnn?.linkedIssueId,
    selectedAnn?.issueDraft,
  ]);

  /** Ruler / calibrate live under the Measure panel. */
  useEffect(() => {
    if (tool !== "measure" && tool !== "calibrate") return;
    setSidebarTab((t) =>
      t === "pages" || t === "outline" || t === "issues" || t === "takeoff" ? t : "measure",
    );
  }, [tool]);

  useEffect(() => {
    if (!pendingProSidebarTab || !showProTabs) return;
    setSidebarTab(pendingProSidebarTab);
    setPendingProSidebarTab(null);
  }, [pendingProSidebarTab, showProTabs, setPendingProSidebarTab]);

  useEffect(() => {
    if (showProTabs) return;
    if (sidebarTab === "takeoff") setSidebarTab("draw");
    if (takeoffMode) setTakeoffMode(false);
  }, [showProTabs, sidebarTab, takeoffMode, setTakeoffMode]);

  useEffect(() => {
    if (takeoffMode) setSidebarTab("takeoff");
  }, [takeoffMode]);

  useEffect(() => {
    if (sidebarTab !== "takeoff" && takeoffMode) setTakeoffMode(false);
  }, [sidebarTab, takeoffMode, setTakeoffMode]);

  useEffect(() => {
    if (sidebarTab !== "takeoff") setTakeoffInventoryDrawerFromSidebar(false);
  }, [sidebarTab, setTakeoffInventoryDrawerFromSidebar]);

  const setStrokeWidth = useViewerStore((s) => s.setStrokeWidth);
  const textBoxFillFromFrame = useViewerStore((s) => s.textBoxFillFromFrame);
  const setTextBoxFillFromFrame = useViewerStore((s) => s.setTextBoxFillFromFrame);
  const setMarkupShape = useViewerStore((s) => s.setMarkupShape);
  const measureKind = useViewerStore((s) => s.measureKind);
  const setMeasureKind = useViewerStore((s) => s.setMeasureKind);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const setMeasureUnit = useViewerStore((s) => s.setMeasureUnit);
  const measureLabelFontSize = useViewerStore((s) => s.measureLabelFontSize);
  const measureLabelColor = useViewerStore((s) => s.measureLabelColor);
  const setMeasureLabelFontSize = useViewerStore((s) => s.setMeasureLabelFontSize);
  const setMeasureLabelColor = useViewerStore((s) => s.setMeasureLabelColor);
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const clearCalibration = useViewerStore((s) => s.clearCalibration);

  const pageCal = calibrationByPage[pageIdx0];

  const listMenuAnnotation = useMemo(() => {
    if (!listMenu) return undefined;
    return annotations.find((x) => x.id === listMenu.id);
  }, [listMenu, annotations]);

  return (
    <aside
      className={`no-print flex h-full shrink-0 flex-col border-r border-[#334155] bg-[#0F172A] text-[#F8FAFC] shadow-none transition-[width] duration-150 ${
        pdfUrl ? "w-[260px] max-w-[260px]" : "w-[168px] sm:w-[180px]"
      }`}
      aria-label="Markup tools and pages"
    >
      {pdfUrl && (
        <div className="border-b border-[#334155] px-2 pb-2 pt-2">
          <div className="p-0.5" role="tablist" aria-label="Sidebar panels">
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "draw"}
                onClick={() => {
                  setSidebarTab("draw");
                  setTool("annotate");
                }}
                title="Draw markups — list shows markups only"
                className={sidebarPanelTabClass(sidebarTab === "draw")}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                Draw
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "measure"}
                onClick={() => {
                  setSidebarTab("measure");
                  setTool("select");
                }}
                title="Measure & scale — list shows measures only"
                className={sidebarPanelTabClass(sidebarTab === "measure")}
              >
                <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
                Measure
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "pages"}
                onClick={() => setSidebarTab("pages")}
                title="Page thumbnails — jump to a page"
                className={sidebarPanelTabClass(sidebarTab === "pages")}
              >
                <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                Pages
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "outline"}
                onClick={() => setSidebarTab("outline")}
                title="Table of contents — PDF bookmarks"
                className={sidebarPanelTabClass(sidebarTab === "outline")}
              >
                <ListTree className="h-3.5 w-3.5" strokeWidth={1.75} />
                TOC
              </button>
            </div>
            {pdfUrl ? (
              <div className={`mt-1 grid gap-1 ${showProTabs ? "grid-cols-2" : "grid-cols-1"}`}>
                {showProTabs ? (
                  <>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sidebarTab === "issues"}
                      onClick={() => setSidebarTab("issues")}
                      title="Issues for this sheet"
                      className={sidebarPanelTabClass(sidebarTab === "issues")}
                    >
                      <ListChecks className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Issues
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sidebarTab === "takeoff"}
                      onClick={() => {
                        setSidebarTab("takeoff");
                        setTakeoffMode(true);
                        setTakeoffInventoryDrawerFromSidebar(true);
                      }}
                      title="Quantity takeoff"
                      className={sidebarPanelTabClass(sidebarTab === "takeoff")}
                    >
                      <Package className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Takeoff
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
        {!pdfUrl && (
          <p className="px-1.5 text-center text-[11px] leading-relaxed text-[#94A3B8]">
            Open a PDF from the top bar, then tap <strong className="text-[#F8FAFC]">Draw</strong>{" "}
            here.
          </p>
        )}

        {pdfUrl && sidebarTab === "pages" && <SidebarPagesTab />}
        {pdfUrl && sidebarTab === "outline" && <SidebarOutlineTab />}
        {pdfUrl && sidebarTab === "issues" && showProTabs && <SidebarIssuesTab />}
        {pdfUrl && sidebarTab === "takeoff" && showProTabs && <SidebarTakeoffTab />}

        {pdfUrl && sidebarTab === "draw" && (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
            <SectionTitle>Stroke color</SectionTitle>
            <div className="mb-2 shrink-0 rounded-lg border border-[#334155] bg-[#1e293b]/80 p-2">
              <p className="mb-2 text-[9px] leading-snug text-[#64748b]">
                Used for new markups while drawing. Selecting an existing shape updates this to
                match its color.
              </p>
              <div className="flex flex-wrap gap-2">
                {MARKUP_STROKE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={`h-7 w-7 rounded-full border-2 ${
                      strokeColor === c
                        ? "border-white ring-2 ring-sky-500/50"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setStrokeColor(c)}
                  />
                ))}
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-[#475569] bg-transparent"
                />
              </div>
            </div>

            {tool === "select" && selectedOnPageIds.length > 1 && (
              <>
                <SectionTitle>Selection</SectionTitle>
                <div className="mb-2 space-y-2 rounded-lg border border-slate-700/80 bg-slate-900/55 p-1.5 ring-1 ring-white/[0.06]">
                  <p className="text-[9px] font-medium text-slate-200">
                    {selectedOnPageIds.length} items on this page
                  </p>
                  <p className="text-[8px] leading-snug text-slate-500">
                    ⌘ or Ctrl+click to toggle. Shift+click to add. Drag a box on empty space to
                    select.
                  </p>
                  <button
                    type="button"
                    disabled={
                      filterAnnotationIdsExcludingIssuePins(annotations, selectedOnPageIds)
                        .length === 0
                    }
                    title={
                      filterAnnotationIdsExcludingIssuePins(annotations, selectedOnPageIds)
                        .length === 0
                        ? "Selection is only issue markers — delete those from the Issues tab"
                        : undefined
                    }
                    onClick={() => {
                      const ids = filterAnnotationIdsExcludingIssuePins(
                        annotations,
                        selectedOnPageIds,
                      );
                      if (ids.length > 0) removeAnnotations(ids);
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-[10px] font-medium text-red-200 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2} />
                    Delete all selected
                  </button>
                </div>
              </>
            )}
            {tool === "select" &&
              selectedOnPageIds.length === 1 &&
              selectedAnn &&
              annotationIsIssuePin(selectedAnn) && (
                <div className="mb-2 rounded-lg border border-sky-800/50 bg-slate-900/60 p-2 ring-1 ring-sky-900/30">
                  <p className="text-[9px] leading-snug text-slate-400">
                    This is an <strong className="font-medium text-slate-300">issue</strong> marker.
                    To remove it, open the <strong className="text-slate-300">Issues</strong> tab
                    and use <strong className="text-slate-300">Delete</strong> on the issue — not
                    markup delete.
                  </p>
                </div>
              )}
            {tool === "select" &&
              selectedOnPageIds.length === 1 &&
              selectedAnn &&
              selectedAnn.type !== "measurement" &&
              !annotationIsIssuePin(selectedAnn) && (
                <>
                  <SectionTitle>Selection</SectionTitle>
                  <div className="mb-2 space-y-2 rounded-lg border border-blue-900/45 bg-[var(--viewer-surface-elevated)] p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-blue-800/45">
                    <p className="text-[9px] font-medium text-blue-200/90">
                      {annotationKindLabel(selectedAnn.type, selectedAnn.measurementKind)}
                    </p>
                    <label className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                      <span>{selectedAnn.type === "text" ? "Frame color" : "Color"}</span>
                      <input
                        type="color"
                        value={selectedAnn.color}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { color: e.target.value })
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
                      />
                    </label>
                    {selectedAnn.type === "text" && (
                      <>
                        <label className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                          <span>Text color</span>
                          <input
                            type="color"
                            value={selectedAnn.textColor ?? "#0f172a"}
                            onChange={(e) =>
                              updateAnnotation(selectedAnn.id, { textColor: e.target.value })
                            }
                            className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
                          />
                        </label>
                        <label className="block text-[10px] text-slate-400">
                          <span className="mb-0.5 flex items-center justify-between">
                            <span>Font size</span>
                            <span className="tabular-nums text-slate-500">
                              {selectedAnn.fontSize ?? 12}px
                            </span>
                          </span>
                          <input
                            type="range"
                            min={8}
                            max={48}
                            value={selectedAnn.fontSize ?? 12}
                            onChange={(e) =>
                              updateAnnotation(selectedAnn.id, { fontSize: Number(e.target.value) })
                            }
                            className="w-full accent-[var(--viewer-primary)]"
                          />
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-400">
                          <input
                            type="checkbox"
                            className="rounded border-slate-600"
                            checked={!!selectedAnn.textBoxFillFromFrame}
                            onChange={(e) =>
                              updateAnnotation(selectedAnn.id, {
                                textBoxFillFromFrame: e.target.checked,
                              })
                            }
                          />
                          Tint box with frame color
                        </label>
                      </>
                    )}
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-0.5 block">
                        {selectedAnn.type === "text" ? "Frame width" : "Width"}
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        value={selectedAnn.strokeWidth}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { strokeWidth: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--viewer-primary)]"
                      />
                    </label>
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-0.5 flex items-center justify-between">
                        <span>Rotation</span>
                        <span className="tabular-nums text-slate-500">
                          {Math.round(selectedAnn.rotationDeg ?? 0)}°
                        </span>
                      </span>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        value={Math.round(selectedAnn.rotationDeg ?? 0)}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { rotationDeg: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--viewer-primary)]"
                      />
                    </label>
                    {selectedAnn.type === "line" && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-400">
                        <input
                          type="checkbox"
                          className="rounded border-slate-600"
                          checked={!!selectedAnn.arrowHead}
                          onChange={(e) =>
                            updateAnnotation(selectedAnn.id, { arrowHead: e.target.checked })
                          }
                        />
                        Arrow head
                      </label>
                    )}
                    {selectedAnn.type === "text" && (
                      <button
                        type="button"
                        onClick={() => setEditTextOpen(true)}
                        title="Edit the comment text on the sheet"
                        className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-600 py-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-800"
                      >
                        <Type className="h-3 w-3" strokeWidth={2} />
                        Edit text
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAnnotation(selectedAnn.id)}
                      title="Delete this markup permanently"
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-[10px] font-medium text-red-200 hover:bg-red-950/70"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={2} />
                      Delete
                    </button>
                  </div>
                </>
              )}

            {tool === "select" && selectedOnPageIds.length === 0 && (
              <p className="mb-2 rounded-md border border-slate-800/80 bg-slate-900/40 px-1.5 py-1.5 text-[9px] leading-snug text-slate-500">
                Click a markup on the page. Drag to move; drag handles to resize. ⌘/Ctrl+click or
                Shift+click for multi-select; drag a box on empty space. Text: set font size and
                colors in the panel.
              </p>
            )}

            {sidebarTab === "draw" && (
              <>
                <SectionTitle>Markup type</SectionTitle>
                <div className="mb-2 grid grid-cols-3 gap-1">
                  {markupShapes.map((m) => {
                    const Icon = m.icon;
                    const active = tool === "annotate" && markupShape === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        title={m.hint}
                        onClick={() => {
                          setTool("annotate");
                          setMarkupShape(m.id);
                        }}
                        className={`viewer-focus-ring viewer-markup-tool-btn ${
                          active ? "viewer-markup-tool-btn-active" : ""
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {sidebarTab === "draw" && tool === "annotate" && (
              <>
                <SectionTitle>Style</SectionTitle>
                <div className="mb-2 space-y-1.5 rounded-md border border-[#334155] bg-[#1E293B] p-1.5">
                  <label className="block text-[10px] text-[#94A3B8]">
                    <span className="mb-0.5 block">Width</span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="viewer-range w-full"
                    />
                  </label>
                  {markupShape === "text" && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[#94A3B8]">
                      <input
                        type="checkbox"
                        className="rounded border-[#64748B] bg-[#1E293B] accent-[#2563EB]"
                        checked={textBoxFillFromFrame}
                        onChange={(e) => setTextBoxFillFromFrame(e.target.checked)}
                      />
                      Tint box with frame color
                    </label>
                  )}
                </div>
              </>
            )}

            <SectionTitle>All markups</SectionTitle>
            <div className="mb-2 max-h-36 overflow-y-auto rounded-md border border-[#334155] bg-[#0F172A] [scrollbar-width:thin] sm:max-h-44">
              {markupAnnotations.length === 0 ? (
                <p className="px-1.5 py-2 text-[9px] text-[#94A3B8]">No markups yet.</p>
              ) : (
                <ul className="space-y-1 p-1">
                  {markupAnnotations.map((a) => {
                    const MuIcon = markupAnnotationIcon(a);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage(a.pageIndex + 1);
                            setSidebarTab("draw");
                            setTool("select");
                            setSelectedAnnotationId(a.id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setListMenu({ clientX: e.clientX, clientY: e.clientY, id: a.id });
                          }}
                          className="flex w-full items-start gap-1 rounded-md bg-[#1E293B] px-1.5 py-1.5 text-left text-[9px] leading-tight text-[#F8FAFC] hover:bg-[#334155]"
                        >
                          <MuIcon
                            className="mt-0.5 h-3 w-3 shrink-0 text-[#94A3B8]"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-[#94A3B8]">
                              p.{a.pageIndex + 1}
                            </span>{" "}
                            {annotationKindLabel(a.type, a.measurementKind)}
                            <span className="mt-0.5 block text-[8px] tabular-nums text-[#94A3B8]">
                              {formatAnnotationCreatedTooltip(a.createdAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="rounded-md border border-slate-800/80 bg-slate-900/60 px-1.5 py-1.5 text-[9px] leading-snug text-slate-500">
              Map &amp; snap: right panel. Pan: top bar. Use the{" "}
              <strong className="text-slate-400">Measure</strong> tab for calibration and
              dimensions.
            </p>
          </div>
        )}

        {pdfUrl && sidebarTab === "measure" && (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
            <CalibrationGuide />
            <CalibrateTargetRow />
            {tool === "select" && selectedOnPageIds.length > 1 && (
              <>
                <SectionTitle>Selection</SectionTitle>
                <div className="mb-2 space-y-2 rounded-lg border border-slate-700/80 bg-slate-900/55 p-1.5 ring-1 ring-white/[0.06]">
                  <p className="text-[9px] font-medium text-slate-200">
                    {selectedOnPageIds.length} items on this page
                  </p>
                  <p className="text-[8px] leading-snug text-slate-500">
                    ⌘ or Ctrl+click to toggle. Shift+click to add. Drag a box on empty space to
                    select.
                  </p>
                  <button
                    type="button"
                    disabled={
                      filterAnnotationIdsExcludingIssuePins(annotations, selectedOnPageIds)
                        .length === 0
                    }
                    title={
                      filterAnnotationIdsExcludingIssuePins(annotations, selectedOnPageIds)
                        .length === 0
                        ? "Selection is only issue markers — delete those from the Issues tab"
                        : undefined
                    }
                    onClick={() => {
                      const ids = filterAnnotationIdsExcludingIssuePins(
                        annotations,
                        selectedOnPageIds,
                      );
                      if (ids.length > 0) removeAnnotations(ids);
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-[10px] font-medium text-red-200 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2} />
                    Delete all selected
                  </button>
                </div>
              </>
            )}
            {tool === "select" &&
              selectedOnPageIds.length === 1 &&
              selectedAnn &&
              annotationIsIssuePin(selectedAnn) && (
                <div className="mb-2 rounded-lg border border-sky-800/50 bg-slate-900/60 p-2 ring-1 ring-sky-900/30">
                  <p className="text-[9px] leading-snug text-slate-400">
                    This is an <strong className="font-medium text-slate-300">issue</strong> marker.
                    To remove it, open the <strong className="text-slate-300">Issues</strong> tab
                    and use <strong className="text-slate-300">Delete</strong> on the issue — not
                    markup delete.
                  </p>
                </div>
              )}
            {tool === "select" &&
              selectedOnPageIds.length === 1 &&
              selectedAnn &&
              selectedAnn.type === "measurement" && (
                <>
                  <SectionTitle>Selection</SectionTitle>
                  <div className="mb-2 space-y-2 rounded-md border border-[var(--viewer-primary)]/35 bg-[color-mix(in_srgb,var(--viewer-input-bg)_70%,transparent)] p-1.5 ring-1 ring-[var(--viewer-primary)]/25">
                    <p className="text-[9px] font-medium text-[var(--viewer-text)]">
                      {annotationKindLabel(selectedAnn.type, selectedAnn.measurementKind)}
                    </p>
                    <label className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                      <span>Color</span>
                      <input
                        type="color"
                        value={selectedAnn.color}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { color: e.target.value })
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
                      />
                    </label>
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-0.5 block">Line width</span>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        value={selectedAnn.strokeWidth}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { strokeWidth: Number(e.target.value) })
                        }
                        className="viewer-range w-full"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                      <span>Label color</span>
                      <input
                        type="color"
                        value={selectedAnn.textColor ?? "#475569"}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { textColor: e.target.value })
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
                      />
                    </label>
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-0.5 flex items-center justify-between">
                        <span>Label size</span>
                        <span className="tabular-nums text-slate-500">
                          {selectedAnn.fontSize ?? 9}px
                        </span>
                      </span>
                      <input
                        type="range"
                        min={6}
                        max={28}
                        value={selectedAnn.fontSize ?? 9}
                        onChange={(e) =>
                          updateAnnotation(selectedAnn.id, { fontSize: Number(e.target.value) })
                        }
                        className="viewer-range w-full"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeAnnotation(selectedAnn.id)}
                      title="Delete this measure permanently"
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-[10px] font-medium text-red-200 hover:bg-red-950/70"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={2} />
                      Delete
                    </button>
                  </div>
                </>
              )}

            {tool === "select" && selectedOnPageIds.length === 0 && (
              <p className="mb-2 rounded-md border border-slate-800/80 bg-slate-900/40 px-1.5 py-1.5 text-[9px] leading-snug text-slate-500">
                Click a measure on the page. Drag to move; drag handles to resize. ⌘/Ctrl+click or
                Shift+click for multi-select; drag a box on empty space. Label options appear here.
              </p>
            )}

            <SectionTitle>Measure &amp; scale</SectionTitle>
            <div className="mb-2 flex gap-1">
              <button
                type="button"
                disabled={!pdfUrl}
                title="Set scale from a known length on the sheet"
                onClick={() => setTool("calibrate")}
                className={`viewer-focus-ring viewer-markup-tool-btn min-w-0 flex-1 disabled:pointer-events-none disabled:opacity-40 ${
                  tool === "calibrate" ? "viewer-markup-tool-btn-active" : ""
                }`}
              >
                <Scaling className="h-3.5 w-3.5" strokeWidth={1.75} />
                Calibrate
              </button>
              <button
                type="button"
                disabled={!pdfUrl}
                title="Place dimensions after calibration (line, area, angle, path)"
                onClick={() => setTool("measure")}
                className={`viewer-focus-ring viewer-markup-tool-btn min-w-0 flex-1 disabled:pointer-events-none disabled:opacity-40 ${
                  tool === "measure" ? "viewer-markup-tool-btn-active" : ""
                }`}
              >
                <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
                Ruler
              </button>
            </div>
            {tool === "measure" && (
              <>
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {measureKindOptions.map((opt) => {
                    const OptIcon = opt.icon;
                    const active = measureKind === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.hint}
                        onClick={() => setMeasureKind(opt.id)}
                        className={`viewer-focus-ring viewer-markup-tool-btn ${
                          active ? "viewer-markup-tool-btn-active" : ""
                        }`}
                      >
                        <OptIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <SectionTitle>Measure style</SectionTitle>
                <div className="mb-2 space-y-1.5 rounded-md border border-[#334155] bg-[#1E293B] p-1.5">
                  <label className="flex items-center justify-between gap-1 text-[10px] text-[#94A3B8]">
                    <span>Line color</span>
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-[#334155] bg-transparent"
                    />
                  </label>
                  <label className="block text-[10px] text-[#94A3B8]">
                    <span className="mb-0.5 block">Line width</span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="viewer-range w-full"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-1 text-[10px] text-[#94A3B8]">
                    <span>Label color</span>
                    <input
                      type="color"
                      value={measureLabelColor}
                      onChange={(e) => setMeasureLabelColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-[#334155] bg-transparent"
                    />
                  </label>
                  <label className="block text-[10px] text-[#94A3B8]">
                    <span className="mb-0.5 flex items-center justify-between">
                      <span>Label size</span>
                      <span className="tabular-nums text-[#94A3B8]">{measureLabelFontSize}px</span>
                    </span>
                    <input
                      type="range"
                      min={6}
                      max={28}
                      value={measureLabelFontSize}
                      onChange={(e) => setMeasureLabelFontSize(Number(e.target.value))}
                      className="viewer-range w-full"
                    />
                  </label>
                </div>
              </>
            )}
            <SectionTitle>Units &amp; calibration</SectionTitle>
            <div className="mb-2 space-y-1.5 rounded-md border border-[#334155] bg-[#1E293B] p-1.5">
              <label className="flex items-center justify-between gap-1 text-[10px] text-[#94A3B8]">
                <span>Units</span>
                <select
                  value={measureUnit}
                  onChange={(e) => setMeasureUnit(e.target.value as MeasureUnit)}
                  className="viewer-input-select max-w-[5.5rem]"
                  title="Displayed units (values stored in mm)"
                  aria-label="Measure units"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                  <option value="in">in</option>
                  <option value="ft">ft</option>
                </select>
              </label>
              <p className="text-[8px] leading-snug text-[#64748B]">
                Units and snap presets are saved with this document when you close the tab.
              </p>
              <button
                type="button"
                disabled={!pdfUrl || !pageCal}
                onClick={() => clearCalibration(pageIdx0)}
                title="Remove scale for this page"
                className="w-full rounded-md border border-[#334155] py-1 text-[9px] font-medium text-[#94A3B8] transition hover:bg-[#334155] hover:text-[#F8FAFC] disabled:opacity-40"
              >
                Clear calibration
              </button>
              {!pageCal && (
                <p className="text-[8px] leading-snug text-amber-500/90">
                  Calibrate this page before measuring real lengths and areas.
                </p>
              )}
            </div>

            <SectionTitle>All measures</SectionTitle>
            <div className="mb-2 max-h-36 overflow-y-auto rounded-md border border-[#334155] bg-[#0F172A] [scrollbar-width:thin] sm:max-h-44">
              {measureAnnotations.length === 0 ? (
                <p className="px-1.5 py-2 text-[9px] text-[#94A3B8]">No measures yet.</p>
              ) : (
                <ul className="space-y-0.5 p-1">
                  {measureAnnotations.map((a) => {
                    const MkIcon = measurementKindIcon(a.measurementKind);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage(a.pageIndex + 1);
                            setSidebarTab("measure");
                            setTool("select");
                            setSelectedAnnotationId(a.id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setListMenu({ clientX: e.clientX, clientY: e.clientY, id: a.id });
                          }}
                          className="flex w-full items-start gap-1 rounded-md bg-[#1E293B] px-1.5 py-1.5 text-left text-[9px] leading-tight text-[#F8FAFC] hover:bg-[#334155]"
                        >
                          <MkIcon
                            className="mt-0.5 h-3 w-3 shrink-0 text-[var(--viewer-primary)]/90"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-[var(--viewer-primary)]">
                              p.{a.pageIndex + 1}
                            </span>{" "}
                            {annotationKindLabel(a.type, a.measurementKind)}
                            <span className="mt-0.5 block text-[8px] tabular-nums text-[#94A3B8]">
                              {formatAnnotationCreatedTooltip(a.createdAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="rounded-md border border-[#334155] bg-[#1E293B]/80 px-2 py-2 text-[9px] italic leading-snug text-[#94A3B8]">
              Map &amp; snap live in the right panel. Pan and zoom from the top toolbar.
            </p>
          </div>
        )}
      </div>

      {editTextOpen && selectedAnn?.type === "text" && (
        <TextCommentDialog
          key={selectedAnn.id}
          open={editTextOpen}
          initialText={selectedAnn.text ?? ""}
          title="Edit comment"
          description="Update the note on the sheet."
          confirmLabel="Save"
          onCancel={() => setEditTextOpen(false)}
          onConfirm={(t) => {
            updateAnnotation(selectedAnn.id, { text: t });
            setEditTextOpen(false);
          }}
        />
      )}

      {listMenu && listMenuAnnotation && (
        <AnnotationListContextMenu
          clientX={listMenu.clientX}
          clientY={listMenu.clientY}
          locked={!!listMenuAnnotation.locked}
          onClose={() => setListMenu(null)}
          onCopy={() => {
            setSelectedAnnotationIds([listMenuAnnotation.id]);
            copyAnnotationsToClipboard([listMenuAnnotation.id]);
          }}
          onDuplicate={() => {
            setSelectedAnnotationIds([listMenuAnnotation.id]);
            duplicateAnnotationsOnPage(listMenuAnnotation.pageIndex, { x: 0.002, y: 0.002 });
          }}
          onToggleLock={() =>
            updateAnnotation(listMenuAnnotation.id, { locked: !listMenuAnnotation.locked })
          }
          onDelete={() => removeAnnotation(listMenuAnnotation.id)}
        />
      )}
    </aside>
  );
}
