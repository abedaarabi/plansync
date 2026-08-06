"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
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
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useViewerProSheetFeatures } from "@/hooks/useViewerProSheetFeatures";
import { MARKUP_STROKE_COLOR_PRESETS } from "@/lib/markupUi";
import { useViewerStore } from "@/store/viewerStore";
import {
  annotationIsIssueLinkedMarkup,
  annotationIsIssuePin,
  annotationIsProtectedSheetPin,
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
import { SidebarSheetAiTab } from "./sidebar/SidebarSheetAiTab";
import { SidebarCollabTab } from "./sidebar/SidebarCollabTab";
import { useViewerCollab } from "./viewerCollabContext";
import { DockEmptyState } from "./DockEmptyState";
import { SidebarSelectionHints } from "./SidebarSelectionHints";
import { ViewerGlassDock } from "./ViewerGlassDock";
import { ViewerIconRail, type ViewerRailItem } from "./ViewerIconRail";
import {
  loadViewerRailState,
  saveViewerRailState,
  type ViewerRailTabId,
} from "@/lib/viewerRailStorage";

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
  return (
    <h3 className="mb-2.5 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
      {children}
    </h3>
  );
}

type SidebarTabId =
  | "draw"
  | "measure"
  | "calibrate"
  | "pages"
  | "outline"
  | "issues"
  | "takeoff"
  | "sheetAi"
  | "collab";

const DOCK_META: Record<SidebarTabId, { title: string; subtitle: string }> = {
  pages: { title: "Pages", subtitle: "Thumbnails and navigation" },
  outline: { title: "Outline", subtitle: "PDF bookmarks" },
  draw: { title: "Draw", subtitle: "Markup tools and annotations" },
  measure: { title: "Measure", subtitle: "Dimensions and paths" },
  calibrate: { title: "Scale", subtitle: "Calibrate page units" },
  issues: { title: "Issues", subtitle: "Pins and punch items" },
  takeoff: {
    title: "Takeoff",
    subtitle: "Draw tools here · inventory opens separately",
  },
  sheetAi: { title: "Sheet AI", subtitle: "Assist on this sheet" },
  collab: { title: "Live", subtitle: "Collaboration presence" },
};

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

type ViewerSidebarProps = {
  pdfDoc: PDFDocumentProxy | null;
};

// fallow-ignore-next-line complexity
export function ViewerSidebar({ pdfDoc }: ViewerSidebarProps) {
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
  const setViewerWorkspaceMode = useViewerStore((s) => s.setViewerWorkspaceMode);
  const viewerWorkspaceMode = useViewerStore((s) => s.viewerWorkspaceMode);
  const takeoffInventoryDrawerFromSidebar = useViewerStore(
    (s) => s.takeoffInventoryDrawerFromSidebar,
  );
  const sheetAiDrawerFromSidebar = useViewerStore((s) => s.sheetAiDrawerFromSidebar);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>("draw");
  const [dockOpen, setDockOpen] = useState(false);
  const [railHydrated, setRailHydrated] = useState(false);
  const collabCtx = useViewerCollab();
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const pendingProSidebarTab = useViewerStore((s) => s.pendingProSidebarTab);
  const setPendingProSidebarTab = useViewerStore((s) => s.setPendingProSidebarTab);
  const takeoffMode = useViewerStore((s) => s.takeoffMode);
  const setTakeoffMode = useViewerStore((s) => s.setTakeoffMode);
  const viewerOperationsMode = useViewerStore((s) => s.viewerOperationsMode);
  const setTakeoffInventoryDrawerFromSidebar = useViewerStore(
    (s) => s.setTakeoffInventoryDrawerFromSidebar,
  );
  const setLeftSidebarTab = useViewerStore((s) => s.setLeftSidebarTab);
  const setSheetAiDrawerFromSidebar = useViewerStore((s) => s.setSheetAiDrawerFromSidebar);
  const bumpSheetAiExpand = useViewerStore((s) => s.bumpSheetAiExpand);
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
  const { enabled: proSheetFeatures, takeoffEnabled: proPlusTakeoff } = useViewerProSheetFeatures();
  const showProTabs = Boolean(pdfUrl && proSheetFeatures && viewerProjectId);
  const showTakeoffTab = showProTabs && proPlusTakeoff;
  const showCollabTab = showProTabs && Boolean(collabCtx?.collabFeatureEnabled);

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
        (a) => a.type !== "measurement" && !annotationIsProtectedSheetPin(a),
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
    if (
      selectedAnn.type === "measurement" ||
      annotationIsIssuePin(selectedAnn) ||
      annotationIsIssueLinkedMarkup(selectedAnn)
    )
      return;
    setStrokeColor(selectedAnn.color);
  }, [tool, selectedAnn, selectedAnn?.id, selectedAnn?.color, setStrokeColor]);

  /** Keep sidebar tab aligned with what you selected on the sheet (when on Draw or Measure panels). */
  useEffect(() => {
    if (!selectedAnn) return;
    setSidebarTab((t) => {
      if (
        t === "pages" ||
        t === "outline" ||
        t === "calibrate" ||
        t === "sheetAi" ||
        t === "collab"
      )
        return t;
      if (annotationIsIssuePin(selectedAnn) || annotationIsIssueLinkedMarkup(selectedAnn))
        return "issues";
      if (t === "takeoff") return t;
      return selectedAnn.type === "measurement" ? "measure" : "draw";
    });
  }, [
    selectedAnn,
    selectedAnn?.id,
    selectedAnn?.type,
    selectedAnn?.linkedIssueId,
    selectedAnn?.issueDraft,
    selectedAnn?.linkedIssueAttachment,
  ]);

  /** Keep Measure/Calibrate tools on their matching panels when a dock is open. */
  useEffect(() => {
    if (tool !== "measure" && tool !== "calibrate") return;
    setSidebarTab((t) =>
      t === "pages" ||
      t === "outline" ||
      t === "issues" ||
      t === "takeoff" ||
      t === "sheetAi" ||
      t === "collab"
        ? t
        : tool === "calibrate"
          ? "calibrate"
          : "measure",
    );
  }, [tool]);

  useEffect(() => {
    const saved = loadViewerRailState();
    if (saved && saved.tab !== "sheetAi") {
      setSidebarTab(saved.tab as SidebarTabId);
      setDockOpen(saved.dockOpen);
    }
    setRailHydrated(true);
  }, []);

  useEffect(() => {
    if (!railHydrated || !pdfUrl) return;
    saveViewerRailState({ tab: sidebarTab as ViewerRailTabId, dockOpen });
  }, [railHydrated, pdfUrl, sidebarTab, dockOpen]);

  useEffect(() => {
    if (!pendingProSidebarTab) return;
    if (!showProTabs) {
      setPendingProSidebarTab(null);
      return;
    }
    const tab = pendingProSidebarTab;
    setSidebarTab(tab);
    setDockOpen(true);
    if (tab === "issues") setViewerWorkspaceMode("issues");
    else if (tab === "takeoff") setViewerWorkspaceMode("takeoff");
    setPendingProSidebarTab(null);
  }, [pendingProSidebarTab, showProTabs, setPendingProSidebarTab, setViewerWorkspaceMode]);

  useEffect(() => {
    setLeftSidebarTab(sidebarTab);
  }, [sidebarTab, setLeftSidebarTab]);

  useEffect(() => {
    if (showProTabs) return;
    if (
      sidebarTab === "takeoff" ||
      sidebarTab === "issues" ||
      sidebarTab === "sheetAi" ||
      sidebarTab === "collab"
    ) {
      setSidebarTab("draw");
      setDockOpen(false);
    }
    if (takeoffMode) setTakeoffMode(false);
  }, [showProTabs, sidebarTab, takeoffMode, setTakeoffMode]);

  useEffect(() => {
    if (showTakeoffTab) return;
    if (sidebarTab === "takeoff") {
      setSidebarTab("draw");
      setDockOpen(false);
    }
    if (takeoffMode) setTakeoffMode(false);
  }, [showTakeoffTab, sidebarTab, takeoffMode, setTakeoffMode]);

  useEffect(() => {
    if (showCollabTab || sidebarTab !== "collab") return;
    setSidebarTab("draw");
    setDockOpen(false);
  }, [showCollabTab, sidebarTab]);

  useEffect(() => {
    if (!takeoffMode) return;
    setSidebarTab("takeoff");
    setDockOpen(true);
  }, [takeoffMode]);

  /** Match sheet overlay visibility to the active sidebar panel (Draw / Measure / Issues / Takeoff). */
  useEffect(() => {
    if (!showProTabs) return;
    const patch = useViewerStore.getState().patchSheetOverlayVisibility;
    if (sidebarTab === "draw") {
      patch({ showMarkups: true });
    } else if (sidebarTab === "measure") {
      patch({ showMeasurements: true });
    } else if (sidebarTab === "issues") {
      patch({ showIssuePins: true });
    } else if (sidebarTab === "takeoff") {
      patch({ showTakeoff: true });
    }
  }, [sidebarTab, showProTabs]);

  useEffect(() => {
    if (sidebarTab !== "takeoff" && takeoffMode) setTakeoffMode(false);
  }, [sidebarTab, takeoffMode, setTakeoffMode]);

  useEffect(() => {
    if (sidebarTab !== "takeoff") setTakeoffInventoryDrawerFromSidebar(false);
  }, [sidebarTab, setTakeoffInventoryDrawerFromSidebar]);

  useEffect(() => {
    if (sidebarTab === "sheetAi") {
      setSheetAiDrawerFromSidebar(true);
      bumpSheetAiExpand();
    } else {
      setSheetAiDrawerFromSidebar(false);
    }
  }, [sidebarTab, setSheetAiDrawerFromSidebar, bumpSheetAiExpand]);

  const pageCal = calibrationByPage[pageIdx0];

  const listMenuAnnotation = useMemo(() => {
    if (!listMenu) return undefined;
    return annotations.find((x) => x.id === listMenu.id);
  }, [listMenu, annotations]);

  const applyDockSideEffects = useCallback(
    (tab: SidebarTabId) => {
      if (tab === "pages" || tab === "outline") {
        setViewerWorkspaceMode("view");
        setTool("pan");
      } else if (tab === "draw") {
        setViewerWorkspaceMode("markup");
        setTool("annotate");
      } else if (tab === "measure") {
        setViewerWorkspaceMode("markup");
        setTool("measure");
      } else if (tab === "calibrate") {
        setViewerWorkspaceMode("markup");
        setTool("calibrate");
      } else if (tab === "issues") {
        setViewerWorkspaceMode("issues");
        setTool("select");
      } else if (tab === "collab") {
        setViewerWorkspaceMode("issues");
      } else if (tab === "takeoff") {
        setViewerWorkspaceMode("takeoff");
        setTakeoffMode(true);
        setTool("takeoff");
      }
    },
    [setViewerWorkspaceMode, setTool, setTakeoffMode],
  );

  const restoredSideEffectsRef = useRef(false);
  useEffect(() => {
    if (!railHydrated || !pdfUrl || restoredSideEffectsRef.current) return;
    restoredSideEffectsRef.current = true;
    if (dockOpen) applyDockSideEffects(sidebarTab);
  }, [railHydrated, pdfUrl, dockOpen, sidebarTab, applyDockSideEffects]);

  const exitTakeoffDrawingMode = useCallback(() => {
    setTakeoffMode(false);
    setTool("pan");
  }, [setTakeoffMode, setTool]);

  const closeDock = useCallback(() => {
    setDockOpen(false);
    if (sidebarTab === "takeoff") exitTakeoffDrawingMode();
  }, [sidebarTab, exitTakeoffDrawingMode]);

  const onRailSelect = useCallback(
    (id: string) => {
      const tab = id as SidebarTabId;
      if (!showProTabs && (tab === "issues" || tab === "collab" || tab === "takeoff")) return;
      if (!showTakeoffTab && tab === "takeoff") return;
      if (!showCollabTab && tab === "collab") return;
      if (dockOpen && sidebarTab === tab) {
        setDockOpen(false);
        if (tab === "takeoff") exitTakeoffDrawingMode();
        return;
      }
      setSidebarTab(tab);
      setDockOpen(true);
      applyDockSideEffects(tab);
    },
    [
      dockOpen,
      sidebarTab,
      applyDockSideEffects,
      exitTakeoffDrawingMode,
      showProTabs,
      showTakeoffTab,
      showCollabTab,
    ],
  );

  /** Keep draw/measure/takeoff usable while the dock is closed (soft rail highlight). */
  const railModeId = useMemo((): SidebarTabId | null => {
    if (tool === "annotate") return "draw";
    if (tool === "measure") return "measure";
    if (tool === "calibrate") return "calibrate";
    if (tool === "takeoff" || takeoffMode) return "takeoff";
    if (viewerWorkspaceMode === "issues") {
      return sidebarTab === "collab" ? "collab" : "issues";
    }
    if (viewerWorkspaceMode === "view") {
      return sidebarTab === "outline" ? "outline" : "pages";
    }
    if (sidebarTab === "draw" || sidebarTab === "measure" || sidebarTab === "calibrate") {
      return sidebarTab;
    }
    return null;
  }, [tool, takeoffMode, viewerWorkspaceMode, sidebarTab]);

  useEffect(() => {
    if (!pdfUrl || !railHydrated) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const map: Record<string, SidebarTabId> = {
        p: "pages",
        o: "outline",
        d: "draw",
        m: "measure",
        s: "calibrate",
        i: "issues",
        l: "collab",
        t: "takeoff",
      };
      const tab = map[key];
      if (!tab) return;
      e.preventDefault();
      onRailSelect(tab);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfUrl, railHydrated, onRailSelect]);

  const railSections = useMemo((): ViewerRailItem[][] => {
    const doc: ViewerRailItem[] = [
      { id: "pages", label: "Pages", icon: PanelLeft },
      { id: "outline", label: "Outline", icon: ListTree },
    ];
    const markup: ViewerRailItem[] = [
      { id: "draw", label: "Draw", icon: Pencil },
      { id: "measure", label: "Measure", icon: Ruler },
      { id: "calibrate", label: "Scale", icon: Scaling },
    ];
    const pro: ViewerRailItem[] = [];
    if (showProTabs) {
      pro.push({ id: "issues", label: "Issues", icon: ListChecks });
      if (showCollabTab) pro.push({ id: "collab", label: "Live", icon: Users });
      if (showTakeoffTab) pro.push({ id: "takeoff", label: "Takeoff", icon: Package });
    }
    return pro.length > 0 ? [doc, markup, pro] : [doc, markup];
  }, [showProTabs, showTakeoffTab, showCollabTab]);

  if (!pdfUrl) return null;

  const dockMeta = DOCK_META[sidebarTab];

  return (
    <div className="no-print pointer-events-none absolute inset-0 z-50 overflow-visible">
      <ViewerIconRail
        side="left"
        sections={railSections}
        activeId={dockOpen ? sidebarTab : null}
        modeId={railModeId}
        onSelect={onRailSelect}
        ariaLabel="Sheet tools"
        liftForBottomChrome={takeoffInventoryDrawerFromSidebar || sheetAiDrawerFromSidebar}
      />

      {dockOpen ? (
        <ViewerGlassDock
          side="left"
          open
          title={dockMeta.title}
          subtitle={dockMeta.subtitle}
          closeOnOutsideClick={false}
          liftForBottomChrome={takeoffInventoryDrawerFromSidebar || sheetAiDrawerFromSidebar}
          onClose={closeDock}
        >
          <div className="min-h-0 w-full px-2 py-2 text-[#F8FAFC] [scrollbar-width:thin]">
            {sidebarTab === "pages" && <SidebarPagesTab pdfDoc={pdfDoc} />}
            {sidebarTab === "outline" && <SidebarOutlineTab pdfDoc={pdfDoc} />}
            {sidebarTab === "issues" && showProTabs && <SidebarIssuesTab />}
            {sidebarTab === "takeoff" && showTakeoffTab && <SidebarTakeoffTab />}
            {sidebarTab === "calibrate" && (
              <div className="w-full">
                <CalibrationGuide />
                <CalibrateTargetRow />
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
                    <div className="mt-2">
                      <DockEmptyState
                        title="No scale on this page"
                        description="Draw a known length on the sheet, then enter its real-world size."
                        actionLabel="Start calibration"
                        onAction={() => setTool("calibrate")}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {sidebarTab === "sheetAi" && showProTabs && (
              <div className="w-full min-w-0">
                <SidebarSheetAiTab />
              </div>
            )}
            {sidebarTab === "collab" && showCollabTab && (
              <div className="w-full min-w-0 px-0.5">
                <SidebarCollabTab />
              </div>
            )}

            {sidebarTab === "draw" && (
              <div className="w-full">
                <SectionTitle>Stroke color</SectionTitle>
                <div className="mb-2 shrink-0 rounded-lg border border-[#334155] bg-[#1e293b]/80 p-2">
                  <p className="mb-2 text-[9px] leading-snug text-[#64748b]">
                    Used for new markups while drawing. Selecting an existing shape updates this to
                    match its color.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {MARKUP_STROKE_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          strokeColor === c
                            ? "border-[#2563eb] ring-2 ring-[#2563eb]/45"
                            : "border-transparent hover:ring-1 hover:ring-slate-500/40"
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

                {tool === "select" ? (
                  <SidebarSelectionHints
                    annotations={annotations}
                    selectedOnPageIds={selectedOnPageIds}
                    selectedAnn={selectedAnn}
                    removeAnnotations={removeAnnotations}
                  />
                ) : null}
                {tool === "select" &&
                  selectedOnPageIds.length === 1 &&
                  selectedAnn &&
                  selectedAnn.type !== "measurement" &&
                  !annotationIsIssuePin(selectedAnn) &&
                  !annotationIsIssueLinkedMarkup(selectedAnn) && (
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
                                  updateAnnotation(selectedAnn.id, {
                                    fontSize: Number(e.target.value),
                                  })
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
                              updateAnnotation(selectedAnn.id, {
                                strokeWidth: Number(e.target.value),
                              })
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
                              updateAnnotation(selectedAnn.id, {
                                rotationDeg: Number(e.target.value),
                              })
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
                            className={`viewer-focus-ring viewer-markup-tool-btn min-w-0 uppercase tracking-[0.06em] ${
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
                    <div className="p-1.5">
                      <DockEmptyState
                        title="No markups yet"
                        description="Pick a shape above, then draw on the sheet. Tools stay active if you close this panel."
                        actionLabel="Start drawing"
                        onAction={() => {
                          setTool("annotate");
                          setViewerWorkspaceMode("markup");
                        }}
                      />
                    </div>
                  ) : (
                    <ul className="space-y-1 p-1">
                      {markupAnnotations.map((a) => {
                        const MuIcon = markupAnnotationIcon(a);
                        return (
                          <li key={a.id} className="group relative">
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
                              className="flex w-full items-start gap-2 rounded-md border border-transparent bg-[#1E293B] px-2 py-2 text-left text-[9px] leading-tight text-[#F8FAFC] transition hover:border-sky-500/25 hover:bg-sky-950/25"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#334155] bg-[#0F172A] text-[#94A3B8]">
                                <MuIcon className="h-4 w-4" strokeWidth={1.75} />
                              </span>
                              <span className="min-w-0 flex-1 pr-7">
                                <span className="font-semibold text-[#94A3B8]">
                                  p.{a.pageIndex + 1}
                                </span>{" "}
                                {annotationKindLabel(a.type, a.measurementKind)}
                                <span className="mt-0.5 block text-[8px] tabular-nums text-[#94A3B8]">
                                  {formatAnnotationCreatedTooltip(a.createdAt)}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              title="Delete markup"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAnnotation(a.id);
                              }}
                              className="viewer-focus-ring absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-red-900/40 bg-red-950/50 text-red-100 opacity-0 transition hover:bg-red-950/75 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <p className="rounded-md border border-slate-800/80 bg-slate-900/60 px-1.5 py-1.5 text-[9px] leading-snug text-slate-500">
                  Map &amp; snap: top bar <strong className="text-slate-400">settings</strong> icon
                  (right panel). Pan: top bar. Use the{" "}
                  <strong className="text-slate-400">Measure</strong> tab for calibration and
                  dimensions.
                </p>
              </div>
            )}

            {sidebarTab === "measure" && (
              <div className="w-full">
                {tool === "select" ? (
                  <SidebarSelectionHints
                    annotations={annotations}
                    selectedOnPageIds={selectedOnPageIds}
                    selectedAnn={selectedAnn}
                    removeAnnotations={removeAnnotations}
                  />
                ) : null}
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
                              updateAnnotation(selectedAnn.id, {
                                strokeWidth: Number(e.target.value),
                              })
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
                    Click a measure on the page. Drag to move; drag handles to resize. ⌘/Ctrl+click
                    or Shift+click for multi-select; drag a box on empty space. Label options appear
                    here.
                  </p>
                )}

                <SectionTitle>Measure tools</SectionTitle>
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {measureKindOptions.map((opt) => {
                    const OptIcon = opt.icon;
                    const active = measureKind === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.hint}
                        onClick={() => {
                          setTool("measure");
                          setMeasureKind(opt.id);
                        }}
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

                <SectionTitle>All measures</SectionTitle>
                <div className="mb-2 max-h-36 overflow-y-auto rounded-md border border-[#334155] bg-[#0F172A] [scrollbar-width:thin] sm:max-h-44">
                  {measureAnnotations.length === 0 ? (
                    <div className="p-1.5">
                      <DockEmptyState
                        title="No measures yet"
                        description="Choose a measure tool, then click on the sheet. Calibrate first for real units."
                        actionLabel="Start measuring"
                        onAction={() => {
                          setTool("measure");
                          setViewerWorkspaceMode("markup");
                        }}
                      />
                    </div>
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
                  Map &amp; snap are under Sheet settings (top bar). Pan and zoom from the top
                  toolbar.
                </p>
              </div>
            )}
          </div>
        </ViewerGlassDock>
      ) : null}

      {editTextOpen && selectedAnn?.type === "text" ? (
        <div className="pointer-events-auto">
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
        </div>
      ) : null}

      {listMenu && listMenuAnnotation ? (
        <div className="pointer-events-auto">
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
        </div>
      ) : null}
    </div>
  );
}
