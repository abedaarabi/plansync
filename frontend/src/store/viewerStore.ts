import { create } from "zustand";
import { nanoid } from "nanoid";
import type { MeasureUnit } from "@/lib/coords";
import { patchIssue, putViewerState } from "@/lib/api-client";
import { clearPersistedSession } from "@/lib/sessionPersistence";
import {
  annotationToClipboardPayload,
  offsetAnnotationPoints,
  recomputeMeasurementFields,
} from "@/lib/annotationClipboard";
import { annotationIsProtectedSheetPin } from "@/lib/annotationIssues";
import type {
  TakeoffItem,
  TakeoffMeasurementType,
  TakeoffPackageStatus,
  TakeoffPendingGeometry,
  TakeoffZone,
} from "@/lib/takeoffTypes";
import { DEFAULT_MARKUP_STROKE_COLOR } from "@/lib/markupUi";
import { DEFAULT_TAKEOFF_COLOR } from "@/lib/takeoffUi";
import {
  DEFAULT_SHEET_OVERLAY_VISIBILITY,
  annotationPassesOverlayVisibility,
  loadSheetOverlayVisibilityFromStorage,
  persistSheetOverlayVisibility,
  type SheetOverlayVisibility,
} from "@/lib/viewerSheetOverlay";

/** Min / max viewer zoom (multiply viewport scale). */
export const VIEWER_SCALE_MIN = 0.05;
/** Upper zoom bound; PDF bitmap is capped separately (see pdfCanvasRenderScale) for GPU limits. */
export const VIEWER_SCALE_MAX = 32;

const MAX_HISTORY = 40;

function pageSizePts(
  pageSizePtByPage: Record<number, { wPt: number; hPt: number }>,
  pageIndex0: number,
) {
  const pt = pageSizePtByPage[pageIndex0];
  return { w: pt?.wPt ?? 612, h: pt?.hPt ?? 792 };
}

export type Tool =
  | "pan"
  | "annotate"
  | "select"
  | "measure"
  | "calibrate"
  | "zoomArea"
  /** ACC-style quantity takeoff drawing on calibrated sheets */
  | "takeoff";

/** Active measurement geometry when Measure tool is on */
export type MeasureKind = "line" | "area" | "angle" | "perimeter";

/** Markup tool when annotate is active */
export type MarkupShape =
  | "freehand"
  | "highlight"
  | "line"
  | "rect"
  | "ellipse"
  | "cross"
  | "diamond"
  | "polygon"
  | "arrow"
  | "cloud"
  | "text";

export type AnnotationType =
  | "polyline"
  | "highlight"
  | "line"
  | "rect"
  | "ellipse"
  | "cross"
  | "diamond"
  | "polygon"
  | "cloud"
  | "text"
  | "measurement";

export interface Annotation {
  id: string;
  pageIndex: number;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
  text?: string;
  /** Text comments: visual size (default 12). Measurements: label font size (default 11). */
  fontSize?: number;
  /** Text comments: glyph fill. Measurements: dimension label fill (default blue). */
  textColor?: string;
  /** Text comment box: when true, fill uses {@link color} (frame); when false/undefined, paper white. */
  textBoxFillFromFrame?: boolean;
  lengthMm?: number;
  /** Closed polygon: area in mm²; angle: vertex is points[0], rays to points[1] and points[2] */
  areaMm2?: number;
  angleDeg?: number;
  /** Stored geometry kind for measurements (default: two-point line) */
  measurementKind?: MeasureKind;
  /** Perpendicular offset of dimension line from chord (PDF user units); 0 = on the line */
  dimensionOffsetPdf?: number;
  /** Line or arrow: two-point markup */
  arrowHead?: boolean;
  /** Degrees clockwise around the shape pivot (see annotationRotation). Not used for measurements. */
  rotationDeg?: number;
  author?: string;
  createdAt: number;
  /** When true, item cannot be moved or resized until unlocked. */
  locked?: boolean;
  /** Sheet marker for a Pro issue — ellipse fill/stroke follow `issueStatus`. */
  linkedIssueId?: string;
  /** When set with {@link linkedIssueId}, this markup is linked for context but is not the issue location pin. */
  linkedIssueAttachment?: boolean;
  /** Drives on-sheet pin shape (hex vs circle); defaults to construction when unset. */
  linkedIssueKind?: "WORK_ORDER" | "CONSTRUCTION";
  /** Snapshot of issue status for coloring; update when status changes in Issues tab. */
  issueStatus?: string;
  /** Issue title for on-sheet affordances (tooltip chip when selected). */
  linkedIssueTitle?: string;
  /** Pin placed before the create-issue dialog is saved (no server issue id yet). */
  issueDraft?: boolean;
  /** Synced from Issues API for on-sheet pin chrome (optional). */
  linkedIssuePriority?: string;
  linkedIssueAssigneeInitials?: string;
  /** Display index for pin chip (e.g. 12 in “#12”), from sheet issue list order. */
  linkedIssueDisplayNum?: number;
  /** True when the linked issue has reference photos, linked markups, or RFIs (synced from Issues API). */
  linkedIssueHasAttachments?: boolean;
  /** O&M asset pin on the sheet (draft before PATCH, or linked after save). */
  omAssetDraft?: boolean;
  linkedOmAssetId?: string;
  linkedOmAssetTag?: string;
  /** Human-readable asset name (register title), shown next to the sheet pin. */
  linkedOmAssetName?: string;
  /** TOC zoom box, Sheet AI proposal markup, or AI-placed issue pin — removable in one action. */
  fromSheetAi?: boolean;
}

export interface Calibration {
  pageIndex: number;
  /** millimeters per one PDF user unit (same basis as getViewport({ scale: 1 })) */
  mmPerPdfUnit: number;
}

export type SessionSnapshot = {
  annotations: Annotation[];
  calibrationByPage: Record<number, Calibration>;
  takeoffItems: TakeoffItem[];
  takeoffZones: TakeoffZone[];
  takeoffPackageStatus: TakeoffPackageStatus;
};

function cloneTakeoffItems(items: TakeoffItem[]): TakeoffItem[] {
  return items.map((i) => ({ ...i }));
}

function cloneTakeoffZones(zones: TakeoffZone[]): TakeoffZone[] {
  return zones.map((z) => ({
    ...z,
    points: z.points.map((p) => ({ ...p })),
    tags: z.tags ? [...z.tags] : undefined,
  }));
}

function cloneSnapshot(state: {
  annotations: Annotation[];
  calibrationByPage: Record<number, Calibration>;
  takeoffItems?: TakeoffItem[];
  takeoffZones?: TakeoffZone[];
  takeoffPackageStatus?: TakeoffPackageStatus;
}): SessionSnapshot {
  return {
    annotations: state.annotations.map((a) => ({
      ...a,
      points: a.points.map((p) => ({ ...p })),
    })),
    calibrationByPage: Object.fromEntries(
      Object.entries(state.calibrationByPage).map(([k, v]) => [Number(k), { ...v }]),
    ) as Record<number, Calibration>,
    takeoffItems: cloneTakeoffItems(state.takeoffItems ?? []),
    takeoffZones: cloneTakeoffZones(state.takeoffZones ?? []),
    takeoffPackageStatus: state.takeoffPackageStatus ?? "draft",
  };
}

function applySnapshot(snapshot: SessionSnapshot) {
  return {
    annotations: snapshot.annotations.map((a) => ({
      ...a,
      points: a.points.map((p) => ({ ...p })),
    })),
    calibrationByPage: Object.fromEntries(
      Object.entries(snapshot.calibrationByPage).map(([k, v]) => [Number(k), { ...v }]),
    ) as Record<number, Calibration>,
    takeoffItems: cloneTakeoffItems(snapshot.takeoffItems ?? []),
    takeoffZones: cloneTakeoffZones(snapshot.takeoffZones ?? []),
    takeoffPackageStatus: snapshot.takeoffPackageStatus ?? "draft",
  };
}

interface ViewerState {
  pdfUrl: string | null;
  fileName: string | null;
  /** Set when opening a local file (bytes); unknown for restored sessions */
  fileSizeBytes: number | null;
  numPages: number;
  currentPage: number;
  scale: number;
  /** Baseline scale used for zoom % display (fit action sets this to current scale = 100%). */
  zoomDisplayBaseScale: number;
  tool: Tool;
  markupShape: MarkupShape;
  /** Line / area / angle / path length — used when tool is measure */
  measureKind: MeasureKind;
  strokeColor: string;
  strokeWidth: number;
  /** Default for new text markups: tint the comment box with the frame color. */
  textBoxFillFromFrame: boolean;
  /** Snap measure/calibrate/markup to PDF vector strokes */
  snapToGeometry: boolean;
  snapRadiusPx: number;
  /** null or [] = all PDF optional layers; otherwise only these layer ids */
  snapLayerIds: string[] | null;
  setMarkupShape: (s: MarkupShape) => void;
  setMeasureKind: (k: MeasureKind) => void;
  setSnapToGeometry: (v: boolean) => void;
  setSnapRadiusPx: (n: number) => void;
  setSnapLayerIds: (ids: string[] | null) => void;
  annotations: Annotation[];
  calibrationByPage: Record<number, Calibration>;
  /** Two normalized points while calibrating (before modal) */
  calibrateDraft: { x: number; y: number }[];
  /** Optional comparison length in mm (same basis as the live label) for Δ while dragging. */
  calibrateTargetMm: number | null;
  setCalibrateTargetMm: (mm: number | null) => void;
  measureUnit: MeasureUnit;
  /** Default dimension label size for new measurements (px in SVG space) */
  measureLabelFontSize: number;
  /** Default dimension label fill for new measurements */
  measureLabelColor: string;
  displayName: string;
  /**
   * When set, markups / calibration / measurements persist to `FileVersion.annotationBlob` (Pro cloud).
   * Sheet-level Pro tools (issues, RFIs, takeoff on the drawing) should use `viewerHasProSheetFeatures`
   * in `lib/proWorkspace.ts` (requires this id and a Pro workspace).
   */
  cloudFileVersionId: string | null;
  /** From `/viewer?projectId=` when opened from Projects (Pro sheet tools). */
  viewerProjectId: string | null;
  /**
   * When the open project has Operations mode, the viewer steers sheet tools to work orders
   * and hides quantity takeoff (FM phase).
   */
  viewerOperationsMode: boolean;
  /** Open Issues / Takeoff / Sheet AI tab once (e.g. `issueId` deep link). */
  pendingProSidebarTab: null | "issues" | "takeoff" | "sheetAi" | "collab";
  /** Show/hide markup layers on the canvas (persisted in localStorage). */
  sheetOverlayVisibility: SheetOverlayVisibility;
  patchSheetOverlayVisibility: (patch: Partial<SheetOverlayVisibility>) => void;
  setSheetOverlayVisibilityAll: (v: SheetOverlayVisibility) => void;
  hydrateSheetOverlayFromStorage: () => void;
  /** Click on PDF to drop a status-colored marker and link `annotationId` on the issue. */
  issuePlacement: null | {
    issueId: string;
    status: string;
    title: string;
    replaceAnnotationId: string | null;
    issueKind: "WORK_ORDER" | "CONSTRUCTION";
  };
  /** PlanGrid-style: toolbar “New issue” → click sheet to place pin, then dialog. */
  newIssuePlacementActive: boolean;
  /** Opens create dialog; cleared after save/cancel. */
  issueCreateDraft: null | { annotationId: string };
  /** Issues tab: scroll/highlight this server issue when its pin is selected on the sheet. */
  issuesSidebarFocusIssueId: string | null;
  /** Prevents dropping another sheet pin for the same issue while `patchIssue` is in flight. */
  issuePinLinkInFlightIssueId: string | null;
  /** From Assets → “Link on sheet”: click plan to drop asset pin (exclusive with issue placement). */
  omAssetPlacementActive: boolean;
  /** After pin drop; save/cancel in asset link panel. */
  omAssetCreateDraft: null | { annotationId: string };
  roomId: string;
  /** Optional-content layer ids discovered from the current page (for snap filter UI) */
  pdfSnapLayers: { id: string; label: string }[];
  /** Toolbar layer row hover — highlights that layer on the page */
  toolbarHoveredLayerId: string | null;
  /** Set in Select tool when user picks markups (order preserved for sidebar “primary”). */
  selectedAnnotationIds: string[];
  /** Page size in PDF points (viewport scale 1), by 0-based page index */
  pageSizePtByPage: Record<number, { wPt: number; hPt: number }>;
  historyPast: SessionSnapshot[];
  historyFuture: SessionSnapshot[];
  showMinimap: boolean;
  minimapOnlyWhenZoomed: boolean;
  /**
   * Right flyout — sheet settings (overlays) plus map & snap in one navy panel.
   */
  rightFlyout: null | "settings";
  setRightFlyout: (id: null | "settings") => void;
  /** Opens or closes the settings flyout (includes map, snap, saved views, overlays). */
  toggleRightFlyout: () => void;
  /** Mirrors the left sidebar tab for canvas hints (e.g. issues). Updated from ViewerSidebar. */
  leftSidebarTab:
    | "draw"
    | "measure"
    | "pages"
    | "outline"
    | "issues"
    | "takeoff"
    | "sheetAi"
    | "collab";
  setLeftSidebarTab: (
    t: "draw" | "measure" | "pages" | "outline" | "issues" | "takeoff" | "sheetAi" | "collab",
  ) => void;
  /**
   * Left tools rail (Draw / Measure / Pages / …). Used below `lg` only — wide layouts always show the panel;
   * this flag is ignored for layout at lg+.
   */
  mobileLeftToolsOpen: boolean;
  setMobileLeftToolsOpen: (open: boolean) => void;
  toggleMobileLeftTools: () => void;
  /** Side-by-side second page for plan/detail comparison */
  compareMode: boolean;
  comparePage: number;
  setCompareMode: (on: boolean) => void;
  setComparePage: (page: number) => void;
  /** Compare viewer layout when {@link compareMode} is on. */
  compareLayout: "sideBySide" | "overlay" | "swipe";
  setCompareLayout: (layout: "sideBySide" | "overlay" | "swipe") => void;
  /** Overlay mode: false = clean PDF (before), true = markups (after). */
  compareOverlayAfter: boolean;
  setCompareOverlayAfter: (v: boolean) => void;
  /** Swipe mode: 0 = all “before”, 1 = all “after”. */
  compareSwipeRatio: number;
  setCompareSwipeRatio: (n: number) => void;
  fitRequest: null | { mode: "width" | "page"; token: number };
  /** After text search: zoom and scroll to a normalized rect on a page */
  searchFocusRequest: null | {
    pageNumber: number;
    rectNorm: { x: number; y: number; w: number; h: number };
    token: number;
    /** After zoom/scroll, select this markup (e.g. issue deep link). */
    selectAnnotationId?: string | null;
    /** Lower = zoom in more. Default 0.85 (search). Takeoff sidebar uses ~0.72. */
    fitMargin?: number;
  };
  setPdf: (
    url: string | null,
    fileName: string | null,
    fileSizeBytes?: number | null,
    opts?: { cloudFileVersionId?: string | null; viewerProjectId?: string | null },
  ) => void;
  setViewerProjectId: (id: string | null) => void;
  setViewerOperationsMode: (on: boolean) => void;
  setPendingProSidebarTab: (tab: null | "issues" | "takeoff" | "sheetAi" | "collab") => void;
  setIssuePlacement: (
    p: null | {
      issueId: string;
      status: string;
      title: string;
      replaceAnnotationId: string | null;
      issueKind: "WORK_ORDER" | "CONSTRUCTION";
    },
  ) => void;
  setNewIssuePlacementActive: (v: boolean) => void;
  setIssueCreateDraft: (d: null | { annotationId: string }) => void;
  setOmAssetPlacementActive: (v: boolean) => void;
  setOmAssetCreateDraft: (d: null | { annotationId: string }) => void;
  setIssuesSidebarFocusIssueId: (id: string | null) => void;
  setIssuePinLinkInFlightIssueId: (id: string | null) => void;
  setPageSizePt: (pageIndex: number, wPt: number, hPt: number) => void;
  setPdfSnapLayers: (layers: { id: string; label: string }[]) => void;
  setToolbarHoveredLayerId: (id: string | null) => void;
  /** Replace the whole selection (use for single-item and clear). */
  setSelectedAnnotationId: (id: string | null) => void;
  setSelectedAnnotationIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setNumPages: (n: number) => void;
  setCurrentPage: (n: number) => void;
  setScale: (s: number) => void;
  setZoomDisplayBaseScale: (s: number) => void;
  setTool: (t: Tool) => void;
  setStrokeColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  setTextBoxFillFromFrame: (v: boolean) => void;
  setMeasureUnit: (u: MeasureUnit) => void;
  setMeasureLabelFontSize: (n: number) => void;
  setMeasureLabelColor: (c: string) => void;
  setDisplayName: (n: string) => void;
  setRoomId: (id: string) => void;
  setShowMinimap: (v: boolean) => void;
  setMinimapOnlyWhenZoomed: (v: boolean) => void;
  requestFit: (mode: "width" | "page") => void;
  clearFitRequest: () => void;
  requestSearchFocus: (payload: {
    pageNumber: number;
    rectNorm: { x: number; y: number; w: number; h: number };
    selectAnnotationId?: string | null;
    fitMargin?: number;
  }) => void;
  clearSearchFocusRequest: () => void;
  undo: () => void;
  redo: () => void;
  addAnnotation: (a: Omit<Annotation, "id" | "createdAt"> & { id?: string }) => string;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  /** Remove several annotations in one history step (e.g. multi-delete). */
  removeAnnotations: (ids: string[]) => void;
  setAnnotations: (list: Annotation[], opts?: { skipHistory?: boolean }) => void;
  setCalibration: (pageIndex: number, mmPerPdfUnit: number) => void;
  clearCalibration: (pageIndex: number) => void;
  setCalibrateDraft: (pts: { x: number; y: number }[]) => void;
  resetSession: () => void;
  /** Remove saved session from localStorage and clear markups, calibration, and undo history for the current PDF. */
  clearPersistedMarkupForCurrentDocument: () => void;
  /** Remove non-measurement annotations on one page (0-based index). */
  deleteAllMarkupsOnPage: (pageIndex0: number) => void;
  /** Remove all non-measurement annotations on every page. */
  deleteAllMarkupsInDocument: () => void;
  /**
   * Remove Sheet AI overlays: TOC highlights, proposal markups, AI issue pins (unlinks server pin),
   * and takeoff zones/items tagged from Sheet AI (e.g. smart sheet / TOC).
   */
  clearSheetAiFromDrawing: () => Promise<void>;
  /** In-memory copy buffer for Ctrl+C / paste on page. */
  markupClipboard: Omit<Annotation, "id" | "createdAt">[] | null;
  copyAnnotationsToClipboard: (ids: string[]) => void;
  pasteClipboardToPage: (pageIndex0: number) => void;
  duplicateAnnotationsOnPage: (pageIndex0: number, offsetNorm: { x: number; y: number }) => void;

  /** When true, UI focuses on takeoff (sidebar tab, optional toolbar). */
  takeoffMode: boolean;
  setTakeoffMode: (v: boolean) => void;
  takeoffDrawKind: TakeoffMeasurementType;
  setTakeoffDrawKind: (k: TakeoffMeasurementType) => void;
  /** Area takeoff: multi-click polygon vs two-click box. */
  takeoffAreaMode: "polygon" | "box";
  setTakeoffAreaMode: (m: "polygon" | "box") => void;
  takeoffItems: TakeoffItem[];
  takeoffZones: TakeoffZone[];
  takeoffSelectedItemId: string | null;
  /** Multi-select zones (inventory + canvas); empty + item selected = all zones for item emphasized on canvas. */
  takeoffSelectedZoneIds: string[];
  /** Last bulk/single zone delete for one-step undo from inventory. */
  takeoffDeletedZonesUndo: TakeoffZone[] | null;
  /** Canvas / inventory hover sync (cleared when tool !== takeoff). */
  takeoffHoverZoneId: string | null;
  takeoffHoverItemId: string | null;
  setTakeoffHoverZoneId: (id: string | null) => void;
  setTakeoffHoverItemId: (id: string | null) => void;
  /** Color for in-progress takeoff preview and new items when no inventory row is selected. */
  takeoffPenColor: string;
  setTakeoffPenColor: (c: string) => void;
  /** Bottom inventory drawer: true only after opening the Takeoff sidebar tab (keeps viewer clean). */
  takeoffInventoryDrawerFromSidebar: boolean;
  setTakeoffInventoryDrawerFromSidebar: (v: boolean) => void;
  /** Bumped after saving a new zone so the inventory drawer expands to half. */
  takeoffInventoryExpandNonce: number;
  bumpTakeoffInventoryExpand: () => void;
  /** Bottom Sheet AI drawer: true while the Sheet AI sidebar tab is selected. */
  sheetAiDrawerFromSidebar: boolean;
  setSheetAiDrawerFromSidebar: (v: boolean) => void;
  sheetAiExpandNonce: number;
  bumpSheetAiExpand: () => void;
  takeoffPendingGeometry: TakeoffPendingGeometry | null;
  takeoffSliderOpen: boolean;
  /** True when adding a catalog-only line (no sheet geometry). */
  takeoffSliderManualOnly: boolean;
  takeoffEditingZoneId: string | null;
  takeoffPackageStatus: TakeoffPackageStatus;
  setTakeoffPackageStatus: (s: TakeoffPackageStatus) => void;
  takeoffSummaryOpen: boolean;
  setTakeoffSummaryOpen: (v: boolean) => void;
  /** Count mode: points before "Finish count" commits to slider. */
  takeoffCountDraftPoints: { x: number; y: number }[] | null;
  setTakeoffCountDraftPoints: (pts: { x: number; y: number }[] | null) => void;
  /** Redraw: next completed takeoff geometry replaces this zone instead of opening new-item flow. */
  takeoffRedrawZoneId: string | null;
  setTakeoffRedrawZoneId: (id: string | null) => void;
  /** Move: drag this zone on the sheet (takeoff tool). */
  takeoffMoveZoneId: string | null;
  setTakeoffMoveZoneId: (id: string | null) => void;
  /** Vertex edit: drag polygon corners for this area zone. */
  takeoffVertexEditZoneId: string | null;
  setTakeoffVertexEditZoneId: (id: string | null) => void;
  takeoffAddItem: (
    item: Omit<TakeoffItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => string;
  takeoffUpdateItem: (id: string, patch: Partial<TakeoffItem>) => void;
  takeoffRemoveItem: (id: string) => void;
  takeoffAddZone: (zone: Omit<TakeoffZone, "id" | "createdAt"> & { id?: string }) => string;
  takeoffUpdateZone: (id: string, patch: Partial<TakeoffZone>) => void;
  takeoffRemoveZone: (id: string) => void;
  setTakeoffSelectedItemId: (id: string | null) => void;
  setTakeoffSelectedZoneIds: (ids: string[]) => void;
  takeoffRemoveZonesBulk: (zoneIds: string[]) => { removed: number; skippedLocked: number };
  takeoffUndoLastZoneDeletion: () => void;
  setTakeoffPendingGeometry: (g: TakeoffPendingGeometry | null) => void;
  openTakeoffSlider: (opts: {
    editZoneId?: string | null;
    pending?: TakeoffPendingGeometry | null;
    manualLine?: boolean;
  }) => void;
  closeTakeoffSlider: () => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  pdfUrl: null,
  fileName: null,
  fileSizeBytes: null,
  numPages: 0,
  currentPage: 1,
  scale: 1,
  zoomDisplayBaseScale: 1,
  tool: "pan",
  markupShape: "freehand",
  measureKind: "line",
  strokeColor: DEFAULT_MARKUP_STROKE_COLOR,
  strokeWidth: 2,
  textBoxFillFromFrame: false,
  snapToGeometry: true,
  snapRadiusPx: 14,
  snapLayerIds: null,
  annotations: [],
  calibrationByPage: {},
  calibrateDraft: [],
  calibrateTargetMm: null,
  measureUnit: "mm",
  measureLabelFontSize: 11,
  measureLabelColor: "#3b82f6",
  displayName: "Engineer",
  cloudFileVersionId: null,
  viewerProjectId: null,
  viewerOperationsMode: false,
  pendingProSidebarTab: null,
  sheetOverlayVisibility: { ...DEFAULT_SHEET_OVERLAY_VISIBILITY },
  issuePlacement: null,
  newIssuePlacementActive: false,
  issueCreateDraft: null,
  issuesSidebarFocusIssueId: null,
  issuePinLinkInFlightIssueId: null,
  omAssetPlacementActive: false,
  omAssetCreateDraft: null,
  roomId: "default",
  pdfSnapLayers: [],
  toolbarHoveredLayerId: null,
  markupClipboard: null,
  selectedAnnotationIds: [],
  pageSizePtByPage: {},
  historyPast: [],
  historyFuture: [],
  showMinimap: true,
  minimapOnlyWhenZoomed: false,
  rightFlyout: null,
  leftSidebarTab: "draw",
  mobileLeftToolsOpen: false,
  compareMode: false,
  comparePage: 1,
  compareLayout: "sideBySide",
  compareOverlayAfter: true,
  compareSwipeRatio: 0.5,
  fitRequest: null,
  searchFocusRequest: null,

  takeoffMode: false,
  takeoffDrawKind: "area",
  takeoffAreaMode: "polygon",
  takeoffItems: [],
  takeoffZones: [],
  takeoffSelectedItemId: null,
  takeoffSelectedZoneIds: [],
  takeoffDeletedZonesUndo: null,
  takeoffHoverZoneId: null,
  takeoffHoverItemId: null,
  takeoffPenColor: DEFAULT_TAKEOFF_COLOR,
  takeoffInventoryDrawerFromSidebar: false,
  takeoffInventoryExpandNonce: 0,
  sheetAiDrawerFromSidebar: false,
  sheetAiExpandNonce: 0,
  takeoffPendingGeometry: null,
  takeoffSliderOpen: false,
  takeoffSliderManualOnly: false,
  takeoffEditingZoneId: null,
  takeoffPackageStatus: "draft",
  takeoffSummaryOpen: false,
  takeoffCountDraftPoints: null,
  takeoffRedrawZoneId: null,
  takeoffMoveZoneId: null,
  takeoffVertexEditZoneId: null,

  setTakeoffMode: (takeoffMode) => set({ takeoffMode }),
  setTakeoffCountDraftPoints: (takeoffCountDraftPoints) => set({ takeoffCountDraftPoints }),
  setTakeoffRedrawZoneId: (takeoffRedrawZoneId) => set({ takeoffRedrawZoneId }),
  setTakeoffMoveZoneId: (takeoffMoveZoneId) => set({ takeoffMoveZoneId }),
  setTakeoffVertexEditZoneId: (takeoffVertexEditZoneId) => set({ takeoffVertexEditZoneId }),
  setTakeoffDrawKind: (takeoffDrawKind) => set({ takeoffDrawKind }),
  setTakeoffAreaMode: (takeoffAreaMode) => set({ takeoffAreaMode }),
  setTakeoffPackageStatus: (takeoffPackageStatus) => set({ takeoffPackageStatus }),
  setTakeoffSummaryOpen: (takeoffSummaryOpen) => set({ takeoffSummaryOpen }),
  setTakeoffSelectedItemId: (takeoffSelectedItemId) => set({ takeoffSelectedItemId }),
  setTakeoffSelectedZoneIds: (takeoffSelectedZoneIds) => set({ takeoffSelectedZoneIds }),
  setTakeoffPenColor: (takeoffPenColor) => set({ takeoffPenColor }),
  setTakeoffInventoryDrawerFromSidebar: (takeoffInventoryDrawerFromSidebar) =>
    set({ takeoffInventoryDrawerFromSidebar }),
  setTakeoffHoverZoneId: (takeoffHoverZoneId) => set({ takeoffHoverZoneId }),
  setTakeoffHoverItemId: (takeoffHoverItemId) => set({ takeoffHoverItemId }),
  bumpTakeoffInventoryExpand: () =>
    set((s) => ({ takeoffInventoryExpandNonce: s.takeoffInventoryExpandNonce + 1 })),
  setSheetAiDrawerFromSidebar: (sheetAiDrawerFromSidebar) => set({ sheetAiDrawerFromSidebar }),
  bumpSheetAiExpand: () => set((s) => ({ sheetAiExpandNonce: s.sheetAiExpandNonce + 1 })),
  setTakeoffPendingGeometry: (takeoffPendingGeometry) => set({ takeoffPendingGeometry }),

  openTakeoffSlider: ({ editZoneId, pending, manualLine }) =>
    set({
      takeoffSliderOpen: true,
      takeoffSliderManualOnly: Boolean(manualLine),
      takeoffEditingZoneId: editZoneId ?? null,
      takeoffPendingGeometry: pending ?? null,
    }),

  closeTakeoffSlider: () =>
    set({
      takeoffSliderOpen: false,
      takeoffSliderManualOnly: false,
      takeoffEditingZoneId: null,
      takeoffPendingGeometry: null,
    }),

  takeoffAddItem: (incoming) => {
    const raw = incoming as TakeoffItem & { id?: string };
    const id = raw.id ?? nanoid();
    const now = Date.now();
    const rest = { ...raw };
    delete (rest as { id?: string }).id;
    set((state) => {
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        takeoffItems: [
          ...state.takeoffItems,
          {
            ...rest,
            id,
            createdAt: now,
            updatedAt: now,
          } as TakeoffItem,
        ],
      };
    });
    return id;
  },

  takeoffUpdateItem: (id, patch) =>
    set((state) => {
      if (!state.takeoffItems.some((x) => x.id === id)) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const now = Date.now();
      return {
        historyPast: past,
        historyFuture: [],
        takeoffItems: state.takeoffItems.map((x) =>
          x.id === id ? { ...x, ...patch, updatedAt: now } : x,
        ),
      };
    }),

  takeoffRemoveItem: (id) =>
    set((state) => {
      if (!state.takeoffItems.some((x) => x.id === id)) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const zoneIdsForItem = state.takeoffZones.filter((z) => z.itemId === id).map((z) => z.id);
      const editingThisItem =
        state.takeoffEditingZoneId != null && zoneIdsForItem.includes(state.takeoffEditingZoneId);
      return {
        historyPast: past,
        historyFuture: [],
        takeoffItems: state.takeoffItems.filter((x) => x.id !== id),
        takeoffZones: state.takeoffZones.filter((z) => z.itemId !== id),
        takeoffSelectedItemId:
          state.takeoffSelectedItemId === id ? null : state.takeoffSelectedItemId,
        takeoffSelectedZoneIds: state.takeoffSelectedZoneIds.filter(
          (zid) => !zoneIdsForItem.includes(zid),
        ),
        takeoffDeletedZonesUndo: null,
        takeoffRedrawZoneId:
          state.takeoffRedrawZoneId != null && zoneIdsForItem.includes(state.takeoffRedrawZoneId)
            ? null
            : state.takeoffRedrawZoneId,
        takeoffMoveZoneId:
          state.takeoffMoveZoneId != null && zoneIdsForItem.includes(state.takeoffMoveZoneId)
            ? null
            : state.takeoffMoveZoneId,
        takeoffVertexEditZoneId:
          state.takeoffVertexEditZoneId != null &&
          zoneIdsForItem.includes(state.takeoffVertexEditZoneId)
            ? null
            : state.takeoffVertexEditZoneId,
        ...(editingThisItem
          ? {
              takeoffSliderOpen: false,
              takeoffSliderManualOnly: false,
              takeoffEditingZoneId: null,
              takeoffPendingGeometry: null,
            }
          : {}),
      };
    }),

  takeoffAddZone: (incoming) => {
    const raw = incoming as TakeoffZone & { id?: string };
    const id = raw.id ?? nanoid();
    const now = Date.now();
    const rest = { ...raw };
    delete (rest as { id?: string }).id;
    set((state) => {
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        takeoffZones: [
          ...state.takeoffZones,
          {
            ...rest,
            id,
            createdAt: now,
          } as TakeoffZone,
        ],
      };
    });
    return id;
  },

  takeoffUpdateZone: (id, patch) =>
    set((state) => {
      if (!state.takeoffZones.some((z) => z.id === id)) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const displayName = state.displayName;
      return {
        historyPast: past,
        historyFuture: [],
        takeoffZones: state.takeoffZones.map((z) =>
          z.id === id
            ? {
                ...z,
                ...patch,
                editedBy: displayName,
                editedAt: Date.now(),
              }
            : z,
        ),
      };
    }),

  takeoffRemoveZone: (id) =>
    set((state) => {
      const z0 = state.takeoffZones.find((z) => z.id === id);
      if (!z0) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const undoSnap: TakeoffZone = {
        ...z0,
        points: z0.points.map((p) => ({ ...p })),
        tags: z0.tags ? [...z0.tags] : undefined,
      };
      return {
        historyPast: past,
        historyFuture: [],
        takeoffZones: state.takeoffZones.filter((z) => z.id !== id),
        takeoffSelectedZoneIds: state.takeoffSelectedZoneIds.filter((zid) => zid !== id),
        takeoffDeletedZonesUndo: [undoSnap],
        takeoffRedrawZoneId: state.takeoffRedrawZoneId === id ? null : state.takeoffRedrawZoneId,
        takeoffMoveZoneId: state.takeoffMoveZoneId === id ? null : state.takeoffMoveZoneId,
        takeoffVertexEditZoneId:
          state.takeoffVertexEditZoneId === id ? null : state.takeoffVertexEditZoneId,
        ...(state.takeoffEditingZoneId === id
          ? {
              takeoffSliderOpen: false,
              takeoffSliderManualOnly: false,
              takeoffEditingZoneId: null,
              takeoffPendingGeometry: null,
            }
          : {}),
      };
    }),

  takeoffRemoveZonesBulk: (zoneIds) => {
    const state = get();
    const idSet = new Set(zoneIds);
    const skippedLocked = zoneIds.filter(
      (rid) => state.takeoffZones.find((z) => z.id === rid)?.locked,
    ).length;
    const toRemove = state.takeoffZones.filter((z) => idSet.has(z.id) && !z.locked);
    if (toRemove.length === 0) return { removed: 0, skippedLocked };

    const removeIds = new Set(toRemove.map((z) => z.id));
    const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
    const undoSnap = toRemove.map(
      (z): TakeoffZone => ({
        ...z,
        points: z.points.map((p) => ({ ...p })),
        tags: z.tags ? [...z.tags] : undefined,
      }),
    );
    const editingRemoved =
      state.takeoffEditingZoneId != null && removeIds.has(state.takeoffEditingZoneId);

    set({
      historyPast: past,
      historyFuture: [],
      takeoffZones: state.takeoffZones.filter((z) => !removeIds.has(z.id)),
      takeoffSelectedZoneIds: state.takeoffSelectedZoneIds.filter((zid) => !removeIds.has(zid)),
      takeoffRedrawZoneId:
        state.takeoffRedrawZoneId != null && removeIds.has(state.takeoffRedrawZoneId)
          ? null
          : state.takeoffRedrawZoneId,
      takeoffMoveZoneId:
        state.takeoffMoveZoneId != null && removeIds.has(state.takeoffMoveZoneId)
          ? null
          : state.takeoffMoveZoneId,
      takeoffVertexEditZoneId:
        state.takeoffVertexEditZoneId != null && removeIds.has(state.takeoffVertexEditZoneId)
          ? null
          : state.takeoffVertexEditZoneId,
      takeoffDeletedZonesUndo: undoSnap,
      ...(editingRemoved
        ? {
            takeoffSliderOpen: false,
            takeoffSliderManualOnly: false,
            takeoffEditingZoneId: null,
            takeoffPendingGeometry: null,
          }
        : {}),
    });
    return { removed: toRemove.length, skippedLocked };
  },

  takeoffUndoLastZoneDeletion: () =>
    set((state) => {
      const batch = state.takeoffDeletedZonesUndo;
      if (!batch || batch.length === 0) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const restored = batch.map(
        (z): TakeoffZone => ({
          ...z,
          points: z.points.map((p) => ({ ...p })),
          tags: z.tags ? [...z.tags] : undefined,
        }),
      );
      return {
        historyPast: past,
        historyFuture: [],
        takeoffZones: [...state.takeoffZones, ...restored],
        takeoffDeletedZonesUndo: null,
      };
    }),

  setRightFlyout: (rightFlyout) => set({ rightFlyout }),
  toggleRightFlyout: () =>
    set((s) => ({ rightFlyout: s.rightFlyout === "settings" ? null : "settings" })),
  setLeftSidebarTab: (leftSidebarTab) => set({ leftSidebarTab }),
  setCompareMode: (compareMode) =>
    set({
      compareMode,
      ...(compareMode
        ? {}
        : {
            compareLayout: "sideBySide",
            compareOverlayAfter: true,
            compareSwipeRatio: 0.5,
          }),
    }),
  setComparePage: (comparePage) =>
    set((s) => ({
      comparePage: Math.min(Math.max(1, comparePage), s.numPages || 1),
    })),
  setCompareLayout: (compareLayout) => set({ compareLayout }),
  setCompareOverlayAfter: (compareOverlayAfter) => set({ compareOverlayAfter }),
  setCompareSwipeRatio: (n) =>
    set({ compareSwipeRatio: Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5)) }),
  setMobileLeftToolsOpen: (open) => set({ mobileLeftToolsOpen: open }),
  toggleMobileLeftTools: () => set((s) => ({ mobileLeftToolsOpen: !s.mobileLeftToolsOpen })),

  setViewerProjectId: (viewerProjectId) => set({ viewerProjectId }),
  setViewerOperationsMode: (viewerOperationsMode) => set({ viewerOperationsMode }),
  setPendingProSidebarTab: (pendingProSidebarTab) => set({ pendingProSidebarTab }),
  patchSheetOverlayVisibility: (patch) =>
    set((s) => {
      const next = { ...s.sheetOverlayVisibility, ...patch };
      persistSheetOverlayVisibility(next);
      const sel = s.selectedAnnotationIds.filter((id) => {
        const a = s.annotations.find((x) => x.id === id);
        return a && annotationPassesOverlayVisibility(a, next);
      });
      return {
        sheetOverlayVisibility: next,
        ...(sel.length !== s.selectedAnnotationIds.length ? { selectedAnnotationIds: sel } : {}),
      };
    }),
  setSheetOverlayVisibilityAll: (sheetOverlayVisibility) => {
    persistSheetOverlayVisibility(sheetOverlayVisibility);
    set((s) => {
      const sel = s.selectedAnnotationIds.filter((id) => {
        const a = s.annotations.find((x) => x.id === id);
        return a && annotationPassesOverlayVisibility(a, sheetOverlayVisibility);
      });
      return {
        sheetOverlayVisibility,
        ...(sel.length !== s.selectedAnnotationIds.length ? { selectedAnnotationIds: sel } : {}),
      };
    });
  },
  hydrateSheetOverlayFromStorage: () => {
    const loaded = loadSheetOverlayVisibilityFromStorage();
    if (!loaded) return;
    set((s) => {
      const sel = s.selectedAnnotationIds.filter((id) => {
        const a = s.annotations.find((x) => x.id === id);
        return a && annotationPassesOverlayVisibility(a, loaded);
      });
      return {
        sheetOverlayVisibility: loaded,
        ...(sel.length !== s.selectedAnnotationIds.length ? { selectedAnnotationIds: sel } : {}),
      };
    });
  },
  setIssuePlacement: (issuePlacement) =>
    set({
      issuePlacement,
      ...(issuePlacement
        ? {
            newIssuePlacementActive: false,
            omAssetPlacementActive: false,
            omAssetCreateDraft: null,
          }
        : {}),
    }),
  setNewIssuePlacementActive: (newIssuePlacementActive) =>
    set({
      newIssuePlacementActive,
      ...(newIssuePlacementActive
        ? { issuePlacement: null, omAssetPlacementActive: false, omAssetCreateDraft: null }
        : {}),
    }),
  setIssueCreateDraft: (issueCreateDraft) => set({ issueCreateDraft }),
  setOmAssetPlacementActive: (omAssetPlacementActive) =>
    set({
      omAssetPlacementActive,
      ...(omAssetPlacementActive
        ? {
            issuePlacement: null,
            newIssuePlacementActive: false,
            issueCreateDraft: null,
          }
        : {}),
    }),
  setOmAssetCreateDraft: (omAssetCreateDraft) => set({ omAssetCreateDraft }),
  setIssuesSidebarFocusIssueId: (issuesSidebarFocusIssueId) => set({ issuesSidebarFocusIssueId }),
  setIssuePinLinkInFlightIssueId: (issuePinLinkInFlightIssueId) =>
    set({ issuePinLinkInFlightIssueId }),

  setPdf: (url, fileName, fileSizeBytes, opts) =>
    set({
      pdfUrl: url,
      fileName,
      fileSizeBytes: fileSizeBytes ?? null,
      cloudFileVersionId: opts?.cloudFileVersionId ?? null,
      viewerProjectId: opts?.viewerProjectId ?? null,
      viewerOperationsMode: false,
      pendingProSidebarTab: null,
      issuePlacement: null,
      newIssuePlacementActive: false,
      issueCreateDraft: null,
      omAssetPlacementActive: false,
      omAssetCreateDraft: null,
      issuesSidebarFocusIssueId: null,
      issuePinLinkInFlightIssueId: null,
      takeoffRedrawZoneId: null,
      takeoffMoveZoneId: null,
      takeoffVertexEditZoneId: null,
      currentPage: 1,
      numPages: 0,
      zoomDisplayBaseScale: 1,
      annotations: [],
      calibrationByPage: {},
      calibrateDraft: [],
      calibrateTargetMm: null,
      pdfSnapLayers: [],
      toolbarHoveredLayerId: null,
      markupClipboard: null,
      selectedAnnotationIds: [],
      pageSizePtByPage: {},
      historyPast: [],
      historyFuture: [],
      fitRequest: null,
      searchFocusRequest: null,
      measureUnit: "mm",
      snapToGeometry: true,
      snapRadiusPx: 14,
      compareMode: false,
      comparePage: 1,
      compareLayout: "sideBySide",
      compareOverlayAfter: true,
      compareSwipeRatio: 0.5,
      rightFlyout: null,
      leftSidebarTab: "draw",
      tool: "pan",
      takeoffMode: false,
      takeoffDrawKind: "area",
      takeoffAreaMode: "polygon",
      takeoffItems: [],
      takeoffZones: [],
      takeoffSelectedItemId: null,
      takeoffSelectedZoneIds: [],
      takeoffDeletedZonesUndo: null,
      takeoffHoverZoneId: null,
      takeoffHoverItemId: null,
      takeoffPenColor: DEFAULT_TAKEOFF_COLOR,
      takeoffInventoryDrawerFromSidebar: false,
      takeoffInventoryExpandNonce: 0,
      sheetAiDrawerFromSidebar: false,
      sheetAiExpandNonce: 0,
      takeoffPendingGeometry: null,
      takeoffSliderOpen: false,
      takeoffSliderManualOnly: false,
      takeoffEditingZoneId: null,
      takeoffPackageStatus: "draft",
      takeoffSummaryOpen: false,
      takeoffCountDraftPoints: null,
    }),

  setNumPages: (n) => {
    set((state) => ({
      numPages: n,
      comparePage: Math.min(Math.max(1, state.comparePage), Math.max(1, n)),
    }));
  },

  setPageSizePt: (pageIndex, wPt, hPt) =>
    set((state) => ({
      pageSizePtByPage: {
        ...state.pageSizePtByPage,
        [pageIndex]: { wPt, hPt },
      },
    })),

  setPdfSnapLayers: (pdfSnapLayers) => set({ pdfSnapLayers }),
  setToolbarHoveredLayerId: (toolbarHoveredLayerId) => set({ toolbarHoveredLayerId }),
  setSelectedAnnotationId: (id) => set({ selectedAnnotationIds: id ? [id] : [] }),
  setSelectedAnnotationIds: (ids) =>
    set((state) => ({
      selectedAnnotationIds: typeof ids === "function" ? ids(state.selectedAnnotationIds) : ids,
    })),

  setCurrentPage: (n) => {
    const max = get().numPages || 1;
    set({
      currentPage: Math.min(max, Math.max(1, n)),
      selectedAnnotationIds: [],
    });
  },

  setScale: (s) =>
    set({
      scale: Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, s)),
    }),
  setZoomDisplayBaseScale: (s) =>
    set({
      zoomDisplayBaseScale: Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, s)),
    }),

  setTool: (tool) =>
    set((state) => ({
      tool,
      calibrateDraft: tool === "calibrate" ? state.calibrateDraft : [],
      calibrateTargetMm: tool === "calibrate" ? state.calibrateTargetMm : null,
      selectedAnnotationIds: tool === "select" ? state.selectedAnnotationIds : [],
      ...(tool !== "takeoff" ? { takeoffHoverZoneId: null, takeoffHoverItemId: null } : {}),
    })),

  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setTextBoxFillFromFrame: (textBoxFillFromFrame) => set({ textBoxFillFromFrame }),
  setMarkupShape: (markupShape) => set({ markupShape }),
  setMeasureKind: (measureKind) => set({ measureKind }),
  setSnapToGeometry: (snapToGeometry) => set({ snapToGeometry }),
  setSnapRadiusPx: (snapRadiusPx) =>
    set({ snapRadiusPx: Math.min(48, Math.max(0, Math.round(snapRadiusPx))) }),
  setSnapLayerIds: (snapLayerIds) =>
    set({
      snapLayerIds: snapLayerIds === null || snapLayerIds.length === 0 ? null : snapLayerIds,
    }),
  setMeasureUnit: (measureUnit) => set({ measureUnit }),
  setMeasureLabelFontSize: (n) =>
    set({ measureLabelFontSize: Math.min(28, Math.max(6, Math.round(n))) }),
  setMeasureLabelColor: (measureLabelColor) => set({ measureLabelColor }),
  setDisplayName: (displayName) => set({ displayName }),
  setRoomId: (roomId) => set({ roomId }),
  setShowMinimap: (showMinimap) => set({ showMinimap }),
  setMinimapOnlyWhenZoomed: (minimapOnlyWhenZoomed) => set({ minimapOnlyWhenZoomed }),

  requestFit: (mode) => set({ fitRequest: { mode, token: Date.now() } }),
  clearFitRequest: () => set({ fitRequest: null }),

  requestSearchFocus: ({ pageNumber, rectNorm, selectAnnotationId, fitMargin }) =>
    set((state) => {
      const max = state.numPages || 1;
      const pg = Math.min(max, Math.max(1, pageNumber));
      return {
        currentPage: pg,
        selectedAnnotationIds: [],
        searchFocusRequest: {
          pageNumber: pg,
          rectNorm,
          token: Date.now(),
          ...(selectAnnotationId != null && selectAnnotationId !== ""
            ? { selectAnnotationId }
            : {}),
          ...(fitMargin != null ? { fitMargin } : {}),
        },
      };
    }),
  clearSearchFocusRequest: () => set({ searchFocusRequest: null }),

  undo: () =>
    set((state) => {
      if (state.historyPast.length === 0) return state;
      const prev = state.historyPast[state.historyPast.length - 1];
      const newPast = state.historyPast.slice(0, -1);
      const currentSnapshot = cloneSnapshot(state);
      const applied = applySnapshot(prev);
      return {
        historyPast: newPast,
        historyFuture: [currentSnapshot, ...state.historyFuture].slice(0, MAX_HISTORY),
        ...applied,
        selectedAnnotationIds: [],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyFuture.length === 0) return state;
      const next = state.historyFuture[0];
      const newFuture = state.historyFuture.slice(1);
      const currentSnapshot = cloneSnapshot(state);
      const applied = applySnapshot(next);
      return {
        historyPast: [...state.historyPast, currentSnapshot].slice(-MAX_HISTORY),
        historyFuture: newFuture,
        ...applied,
        selectedAnnotationIds: [],
      };
    }),

  addAnnotation: (a) => {
    const incoming = a as Omit<Annotation, "id" | "createdAt"> & { id?: string };
    const id = incoming.id ?? nanoid();
    const restIn = { ...incoming };
    delete (restIn as { id?: string }).id;
    set((state) => {
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations: [
          ...state.annotations,
          {
            ...restIn,
            id,
            createdAt: Date.now(),
            author: restIn.author ?? state.displayName,
          },
        ],
      };
    });
    return id;
  },

  updateAnnotation: (id, patch) =>
    set((state) => {
      if (!state.annotations.some((x) => x.id === id)) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations: state.annotations.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      };
    }),

  removeAnnotation: (id) =>
    set((state) => {
      if (!state.annotations.some((x) => x.id === id)) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations: state.annotations.filter((x) => x.id !== id),
        selectedAnnotationIds: state.selectedAnnotationIds.filter((x) => x !== id),
      };
    }),

  removeAnnotations: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      if (!state.annotations.some((a) => idSet.has(a.id))) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations: state.annotations.filter((a) => !idSet.has(a.id)),
        selectedAnnotationIds: state.selectedAnnotationIds.filter((x) => !idSet.has(x)),
      };
    }),

  copyAnnotationsToClipboard: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      const items = state.annotations
        .filter((a) => idSet.has(a.id))
        .map((a) => annotationToClipboardPayload(a));
      return { markupClipboard: items.length ? items : null };
    }),

  pasteClipboardToPage: (pageIndex0) =>
    set((state) => {
      const src = state.markupClipboard;
      if (!src?.length) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const { w: pageW, h: pageH } = pageSizePts(state.pageSizePtByPage, pageIndex0);
      const mm = state.calibrationByPage[pageIndex0]?.mmPerPdfUnit;
      const OFFSET = 0.002;
      const newOnes: Annotation[] = src.map((item) => {
        let base: Omit<Annotation, "id" | "createdAt"> = {
          ...item,
          pageIndex: pageIndex0,
        };
        base = offsetAnnotationPoints(base, OFFSET, OFFSET);
        if (base.type === "measurement") {
          base = recomputeMeasurementFields(base, pageW, pageH, mm);
        }
        return {
          ...base,
          locked: undefined,
          id: nanoid(),
          createdAt: Date.now(),
          author: base.author ?? state.displayName,
        };
      });
      return {
        historyPast: past,
        historyFuture: [],
        annotations: [...state.annotations, ...newOnes],
        selectedAnnotationIds: newOnes.map((a) => a.id),
      };
    }),

  duplicateAnnotationsOnPage: (pageIndex0, offsetNorm) =>
    set((state) => {
      const selIds = state.selectedAnnotationIds.filter((id) => {
        const a = state.annotations.find((x) => x.id === id);
        return a && a.pageIndex === pageIndex0;
      });
      if (selIds.length === 0) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const { w: pageW, h: pageH } = pageSizePts(state.pageSizePtByPage, pageIndex0);
      const mm = state.calibrationByPage[pageIndex0]?.mmPerPdfUnit;
      const idSet = new Set(selIds);
      const src = state.annotations.filter((a) => idSet.has(a.id));
      const newOnes: Annotation[] = src.map((a) => {
        const payload = annotationToClipboardPayload(a);
        let base = offsetAnnotationPoints(payload, offsetNorm.x, offsetNorm.y);
        if (base.type === "measurement") {
          base = recomputeMeasurementFields(base, pageW, pageH, mm);
        }
        return {
          ...base,
          locked: undefined,
          id: nanoid(),
          createdAt: Date.now(),
          author: base.author ?? state.displayName,
        };
      });
      return {
        historyPast: past,
        historyFuture: [],
        annotations: [...state.annotations, ...newOnes],
        selectedAnnotationIds: newOnes.map((a) => a.id),
      };
    }),

  setAnnotations: (annotations, opts) =>
    set((state) => {
      if (opts?.skipHistory) {
        return { annotations };
      }
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations,
      };
    }),

  setCalibration: (pageIndex, mmPerPdfUnit) =>
    set((state) => {
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        calibrationByPage: {
          ...state.calibrationByPage,
          [pageIndex]: { pageIndex, mmPerPdfUnit },
        },
        calibrateDraft: [],
        calibrateTargetMm: null,
      };
    }),

  clearCalibration: (pageIndex) =>
    set((state) => {
      if (!state.calibrationByPage[pageIndex]) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      const next = { ...state.calibrationByPage };
      delete next[pageIndex];
      return {
        historyPast: past,
        historyFuture: [],
        calibrationByPage: next,
      };
    }),

  setCalibrateDraft: (calibrateDraft) => set({ calibrateDraft }),
  setCalibrateTargetMm: (calibrateTargetMm) => set({ calibrateTargetMm }),

  resetSession: () =>
    set({
      pdfUrl: null,
      fileName: null,
      fileSizeBytes: null,
      cloudFileVersionId: null,
      viewerProjectId: null,
      viewerOperationsMode: false,
      pendingProSidebarTab: null,
      issuePlacement: null,
      newIssuePlacementActive: false,
      issueCreateDraft: null,
      omAssetPlacementActive: false,
      omAssetCreateDraft: null,
      issuesSidebarFocusIssueId: null,
      issuePinLinkInFlightIssueId: null,
      numPages: 0,
      currentPage: 1,
      tool: "pan",
      zoomDisplayBaseScale: 1,
      annotations: [],
      calibrationByPage: {},
      calibrateDraft: [],
      calibrateTargetMm: null,
      markupClipboard: null,
      selectedAnnotationIds: [],
      pageSizePtByPage: {},
      historyPast: [],
      historyFuture: [],
      fitRequest: null,
      searchFocusRequest: null,
      takeoffMode: false,
      takeoffDrawKind: "area",
      takeoffAreaMode: "polygon",
      takeoffItems: [],
      takeoffZones: [],
      takeoffSelectedItemId: null,
      takeoffSelectedZoneIds: [],
      takeoffDeletedZonesUndo: null,
      takeoffHoverZoneId: null,
      takeoffHoverItemId: null,
      takeoffPenColor: DEFAULT_TAKEOFF_COLOR,
      takeoffInventoryDrawerFromSidebar: false,
      takeoffInventoryExpandNonce: 0,
      sheetAiDrawerFromSidebar: false,
      sheetAiExpandNonce: 0,
      takeoffPendingGeometry: null,
      takeoffSliderOpen: false,
      takeoffSliderManualOnly: false,
      takeoffEditingZoneId: null,
      takeoffPackageStatus: "draft",
      takeoffSummaryOpen: false,
      takeoffCountDraftPoints: null,
      takeoffRedrawZoneId: null,
      takeoffMoveZoneId: null,
      takeoffVertexEditZoneId: null,
      mobileLeftToolsOpen: false,
      compareMode: false,
      comparePage: 1,
      compareLayout: "sideBySide",
      compareOverlayAfter: true,
      compareSwipeRatio: 0.5,
      rightFlyout: null,
      leftSidebarTab: "draw",
    }),

  clearPersistedMarkupForCurrentDocument: () => {
    const fvId = get().cloudFileVersionId;
    if (fvId && typeof window !== "undefined") {
      void putViewerState(
        fvId,
        {
          annotations: [],
          calibrationByPage: {},
          takeoffItems: [],
          takeoffZones: [],
          takeoffPackageStatus: "draft",
        },
        { skipRevisionCheck: true },
      ).catch(() => {
        /* offline / quota */
      });
    }
    clearPersistedSession();
    set({
      annotations: [],
      calibrationByPage: {},
      calibrateDraft: [],
      calibrateTargetMm: null,
      markupClipboard: null,
      selectedAnnotationIds: [],
      historyPast: [],
      historyFuture: [],
      takeoffItems: [],
      takeoffZones: [],
      takeoffSelectedItemId: null,
      takeoffSelectedZoneIds: [],
      takeoffDeletedZonesUndo: null,
      takeoffHoverZoneId: null,
      takeoffHoverItemId: null,
      takeoffInventoryDrawerFromSidebar: false,
      takeoffInventoryExpandNonce: 0,
      sheetAiDrawerFromSidebar: false,
      sheetAiExpandNonce: 0,
      takeoffPendingGeometry: null,
      takeoffSliderOpen: false,
      takeoffSliderManualOnly: false,
      takeoffEditingZoneId: null,
      takeoffPackageStatus: "draft",
      takeoffSummaryOpen: false,
      takeoffCountDraftPoints: null,
      takeoffAreaMode: "polygon",
    });
  },

  deleteAllMarkupsOnPage: (pageIndex0) =>
    set((state) => {
      const next = state.annotations.filter(
        (a) =>
          a.type === "measurement" ||
          annotationIsProtectedSheetPin(a) ||
          a.pageIndex !== pageIndex0,
      );
      if (next.length === state.annotations.length) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations: next,
        selectedAnnotationIds: [],
      };
    }),

  deleteAllMarkupsInDocument: () =>
    set((state) => {
      const next = state.annotations.filter(
        (a) => a.type === "measurement" || annotationIsProtectedSheetPin(a),
      );
      if (next.length === state.annotations.length) return state;
      const past = [...state.historyPast.slice(-(MAX_HISTORY - 1)), cloneSnapshot(state)];
      return {
        historyPast: past,
        historyFuture: [],
        annotations: next,
        selectedAnnotationIds: [],
      };
    }),

  clearSheetAiFromDrawing: async () => {
    const state = get();
    const sheetAiAnn = state.annotations.filter((a) => a.fromSheetAi === true);
    for (const a of sheetAiAnn) {
      if (a.linkedIssueId && !a.linkedIssueAttachment) {
        try {
          await patchIssue(a.linkedIssueId, { annotationId: null });
        } catch {
          /* offline / permission */
        }
      }
    }
    const annIds = sheetAiAnn.map((a) => a.id);
    if (annIds.length > 0) {
      get().removeAnnotations(annIds);
    }
    const st1 = get();
    const zoneIds = st1.takeoffZones.filter((z) => z.fromSheetAi && !z.locked).map((z) => z.id);
    if (zoneIds.length > 0) {
      get().takeoffRemoveZonesBulk(zoneIds);
    }
    const st2 = get();
    const orphanItemIds = st2.takeoffItems
      .filter((it) => it.fromSheetAi === true && !st2.takeoffZones.some((z) => z.itemId === it.id))
      .map((it) => it.id);
    for (const iid of orphanItemIds) {
      get().takeoffRemoveItem(iid);
    }
  },
}));
