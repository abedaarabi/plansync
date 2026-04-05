"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { setupPdfWorker } from "@/lib/pdf";
import {
  clamp01,
  formatLengthMm,
  formatSignedDeltaMm,
  pdfDistanceUnits,
  pdfLengthPdfUnitsToMm,
  type MeasureUnit,
} from "@/lib/coords";
import { angleAtVertexDeg, polygonAreaMm2, polylineLengthMm } from "@/lib/measureCompute";
import {
  combineCountRedrawPoints,
  computeRawQuantity,
  patchZoneQuantitiesFromPoints,
  rectPolygonFromTwoCornersNorm,
} from "@/lib/takeoffCompute";
import { hitTakeoffAreaVertexIndex, hitTakeoffZone } from "@/lib/takeoffHitTest";
import type { TakeoffMeasurementType } from "@/lib/takeoffTypes";
import {
  dimensionPixelGeometry,
  signedPerpendicularOffsetPdf,
  snapMeasureGridAxisAligned,
  snapMeasureLineEndOrtho,
} from "@/lib/measureGeometry";
import { extractPageSnapGeometry, type SnapSegment } from "@/lib/pdfSnapGeometry";
import { createPageBorderSegments } from "@/lib/pageBorderSnap";
import { computeScaleToFitNormRect, scrollViewportToNorm } from "@/lib/viewScroll";
import { closestOnSegment, findNearestSegment, snapNormalizedPoint } from "@/lib/snap";
import {
  useViewerStore,
  VIEWER_SCALE_MAX,
  VIEWER_SCALE_MIN,
  type MarkupShape,
  type Tool,
} from "@/store/viewerStore";
import {
  filterAnnotationIdsExcludingIssuePins,
  annotationIsIssuePin,
} from "@/lib/annotationIssues";
import {
  annotationSelectionBounds,
  pickAnnotationAt,
  pickAnnotationsInMarquee,
  translateAnnotationPoints,
  unionAnnotationSelectionBounds,
} from "@/lib/annotationHitTest";
import {
  boundsNormFromPoints,
  computeResizePatch,
  getResizeHandles,
  hitResizeHandle,
  textBoxLayoutPx,
  type ResizeHandleKey,
  type TextLayoutPx,
} from "@/lib/annotationResize";
import {
  computeRotationCenterPx,
  forwardRotateHandlePx,
  inverseRotateNorm,
} from "@/lib/annotationRotation";
import { computePdfPageRenderScale, getMaxCanvasDpr } from "@/lib/pdfCanvasRenderScale";
import { highlightStrokeWidthPx } from "@/lib/highlightStroke";
import { cloudRectPathD } from "@/lib/cloudPath";
import { fetchProjectTeam, formatIssueLockHint, patchIssue } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { normRectFromAnnotationPoints } from "@/lib/issueFocus";
import { issueStatusMarkerStrokeHex } from "@/lib/issueStatusStyle";
import { MousePointer2 } from "lucide-react";
import { toast } from "sonner";
import { loadLastCalibrationKnownMm, saveLastCalibrationKnownMm } from "@/lib/sessionPersistence";
import { CalibrateDialog } from "./CalibrateDialog";
import { CalibrateNeededDialog } from "./CalibrateNeededDialog";
import { TextCommentDialog } from "./TextCommentDialog";
import { CommittedAnnotationsSvg } from "./CommittedAnnotationsSvg";
import { TakeoffZonesSvg } from "./TakeoffZonesSvg";
import { SheetContextMenu } from "./SheetContextMenu";
import {
  collabColorForUser,
  collabCursorLabelNudgeY,
  useViewerCollab,
} from "./viewerCollabContext";
import { ViewerUserThumb } from "./ViewerUserThumb";

/** PDF bitmap scale for print only — independent of on-screen zoom. */
const PRINT_PDF_SCALE = 1;

type Props = {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  /** Scrollable region for Pan (hand) tool click-drag */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  /** Exposed for corner minimap (same nodes as internal refs) */
  pageCanvasRef?: RefObject<HTMLCanvasElement | null>;
  pageWrapperRef?: RefObject<HTMLDivElement | null>;
  /**
   * Compare mode: PDF only — no markups, no measure/calibrate on this pane (pan still scrolls).
   * Use the first stacked pane as the unmodified reference; the second pane is the working view.
   */
  compareReferenceOnly?: boolean;
};

type ResizeSession = {
  id: string;
  handle: ResizeHandleKey;
  startPoints: { x: number; y: number }[];
  startBounds: { minX: number; minY: number; maxX: number; maxY: number };
  startFontSize?: number;
  startTextLayout?: TextLayoutPx;
};

function normFromEvent(e: React.PointerEvent | React.MouseEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const x = clamp01((e.clientX - rect.left) / rect.width);
  const y = clamp01((e.clientY - rect.top) / rect.height);
  return { x, y };
}

/** Must match `normFromEvent`: same box as pointer coords (not clientWidth, which can differ by border/subpixel). */
function overlayCssSizePx(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
}

/** Hit targets for dragging line-measure drafts (CSS px). */
const MEASURE_LINE_POINT_HIT_PX = 14;
const MEASURE_LINE_SEGMENT_HIT_PX = 10;

function clampNorm(p: { x: number; y: number }): { x: number; y: number } {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

function distNormPx(
  a: { x: number; y: number },
  b: { x: number; y: number },
  cssW: number,
  cssH: number,
): number {
  const dx = (a.x - b.x) * cssW;
  const dy = (a.y - b.y) * cssH;
  return Math.hypot(dx, dy);
}

function distNormPointToSegmentPx(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  cssW: number,
  cssH: number,
): number {
  const px = p.x * cssW;
  const py = p.y * cssH;
  const { d2 } = closestOnSegment(px, py, a.x * cssW, a.y * cssH, b.x * cssW, b.y * cssH);
  return Math.sqrt(d2);
}

type MeasureLineDrag =
  | {
      pointerId: number;
      mode: "moveStartPreview" | "moveEndPreview" | "moveStartCommitted" | "moveEndCommitted";
    }
  | {
      pointerId: number;
      mode: "translatePreview";
      originStart: { x: number; y: number };
      originPreview: { x: number; y: number };
      anchorN: { x: number; y: number };
    }
  | {
      pointerId: number;
      mode: "translateCommitted";
      originStart: { x: number; y: number };
      originEnd: { x: number; y: number };
      anchorN: { x: number; y: number };
    };

function diamondPointsFromRectCorners(a: { x: number; y: number }, b: { x: number; y: number }) {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return [
    { x: cx, y: minY },
    { x: maxX, y: cy },
    { x: cx, y: maxY },
    { x: minX, y: cy },
  ];
}

/** Softer snap for continuous strokes (pen / Hi / poly); crisp snap for lines, rects, measure, etc. */
function snapStrokeContext(tool: Tool, markupShape: MarkupShape): "default" | "drawStroke" {
  if (tool !== "annotate") return "default";
  if (markupShape === "freehand" || markupShape === "highlight" || markupShape === "polygon") {
    return "drawStroke";
  }
  return "default";
}

/**
 * Hold Shift for BIM-style horizontal/vertical lock (dominant axis).
 * Otherwise auto-straighten when within a few degrees of an axis.
 */
function measureOrthoEnd(
  shiftKey: boolean,
  from: { x: number; y: number },
  cursor: { x: number; y: number },
  pageW: number,
  pageH: number,
): { x: number; y: number } {
  if (shiftKey) {
    const dx = (cursor.x - from.x) * pageW;
    const dy = (cursor.y - from.y) * pageH;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: cursor.x, y: from.y };
    }
    return { x: from.x, y: cursor.y };
  }
  return snapMeasureLineEndOrtho(from, cursor, pageW, pageH);
}

/** Axis-aligned grid snap: horizontal measures lock X to vertical strokes; vertical to horizontal. */
function snapMeasureLineEndpoint(
  measureStart: { x: number; y: number },
  rawNorm: { x: number; y: number },
  snappedNorm: { x: number; y: number },
  shiftKey: boolean,
  el: HTMLElement,
  pageW: number,
  pageH: number,
  segments: SnapSegment[],
  snapToGeometry: boolean,
  snapRadiusPx: number,
  snapLayerIds: string[] | null,
): { x: number; y: number } {
  const endOrtho = measureOrthoEnd(shiftKey, measureStart, snappedNorm, pageW, pageH);
  if (!snapToGeometry || segments.length === 0) return endOrtho;
  const { w: ow, h: oh } = overlayCssSizePx(el);
  const layerFilter =
    snapLayerIds === null || snapLayerIds.length === 0 ? "all" : new Set(snapLayerIds);
  /** Tight window so grid lines do not pull the chord like hard snap (Bluebeam-style). */
  const gridSnapPx = Math.min(Math.max(3, snapRadiusPx * 0.35), 6);
  return snapMeasureGridAxisAligned(
    measureStart,
    endOrtho,
    rawNorm,
    segments,
    layerFilter,
    ow,
    oh,
    gridSnapPx,
  );
}

function snapNorm(
  nx: number,
  ny: number,
  el: HTMLElement,
  segments: SnapSegment[],
  context: "default" | "drawStroke" = "default",
): { x: number; y: number; snapped: boolean } {
  const st = useViewerStore.getState();
  const calibrateMode = st.tool === "calibrate";
  const measureLikeSnap = st.tool === "measure" || st.tool === "takeoff";
  if ((!st.snapToGeometry && !calibrateMode) || segments.length === 0) {
    return { x: nx, y: ny, snapped: false };
  }
  const { w, h } = overlayCssSizePx(el);
  let rPx = calibrateMode ? Math.max(st.snapRadiusPx, 22) : st.snapRadiusPx;
  if (context === "drawStroke") {
    rPx *= 0.52;
  }
  if (measureLikeSnap) {
    rPx *= 0.58;
  }
  const layerFilter =
    st.snapLayerIds === null || st.snapLayerIds.length === 0 ? "all" : new Set(st.snapLayerIds);
  const blend: "hard" | "soft" = context === "drawStroke" || measureLikeSnap ? "soft" : "hard";
  return snapNormalizedPoint(nx, ny, segments, rPx, w, h, layerFilter, {
    blend,
  });
}

function MeasurementDimensionSvg({
  p1n,
  p2n,
  offsetPdf,
  pageW,
  pageH,
  scale,
  color,
  strokeWidth: sw,
  mm,
  measureUnit,
  labelFontSize,
  labelFill,
  labelOnly,
  subtitle,
}: {
  p1n: { x: number; y: number };
  p2n: { x: number; y: number };
  offsetPdf: number;
  pageW: number;
  pageH: number;
  scale: number;
  color: string;
  strokeWidth: number;
  mm: number;
  measureUnit: MeasureUnit;
  labelFontSize?: number;
  labelFill?: string;
  /** Only the dimension text — no extension lines (use with an existing chord overlay). */
  labelOnly?: boolean;
  /** Second line (e.g. calibration Δ vs target). */
  subtitle?: string | null;
}) {
  const g = dimensionPixelGeometry(p1n, p2n, offsetPdf, pageW, pageH, scale);
  if (!g) return null;
  const labelPad = 10;
  const tx = g.mid.x + g.perpX * labelPad;
  const ty = g.mid.y + g.perpY * labelPad;
  const lf = labelFontSize ?? 11;
  const lfill = labelFill ?? "#3b82f6";
  const label = formatLengthMm(mm, measureUnit);
  if (labelOnly) {
    const subFs = Math.max(8, lf - 1.5);
    return (
      <g>
        <text
          x={tx}
          y={ty}
          fill={lfill}
          fontSize={lf}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={0.35}
          paintOrder="stroke fill"
          className="font-mono"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
        {subtitle ? (
          <text
            x={tx}
            y={ty + lf * 0.85 + subFs * 0.5}
            fill={lfill}
            fontSize={subFs}
            opacity={0.92}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={0.25}
            paintOrder="stroke fill"
            className="font-mono"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {subtitle}
          </text>
        ) : null}
      </g>
    );
  }
  return (
    <g>
      <line
        x1={g.p1.x}
        y1={g.p1.y}
        x2={g.d1.x}
        y2={g.d1.y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="2 4"
        strokeLinecap="round"
        opacity={0.88}
      />
      <line
        x1={g.p2.x}
        y1={g.p2.y}
        x2={g.d2.x}
        y2={g.d2.y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="2 4"
        strokeLinecap="round"
        opacity={0.88}
      />
      <line x1={g.d1.x} y1={g.d1.y} x2={g.d2.x} y2={g.d2.y} stroke={color} strokeWidth={sw} />
      <circle cx={g.p1.x} cy={g.p1.y} r={3.5} fill={color} />
      <circle cx={g.p2.x} cy={g.p2.y} r={3.5} fill={color} />
      <text
        x={tx}
        y={ty}
        fill={lfill}
        fontSize={lf}
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={0.35}
        paintOrder="stroke fill"
        className="font-mono"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}

export function PdfPageView({
  pdfDoc,
  pageNumber,
  scrollContainerRef,
  pageCanvasRef: pageCanvasRefProp,
  pageWrapperRef: pageWrapperRefProp,
  compareReferenceOnly = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);
  const screenRenderTaskRef = useRef<RenderTask | null>(null);
  const printRenderTaskRef = useRef<RenderTask | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pageIdx0 = pageNumber - 1;
  const screenArrowMarkerId = `markup-arrow-screen-${pageIdx0}`;
  const screenArrowMarkerUrl = `url(#${screenArrowMarkerId})`;

  const tool = useViewerStore((s) => s.tool);
  const fileName = useViewerStore((s) => s.fileName);
  const numPages = useViewerStore((s) => s.numPages);
  const scale = useViewerStore((s) => s.scale);
  const strokeColor = useViewerStore((s) => s.strokeColor);
  const strokeWidth = useViewerStore((s) => s.strokeWidth);
  const measureLabelFontSize = useViewerStore((s) => s.measureLabelFontSize);
  const measureLabelColor = useViewerStore((s) => s.measureLabelColor);
  const snapToGeometry = useViewerStore((s) => s.snapToGeometry);
  const snapRadiusPx = useViewerStore((s) => s.snapRadiusPx);
  const snapLayerIds = useViewerStore((s) => s.snapLayerIds);
  const markupShape = useViewerStore((s) => s.markupShape);
  const allAnnotations = useViewerStore((s) => s.annotations);
  const annotations = useMemo(
    () => allAnnotations.filter((a) => a.pageIndex === pageIdx0),
    [allAnnotations, pageIdx0],
  );
  const calibrationByPage = useViewerStore((s) => s.calibrationByPage);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const displayName = useViewerStore((s) => s.displayName);
  const calibrateDraft = useViewerStore((s) => s.calibrateDraft);
  const calibrateTargetMm = useViewerStore((s) => s.calibrateTargetMm);
  const addAnnotation = useViewerStore((s) => s.addAnnotation);
  const updateAnnotation = useViewerStore((s) => s.updateAnnotation);
  const selectedAnnotationIds = useViewerStore((s) => s.selectedAnnotationIds);
  const setSelectedAnnotationIds = useViewerStore((s) => s.setSelectedAnnotationIds);
  const removeAnnotations = useViewerStore((s) => s.removeAnnotations);
  const setCalibration = useViewerStore((s) => s.setCalibration);
  const setCalibrateDraft = useViewerStore((s) => s.setCalibrateDraft);
  const setTool = useViewerStore((s) => s.setTool);
  const setMarkupShape = useViewerStore((s) => s.setMarkupShape);
  const removeAnnotation = useViewerStore((s) => s.removeAnnotation);
  const setPdfSnapLayers = useViewerStore((s) => s.setPdfSnapLayers);
  const toolbarHoveredLayerId = useViewerStore((s) => s.toolbarHoveredLayerId);
  const setToolbarHoveredLayerId = useViewerStore((s) => s.setToolbarHoveredLayerId);
  const setPageSizePt = useViewerStore((s) => s.setPageSizePt);
  const setScale = useViewerStore((s) => s.setScale);
  const copyAnnotationsToClipboard = useViewerStore((s) => s.copyAnnotationsToClipboard);
  const pasteClipboardToPage = useViewerStore((s) => s.pasteClipboardToPage);
  const duplicateAnnotationsOnPage = useViewerStore((s) => s.duplicateAnnotationsOnPage);
  const issuePlacementActive = useViewerStore(
    (s) => s.issuePlacement != null || s.newIssuePlacementActive,
  );
  const setPendingProSidebarTab = useViewerStore((s) => s.setPendingProSidebarTab);
  const setIssuesSidebarFocusIssueId = useViewerStore((s) => s.setIssuesSidebarFocusIssueId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const viewerCollab = useViewerCollab();

  const { data: collabProjectTeam } = useQuery({
    queryKey: qk.projectTeam(viewerProjectId ?? ""),
    queryFn: () => fetchProjectTeam(viewerProjectId!),
    enabled: Boolean(viewerCollab?.collabFeatureEnabled && viewerProjectId),
    staleTime: 30_000,
  });
  const collabPeerByUserId = useMemo(() => {
    const m = new Map<string, { name: string; email: string; image?: string | null }>();
    for (const row of collabProjectTeam?.members ?? []) {
      m.set(row.userId, { name: row.name, email: row.email, image: row.image });
    }
    return m;
  }, [collabProjectTeam?.members]);

  const [pageSize, setPageSize] = useState({ w: 1, h: 1 });
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[] | null>(null);
  /** Normalized cursor position for freehand/highlight brush size preview before stroke starts. */
  const [brushHoverNorm, setBrushHoverNorm] = useState<{ x: number; y: number } | null>(null);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  /** Second point of current segment (after second click); then move adjusts dimension offset before commit. */
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  /** Perpendicular offset of dimension line from chord (PDF user units). */
  const [measureOffsetPdf, setMeasureOffsetPdf] = useState(0);
  const [measurePreview, setMeasurePreview] = useState<{ x: number; y: number } | null>(null);
  const [measureMultiPoints, setMeasureMultiPoints] = useState<{ x: number; y: number }[] | null>(
    null,
  );
  const takeoffDrawKind = useViewerStore((s) => s.takeoffDrawKind);
  const takeoffZonesAll = useViewerStore((s) => s.takeoffZones);
  const takeoffRedrawZoneId = useViewerStore((s) => s.takeoffRedrawZoneId);
  const takeoffItems = useViewerStore((s) => s.takeoffItems);
  const takeoffSelectedZoneIds = useViewerStore((s) => s.takeoffSelectedZoneIds);
  const takeoffSelectedItemId = useViewerStore((s) => s.takeoffSelectedItemId);
  const takeoffPenColor = useViewerStore((s) => s.takeoffPenColor);
  const setTakeoffCountDraftPoints = useViewerStore((s) => s.setTakeoffCountDraftPoints);
  const takeoffCountDraftPoints = useViewerStore((s) => s.takeoffCountDraftPoints);
  const [takeoffLineStart, setTakeoffLineStart] = useState<{ x: number; y: number } | null>(null);
  const [takeoffLinePreview, setTakeoffLinePreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [takeoffAreaPts, setTakeoffAreaPts] = useState<{ x: number; y: number }[] | null>(null);
  const [takeoffAreaPreview, setTakeoffAreaPreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  /** Two-click axis-aligned box area (opposite corners). */
  const [takeoffRectAnchor, setTakeoffRectAnchor] = useState<{ x: number; y: number } | null>(null);
  const [takeoffRectPreview, setTakeoffRectPreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  const takeoffAreaMode = useViewerStore((s) => s.takeoffAreaMode);
  const takeoffMoveZoneId = useViewerStore((s) => s.takeoffMoveZoneId);
  const takeoffVertexEditZoneId = useViewerStore((s) => s.takeoffVertexEditZoneId);
  const takeoffHoverZoneId = useViewerStore((s) => s.takeoffHoverZoneId);
  const takeoffHoverItemId = useViewerStore((s) => s.takeoffHoverItemId);
  const setTakeoffHoverZoneId = useViewerStore((s) => s.setTakeoffHoverZoneId);
  const setTakeoffHoverItemId = useViewerStore((s) => s.setTakeoffHoverItemId);
  const openTakeoffSlider = useViewerStore((s) => s.openTakeoffSlider);
  const takeoffUpdateZone = useViewerStore((s) => s.takeoffUpdateZone);
  const measureKind = useViewerStore((s) => s.measureKind);
  const [lineMarkup, setLineMarkup] = useState<{
    a: { x: number; y: number };
    b?: { x: number; y: number };
  } | null>(null);
  const [rectDrag, setRectDrag] = useState<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  } | null>(null);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [calibrateNeededOpen, setCalibrateNeededOpen] = useState(false);
  const [calibrateKey, setCalibrateKey] = useState(0);
  const [calibratePreview, setCalibratePreview] = useState<{ x: number; y: number } | null>(null);
  const [textCommentOpen, setTextCommentOpen] = useState(false);
  /** When set, {@link TextCommentDialog} updates this text annotation instead of adding one. */
  const [textCommentEditId, setTextCommentEditId] = useState<string | null>(null);
  const [textAnchor, setTextAnchor] = useState<{ x: number; y: number } | null>(null);
  const [sheetContextMenu, setSheetContextMenu] = useState<{
    clientX: number;
    clientY: number;
    norm: { x: number; y: number };
    hitId: string | null;
  } | null>(null);
  const [moveDrag, setMoveDrag] = useState<{
    ids: string[];
    lastN: { x: number; y: number };
  } | null>(null);
  /** Windows-style drag rectangle to select multiple markups. */
  const [selectMarquee, setSelectMarquee] = useState<{
    pointerId: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  /** Drag rectangle → zoom to fit (Zoom area tool). */
  const [zoomMarquee, setZoomMarquee] = useState<{
    pointerId: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  /** Select tool: markup under cursor (highlights before click). */
  const [markupHoverId, setMarkupHoverId] = useState<string | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [resizeActive, setResizeActive] = useState(false);
  const panSessionRef = useRef<{
    startX: number;
    startY: number;
    sl: number;
    st: number;
  } | null>(null);
  /** Dragging line-measure start/end or translating the whole chord before commit. */
  const measureLineDragRef = useRef<MeasureLineDrag | null>(null);
  /**
   * Mirrors {@link measureEnd} but updates synchronously when the second point is placed so
   * pointermove in the same gesture does not use a stale closure (still !measureEnd) and
   * overwrite state with a rubber-band preview — which hid the finished segment until the next click.
   */
  const measureLineDraftEndRef = useRef<{ x: number; y: number } | null>(null);
  const [snapSegments, setSnapSegments] = useState<SnapSegment[]>([]);
  const snapSegmentsRef = useRef<SnapSegment[]>([]);
  useEffect(() => {
    snapSegmentsRef.current = snapSegments;
  }, [snapSegments]);

  /** PDF stroked path index under cursor (full path highlighted, not a single segment). */
  const [snapHoverPathIndex, setSnapHoverPathIndex] = useState<number | null>(null);
  const [polygonMarkup, setPolygonMarkup] = useState<{ x: number; y: number }[] | null>(null);
  const [polygonPreview, setPolygonPreview] = useState<{ x: number; y: number } | null>(null);

  const layerHighlightSegments = useMemo(() => {
    if (!toolbarHoveredLayerId) return [];
    const list = snapSegments.filter((s) => s.layerId === toolbarHoveredLayerId);
    return list.slice(0, 4000);
  }, [snapSegments, toolbarHoveredLayerId]);

  const snapHoverHighlightSegments = useMemo(() => {
    if (snapHoverPathIndex === null) return [];
    return snapSegments.filter((s) => s.pathIndex === snapHoverPathIndex).slice(0, 12_000);
  }, [snapSegments, snapHoverPathIndex]);

  const takeoffItemsById = useMemo(
    () => new Map(takeoffItems.map((i) => [i.id, i])),
    [takeoffItems],
  );
  /** Live takeoff rubber-band always follows sidebar pen color (inventory selection syncs pen to that line). */
  const takeoffDraftColor = takeoffPenColor;
  const [takeoffSnapHint, setTakeoffSnapHint] = useState(false);
  const takeoffZonesOnPage = useMemo(
    () => takeoffZonesAll.filter((z) => z.pageIndex === pageIdx0),
    [takeoffZonesAll, pageIdx0],
  );
  /** During count redraw, draft point labels continue after existing marks in the zone. */
  const countDraftLabelOffset = useMemo(() => {
    if (!takeoffRedrawZoneId) return 0;
    const z = takeoffZonesAll.find((tz) => tz.id === takeoffRedrawZoneId);
    if (!z || z.measurementType !== "count" || z.pageIndex !== pageIdx0) return 0;
    return z.points.length;
  }, [takeoffRedrawZoneId, takeoffZonesAll, pageIdx0]);
  const [takeoffMoveSession, setTakeoffMoveSession] = useState<null | {
    zoneId: string;
    pointerId: number;
    anchorRaw: { x: number; y: number };
    originPoints: { x: number; y: number }[];
  }>(null);
  const [takeoffMovePreviewPoints, setTakeoffMovePreviewPoints] = useState<
    { x: number; y: number }[] | null
  >(null);
  const [takeoffVertexSession, setTakeoffVertexSession] = useState<null | {
    zoneId: string;
    vertexIndex: number;
    pointerId: number;
    originPoints: { x: number; y: number }[];
  }>(null);
  const [takeoffVertexPreviewPoints, setTakeoffVertexPreviewPoints] = useState<
    { x: number; y: number }[] | null
  >(null);
  const takeoffZonesForView = useMemo(() => {
    if (takeoffMovePreviewPoints && takeoffMoveSession) {
      const id = takeoffMoveSession.zoneId;
      return takeoffZonesOnPage.map((z) =>
        z.id === id ? { ...z, points: takeoffMovePreviewPoints } : z,
      );
    }
    if (takeoffVertexPreviewPoints && takeoffVertexSession) {
      const id = takeoffVertexSession.zoneId;
      return takeoffZonesOnPage.map((z) =>
        z.id === id ? { ...z, points: takeoffVertexPreviewPoints } : z,
      );
    }
    return takeoffZonesOnPage;
  }, [
    takeoffZonesOnPage,
    takeoffMovePreviewPoints,
    takeoffMoveSession,
    takeoffVertexPreviewPoints,
    takeoffVertexSession,
  ]);

  useEffect(() => {
    measureLineDraftEndRef.current = measureEnd;
  }, [measureEnd]);

  const cancelInteraction = useCallback(() => {
    setDraftPoints(null);
    setRectDrag(null);
    setLineMarkup(null);
    measureLineDraftEndRef.current = null;
    setMeasureStart(null);
    setMeasureEnd(null);
    setMeasureOffsetPdf(0);
    setMeasurePreview(null);
    setMeasureMultiPoints(null);
    setCalibrateDraft([]);
    setCalibrateOpen(false);
    setTextCommentOpen(false);
    setTextCommentEditId(null);
    setTextAnchor(null);
    setSheetContextMenu(null);
    setSelectedAnnotationIds([]);
    setMoveDrag(null);
    setSelectMarquee(null);
    setZoomMarquee(null);
    resizeSessionRef.current = null;
    setResizeActive(false);
    setSnapHoverPathIndex(null);
    setCalibratePreview(null);
    setPolygonMarkup(null);
    setPolygonPreview(null);
    setBrushHoverNorm(null);
    measureLineDragRef.current = null;
    setTakeoffLineStart(null);
    setTakeoffLinePreview(null);
    setTakeoffAreaPts(null);
    setTakeoffAreaPreview(null);
    setTakeoffRectAnchor(null);
    setTakeoffRectPreview(null);
    setTakeoffCountDraftPoints(null);
    setTakeoffSnapHint(false);
    setTakeoffMoveSession(null);
    setTakeoffMovePreviewPoints(null);
    setTakeoffVertexSession(null);
    setTakeoffVertexPreviewPoints(null);
  }, [setCalibrateDraft, setSelectedAnnotationIds, setTakeoffCountDraftPoints]);

  const commitTakeoffDrawOrRedraw = useCallback(
    (
      kind: TakeoffMeasurementType,
      points: { x: number; y: number }[],
      opts?: { countRedrawMode?: "merge" | "replace" },
    ) => {
      const cal = calibrationByPage[pageIdx0];
      if (!cal) return;
      const st = useViewerStore.getState();
      const rid = st.takeoffRedrawZoneId;
      if (rid) {
        const z = st.takeoffZones.find((x) => x.id === rid);
        const item = z ? st.takeoffItems.find((i) => i.id === z.itemId) : undefined;
        if (!z || !item || z.locked || z.pageIndex !== pageIdx0 || z.measurementType !== kind) {
          st.setTakeoffRedrawZoneId(null);
          toast.error("Could not update this zone. Redraw cancelled.");
          return;
        }
        const countMode = opts?.countRedrawMode ?? "merge";
        const geomPoints =
          kind === "count" && z.measurementType === "count"
            ? combineCountRedrawPoints(z.points, points, countMode)
            : points;
        const {
          points: np,
          rawQuantity,
          computedQuantity,
        } = patchZoneQuantitiesFromPoints(
          z,
          item,
          geomPoints,
          pageSize.w,
          pageSize.h,
          cal.mmPerPdfUnit,
        );
        takeoffUpdateZone(rid, { points: np, rawQuantity, computedQuantity });
        st.setTakeoffRedrawZoneId(null);
        if (kind === "count") {
          toast.success(
            countMode === "replace"
              ? "Count marks replaced."
              : "New marks added to this count zone.",
          );
        } else {
          toast.success("Zone shape updated.");
        }
        openTakeoffSlider({ editZoneId: rid });
        return;
      }
      const rawGeom = computeRawQuantity(kind, points, pageSize.w, pageSize.h, cal.mmPerPdfUnit);
      openTakeoffSlider({
        pending: {
          kind,
          pageIndex: pageIdx0,
          points: points.map((p) => ({ ...p })),
          rawQuantity: rawGeom,
          computedQuantity: 0,
        },
      });
    },
    [calibrationByPage, pageIdx0, pageSize.w, pageSize.h, takeoffUpdateZone, openTakeoffSlider],
  );

  /** Commits one line segment and continues the chain from its end (BIM-style multi-target). */
  const commitLineSegment = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }, offsetPdf: number) => {
      const cal = calibrationByPage[pageIdx0];
      if (!cal) return;
      const pdfD = pdfDistanceUnits(start, end, pageSize.w, pageSize.h);
      if (pdfD < 1e-9) return;
      const mm = pdfD * cal.mmPerPdfUnit;
      addAnnotation({
        pageIndex: pageIdx0,
        type: "measurement",
        measurementKind: "line",
        color: measureLabelColor,
        strokeWidth,
        fontSize: measureLabelFontSize,
        textColor: measureLabelColor,
        points: [start, end],
        lengthMm: mm,
        dimensionOffsetPdf: offsetPdf,
        author: displayName,
      });
      setMeasureStart(end);
      setMeasureEnd(null);
      setMeasureOffsetPdf(0);
      setMeasurePreview(null);
    },
    [
      calibrationByPage,
      pageIdx0,
      pageSize.w,
      pageSize.h,
      addAnnotation,
      displayName,
      measureLabelColor,
      strokeWidth,
      measureLabelFontSize,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      const inField =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (e.key === "Enter" && tool === "measure" && !inField) {
        if (measureKind === "line") {
          if (measureStart && measureEnd) {
            e.preventDefault();
            commitLineSegment(measureStart, measureEnd, measureOffsetPdf);
            return;
          }
          if (measureStart && !measureEnd) {
            e.preventDefault();
            setMeasureStart(null);
            setMeasurePreview(null);
            setMeasureOffsetPdf(0);
          }
          return;
        }
        const cal = calibrationByPage[pageIdx0];
        if (measureKind === "area" && measureMultiPoints && measureMultiPoints.length >= 3 && cal) {
          e.preventDefault();
          const areaMm2 = polygonAreaMm2(
            measureMultiPoints,
            pageSize.w,
            pageSize.h,
            cal.mmPerPdfUnit,
          );
          addAnnotation({
            pageIndex: pageIdx0,
            type: "measurement",
            measurementKind: "area",
            color: measureLabelColor,
            strokeWidth,
            fontSize: measureLabelFontSize,
            textColor: measureLabelColor,
            points: measureMultiPoints.map((p) => ({ ...p })),
            areaMm2,
            author: displayName,
          });
          setMeasureMultiPoints(null);
          setMeasurePreview(null);
          return;
        }
        if (
          measureKind === "perimeter" &&
          measureMultiPoints &&
          measureMultiPoints.length >= 2 &&
          cal
        ) {
          e.preventDefault();
          const lengthMm = polylineLengthMm(
            measureMultiPoints,
            pageSize.w,
            pageSize.h,
            cal.mmPerPdfUnit,
          );
          addAnnotation({
            pageIndex: pageIdx0,
            type: "measurement",
            measurementKind: "perimeter",
            color: measureLabelColor,
            strokeWidth,
            fontSize: measureLabelFontSize,
            textColor: measureLabelColor,
            points: measureMultiPoints.map((p) => ({ ...p })),
            lengthMm,
            author: displayName,
          });
          setMeasureMultiPoints(null);
          setMeasurePreview(null);
          return;
        }
      }
      if (e.key === "Enter" && tool === "takeoff" && !inField) {
        const calK = calibrationByPage[pageIdx0];
        if (
          calK &&
          takeoffDrawKind === "area" &&
          useViewerStore.getState().takeoffAreaMode === "polygon" &&
          takeoffAreaPts &&
          takeoffAreaPts.length >= 3
        ) {
          e.preventDefault();
          commitTakeoffDrawOrRedraw(
            "area",
            takeoffAreaPts.map((p) => ({ ...p })),
          );
          setTakeoffAreaPts(null);
          setTakeoffAreaPreview(null);
          return;
        }
        if (takeoffDrawKind === "count") {
          const pts = useViewerStore.getState().takeoffCountDraftPoints;
          if (pts && pts.length > 0 && calK) {
            e.preventDefault();
            commitTakeoffDrawOrRedraw(
              "count",
              pts.map((p) => ({ ...p })),
              {
                countRedrawMode: "merge",
              },
            );
            useViewerStore.getState().setTakeoffCountDraftPoints(null);
          }
        }
      }
      if (e.key === "Enter" && tool === "annotate" && markupShape === "polygon" && !inField) {
        const pts = polygonMarkup;
        if (pts && pts.length >= 3) {
          e.preventDefault();
          addAnnotation({
            pageIndex: pageIdx0,
            type: "polygon",
            color: strokeColor,
            strokeWidth,
            points: pts.map((p) => ({ ...p })),
            author: displayName,
          });
          setPolygonMarkup(null);
          setPolygonPreview(null);
          return;
        }
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "a" && tool === "select" && !inField) {
        e.preventDefault();
        setSelectedAnnotationIds(annotations.map((a) => a.id));
        return;
      }
      if (
        mod &&
        e.key === "c" &&
        tool === "select" &&
        selectedAnnotationIds.length > 0 &&
        !inField
      ) {
        e.preventDefault();
        copyAnnotationsToClipboard(selectedAnnotationIds);
        return;
      }
      if (mod && e.key === "v" && !inField) {
        e.preventDefault();
        pasteClipboardToPage(pageIdx0);
        return;
      }
      if (
        mod &&
        e.key === "d" &&
        tool === "select" &&
        selectedAnnotationIds.length > 0 &&
        !inField
      ) {
        e.preventDefault();
        duplicateAnnotationsOnPage(pageIdx0, { x: 0.002, y: 0.002 });
        return;
      }

      if (
        tool === "select" &&
        selectedAnnotationIds.length > 0 &&
        !inField &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        const stepPx = e.shiftKey ? 10 : 1;
        const cssW0 = pageSize.w * scale;
        const cssH0 = pageSize.h * scale;
        const dnx =
          e.key === "ArrowLeft" ? -stepPx / cssW0 : e.key === "ArrowRight" ? stepPx / cssW0 : 0;
        const dny =
          e.key === "ArrowUp" ? -stepPx / cssH0 : e.key === "ArrowDown" ? stepPx / cssH0 : 0;
        if (Math.abs(dnx) > 1e-15 || Math.abs(dny) > 1e-15) {
          e.preventDefault();
          const st = useViewerStore.getState();
          for (const id of selectedAnnotationIds) {
            const ann = st.annotations.find((x) => x.id === id);
            if (!ann || ann.pageIndex !== pageIdx0 || ann.locked) continue;
            updateAnnotation(id, {
              points: translateAnnotationPoints(ann.points, dnx, dny),
            });
          }
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && tool === "measure" && !inField) {
        const mk = measureKind;
        if (mk === "line") {
          e.preventDefault();
          measureLineDragRef.current = null;
          if (measureEnd) {
            setMeasureEnd(null);
            setMeasurePreview(null);
            setMeasureOffsetPdf(0);
          } else if (measureStart) {
            setMeasureStart(null);
            setMeasurePreview(null);
            setMeasureOffsetPdf(0);
          }
          return;
        }
        if (mk === "area" || mk === "perimeter" || mk === "angle") {
          if (measureMultiPoints && measureMultiPoints.length > 0) {
            e.preventDefault();
            const next = measureMultiPoints.slice(0, -1);
            setMeasureMultiPoints(next.length ? next : null);
            setMeasurePreview(null);
            return;
          }
        }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && tool === "takeoff" && !inField) {
        e.preventDefault();
        if (
          takeoffDrawKind === "area" &&
          useViewerStore.getState().takeoffAreaMode === "box" &&
          takeoffRectAnchor
        ) {
          setTakeoffRectAnchor(null);
          setTakeoffRectPreview(null);
          return;
        }
        if (takeoffDrawKind === "area" && takeoffAreaPts && takeoffAreaPts.length > 0) {
          const next = takeoffAreaPts.slice(0, -1);
          setTakeoffAreaPts(next.length ? next : null);
          setTakeoffAreaPreview(null);
          return;
        }
        if (takeoffDrawKind === "count") {
          const t = useViewerStore.getState().takeoffCountDraftPoints;
          if (t && t.length > 0) {
            useViewerStore.getState().setTakeoffCountDraftPoints(t.slice(0, -1));
          }
          return;
        }
        if (takeoffDrawKind === "linear") {
          setTakeoffLineStart(null);
          setTakeoffLinePreview(null);
        }
        return;
      }

      if (e.key === "Escape" && textCommentOpen) {
        e.preventDefault();
        setTextCommentOpen(false);
        setTextAnchor(null);
        setTextCommentEditId(null);
        return;
      }
      if (e.key === "Escape" && sheetContextMenu) {
        e.preventDefault();
        setSheetContextMenu(null);
        return;
      }
      if (e.key === "Escape" && useViewerStore.getState().newIssuePlacementActive) {
        e.preventDefault();
        useViewerStore.getState().setNewIssuePlacementActive(false);
        return;
      }
      if (e.key === "Escape" && useViewerStore.getState().issuePlacement) {
        e.preventDefault();
        useViewerStore.getState().setIssuePlacement(null);
        return;
      }
      if (e.key === "Escape" && !inField) {
        const stTk = useViewerStore.getState();
        if (stTk.takeoffRedrawZoneId || stTk.takeoffMoveZoneId || stTk.takeoffVertexEditZoneId) {
          e.preventDefault();
          stTk.setTakeoffRedrawZoneId(null);
          stTk.setTakeoffMoveZoneId(null);
          stTk.setTakeoffVertexEditZoneId(null);
          setTakeoffLineStart(null);
          setTakeoffLinePreview(null);
          setTakeoffAreaPts(null);
          setTakeoffAreaPreview(null);
          setTakeoffRectAnchor(null);
          setTakeoffRectPreview(null);
          stTk.setTakeoffCountDraftPoints(null);
          setTakeoffMoveSession(null);
          setTakeoffMovePreviewPoints(null);
          setTakeoffVertexSession(null);
          setTakeoffVertexPreviewPoints(null);
          toast.message("Takeoff shape edit cancelled.");
          return;
        }
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        tool === "select" &&
        selectedAnnotationIds.length > 0 &&
        !inField
      ) {
        e.preventDefault();
        const st0 = useViewerStore.getState();
        const toRemove = filterAnnotationIdsExcludingIssuePins(
          st0.annotations,
          selectedAnnotationIds,
        );
        if (toRemove.length > 0) removeAnnotations(toRemove);
        return;
      }
      if (e.key !== "Escape") return;
      if (inField) return;
      e.preventDefault();
      cancelInteraction();
      setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cancelInteraction,
    tool,
    measureKind,
    measureStart,
    measureEnd,
    measureOffsetPdf,
    commitLineSegment,
    measureMultiPoints,
    calibrationByPage,
    pageIdx0,
    pageSize.w,
    pageSize.h,
    scale,
    addAnnotation,
    displayName,
    textCommentOpen,
    sheetContextMenu,
    selectedAnnotationIds,
    annotations,
    removeAnnotations,
    strokeColor,
    strokeWidth,
    measureLabelFontSize,
    measureLabelColor,
    markupShape,
    polygonMarkup,
    setTool,
    copyAnnotationsToClipboard,
    pasteClipboardToPage,
    duplicateAnnotationsOnPage,
    setSelectedAnnotationIds,
    updateAnnotation,
    setMeasureEnd,
    setMeasureStart,
    setMeasureMultiPoints,
    setMeasurePreview,
    setMeasureOffsetPdf,
    takeoffDrawKind,
    takeoffAreaPts,
    takeoffRectAnchor,
    commitTakeoffDrawOrRedraw,
    setTakeoffAreaPts,
    setTakeoffAreaPreview,
  ]);

  useEffect(() => {
    let cancelled = false;
    setPdfSnapLayers([]);
    setSnapSegments([]);
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      setupPdfWorker(pdfjs);
      const page = await pdfDoc.getPage(pageNumber);
      const vp = page.getViewport({ scale: 1 });
      try {
        const { segments, layers } = await extractPageSnapGeometry(page, vp);
        if (cancelled) return;
        setSnapSegments([...segments, ...createPageBorderSegments()]);
        setPdfSnapLayers(layers);
      } catch {
        if (!cancelled) {
          setSnapSegments(createPageBorderSegments());
          setPdfSnapLayers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, setPdfSnapLayers]);

  useEffect(() => {
    setToolbarHoveredLayerId(null);
  }, [pageNumber, setToolbarHoveredLayerId]);

  useEffect(() => {
    if (tool !== "select") setMarkupHoverId(null);
  }, [tool]);

  useEffect(() => {
    if (compareReferenceOnly) setMarkupHoverId(null);
  }, [compareReferenceOnly]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      setupPdfWorker(pdfjs);
      const page = await pdfDoc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      if (cancelled) return;
      setPageSize({ w: base.width, h: base.height });
      setPageSizePt(pageIdx0, base.width, base.height);

      const dpr = Math.min(
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        getMaxCanvasDpr(),
      );
      const renderScale = computePdfPageRenderScale(base.width, base.height, scale, dpr);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (cancelled) return;

      screenRenderTaskRef.current?.cancel();
      const task = page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      });
      screenRenderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        /* cancelled or aborted */
      }
      if (cancelled) return;
      if (screenRenderTaskRef.current === task) {
        screenRenderTaskRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      screenRenderTaskRef.current?.cancel();
      screenRenderTaskRef.current = null;
    };
  }, [pdfDoc, pageNumber, scale, pageIdx0, setPageSizePt]);

  const renderPrintPageToCanvas = useCallback(async () => {
    if (compareReferenceOnly) return;
    printRenderTaskRef.current?.cancel();
    printRenderTaskRef.current = null;
    const pdfjs = await import("pdfjs-dist");
    setupPdfWorker(pdfjs);
    const page = await pdfDoc.getPage(pageNumber);
    const printDpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      getMaxCanvasDpr(),
    );
    const viewport = page.getViewport({ scale: PRINT_PDF_SCALE * printDpr });
    const canvas = printCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const task = page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    });
    printRenderTaskRef.current = task;
    try {
      await task.promise;
    } catch {
      /* cancelled or aborted */
    } finally {
      if (printRenderTaskRef.current === task) {
        printRenderTaskRef.current = null;
      }
    }
  }, [pdfDoc, pageNumber, compareReferenceOnly]);

  useEffect(() => {
    if (compareReferenceOnly) return;
    void renderPrintPageToCanvas();
    return () => {
      printRenderTaskRef.current?.cancel();
      printRenderTaskRef.current = null;
    };
  }, [renderPrintPageToCanvas, compareReferenceOnly]);

  useEffect(() => {
    const onBeforePrint = () => {
      void renderPrintPageToCanvas();
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [renderPrintPageToCanvas]);

  useEffect(() => {
    if (tool !== "annotate") {
      setLineMarkup(null);
      setRectDrag(null);
      setDraftPoints(null);
      setPolygonMarkup(null);
      setPolygonPreview(null);
    }
  }, [tool]);

  /** Sync Issues sidebar: focus + tab when a single issue pin is selected on this page. */
  useEffect(() => {
    if (tool !== "select" || selectedAnnotationIds.length !== 1) {
      setIssuesSidebarFocusIssueId(null);
      return;
    }
    const ann = annotations.find((a) => a.id === selectedAnnotationIds[0]);
    if (!ann || !annotationIsIssuePin(ann)) {
      setIssuesSidebarFocusIssueId(null);
      return;
    }
    setPendingProSidebarTab("issues");
    setIssuesSidebarFocusIssueId(ann.linkedIssueId ?? null);
  }, [
    tool,
    selectedAnnotationIds,
    annotations,
    setPendingProSidebarTab,
    setIssuesSidebarFocusIssueId,
  ]);

  useEffect(() => {
    setLineMarkup(null);
    setRectDrag(null);
    setDraftPoints(null);
    setPolygonMarkup(null);
    setPolygonPreview(null);
  }, [markupShape]);

  useEffect(() => {
    if (tool !== "measure") {
      measureLineDraftEndRef.current = null;
      setMeasureStart(null);
      setMeasureEnd(null);
      setMeasureOffsetPdf(0);
      setMeasurePreview(null);
      setMeasureMultiPoints(null);
    }
  }, [tool]);

  useEffect(() => {
    if (tool !== "takeoff") {
      const st = useViewerStore.getState();
      st.setTakeoffRedrawZoneId(null);
      st.setTakeoffMoveZoneId(null);
      st.setTakeoffVertexEditZoneId(null);
      setTakeoffLineStart(null);
      setTakeoffLinePreview(null);
      setTakeoffAreaPts(null);
      setTakeoffAreaPreview(null);
      setTakeoffRectAnchor(null);
      setTakeoffRectPreview(null);
      setTakeoffCountDraftPoints(null);
      setTakeoffSnapHint(false);
      setTakeoffMoveSession(null);
      setTakeoffMovePreviewPoints(null);
      setTakeoffVertexSession(null);
      setTakeoffVertexPreviewPoints(null);
    }
  }, [tool, setTakeoffCountDraftPoints]);

  useEffect(() => {
    setTakeoffLineStart(null);
    setTakeoffLinePreview(null);
    setTakeoffAreaPts(null);
    setTakeoffAreaPreview(null);
    setTakeoffRectAnchor(null);
    setTakeoffRectPreview(null);
    setTakeoffCountDraftPoints(null);
    setTakeoffSnapHint(false);
  }, [pageNumber, setTakeoffCountDraftPoints]);

  useEffect(() => {
    setTakeoffAreaPts(null);
    setTakeoffAreaPreview(null);
    setTakeoffRectAnchor(null);
    setTakeoffRectPreview(null);
    setTakeoffLineStart(null);
    setTakeoffLinePreview(null);
    setTakeoffSnapHint(false);
  }, [takeoffDrawKind]);

  useEffect(() => {
    setTakeoffAreaPts(null);
    setTakeoffAreaPreview(null);
    setTakeoffRectAnchor(null);
    setTakeoffRectPreview(null);
    setTakeoffSnapHint(false);
  }, [takeoffAreaMode]);

  useEffect(() => {
    measureLineDraftEndRef.current = null;
    setMeasureStart(null);
    setMeasureEnd(null);
    setMeasureOffsetPdf(0);
    setMeasurePreview(null);
    setMeasureMultiPoints(null);
  }, [measureKind]);

  useEffect(() => {
    if (tool !== "select") {
      setMoveDrag(null);
      resizeSessionRef.current = null;
      setResizeActive(false);
    }
  }, [tool]);

  useEffect(() => {
    if (tool !== "pan") panSessionRef.current = null;
    if (tool !== "zoomArea") setZoomMarquee(null);
  }, [tool]);

  useEffect(() => {
    if (tool !== "calibrate") setCalibratePreview(null);
  }, [tool]);

  useEffect(() => {
    if (calibrateOpen) setCalibratePreview(null);
  }, [calibrateOpen]);

  const pointerDrawing =
    tool === "annotate" && (markupShape === "freehand" || markupShape === "highlight");

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = overlayRef.current;
      if (!el) return;
      if (compareReferenceOnly && tool !== "pan") return;

      const stPl = useViewerStore.getState();
      if (stPl.newIssuePlacementActive && !compareReferenceOnly) {
        if (pageSize.w === 1 && pageSize.h === 1) return;
        const elPl = e.currentTarget as HTMLDivElement;
        const rawPl = normFromEvent(e, elPl);
        const snPl = { x: rawPl.x, y: rawPl.y, snapped: false };
        const cssWPl = pageSize.w * scale;
        const cssHPl = pageSize.h * scale;
        const pinRadPx = 4;
        const dxN = pinRadPx / cssWPl;
        const dyN = pinRadPx / cssHPl;
        const strokeHex = issueStatusMarkerStrokeHex("OPEN");
        const st0 = useViewerStore.getState();
        const newId = st0.addAnnotation({
          pageIndex: pageIdx0,
          type: "ellipse",
          color: strokeHex,
          strokeWidth: 0,
          points: [
            { x: snPl.x - dxN, y: snPl.y - dyN },
            { x: snPl.x + dxN, y: snPl.y + dyN },
          ],
          linkedIssueTitle: "New issue",
          issueStatus: "OPEN",
          issueDraft: true,
          author: displayName,
        });
        st0.setNewIssuePlacementActive(false);
        st0.setIssueCreateDraft({ annotationId: newId });
        st0.setPendingProSidebarTab("issues");
        st0.setSelectedAnnotationId(newId);
        e.preventDefault();
        return;
      }

      const issuePl = useViewerStore.getState().issuePlacement;
      if (issuePl && !compareReferenceOnly) {
        if (pageSize.w === 1 && pageSize.h === 1) return;
        const stGuard = useViewerStore.getState();
        if (stGuard.issuePinLinkInFlightIssueId === issuePl.issueId) {
          e.preventDefault();
          toast.message("Still saving the last pin for this issue…");
          return;
        }
        const elPl = e.currentTarget as HTMLDivElement;
        const rawPl = normFromEvent(e, elPl);
        const snPl = { x: rawPl.x, y: rawPl.y, snapped: false };
        const cssWPl = pageSize.w * scale;
        const cssHPl = pageSize.h * scale;
        const pinRadPx = 4;
        const dxN = pinRadPx / cssWPl;
        const dyN = pinRadPx / cssHPl;
        const strokeHex = issueStatusMarkerStrokeHex(issuePl.status);
        const st0 = useViewerStore.getState();
        st0.setIssuePinLinkInFlightIssueId(issuePl.issueId);
        const newId = st0.addAnnotation({
          pageIndex: pageIdx0,
          type: "ellipse",
          color: strokeHex,
          strokeWidth: 0,
          points: [
            { x: snPl.x - dxN, y: snPl.y - dyN },
            { x: snPl.x + dxN, y: snPl.y + dyN },
          ],
          linkedIssueId: issuePl.issueId,
          issueStatus: issuePl.status,
          linkedIssueTitle: issuePl.title,
          author: displayName,
        });
        st0.setIssuePlacement(null);
        e.preventDefault();
        const replaceId = issuePl.replaceAnnotationId;
        const linkedIssueId = issuePl.issueId;
        void patchIssue(issuePl.issueId, {
          annotationId: newId,
          pageNumber: pageIdx0 + 1,
        })
          .then(() => {
            const st1 = useViewerStore.getState();
            const dupIds = st1.annotations
              .filter((a) => {
                if (a.id === newId || a.type === "measurement" || a.issueDraft) return false;
                if (a.linkedIssueId === linkedIssueId) return true;
                if (replaceId && a.id === replaceId) return true;
                return false;
              })
              .map((a) => a.id);
            if (dupIds.length) st1.removeAnnotations(dupIds);
            toast.success("Issue pinned on the sheet.");
            const ann = st1.annotations.find((a) => a.id === newId);
            if (ann) {
              const rect = normRectFromAnnotationPoints(ann.points);
              st1.requestSearchFocus({
                pageNumber: ann.pageIndex + 1,
                rectNorm: rect,
                selectAnnotationId: ann.id,
              });
              st1.setPendingProSidebarTab("issues");
            }
          })
          .catch((err) => {
            useViewerStore.getState().removeAnnotation(newId);
            toast.error(formatIssueLockHint(err));
          })
          .finally(() => {
            useViewerStore.getState().setIssuePinLinkInFlightIssueId(null);
          });
        return;
      }

      const raw = normFromEvent(e, el);
      /** Measure & takeoff: snap to PDF geometry by default. Hold Alt for raw placement. */
      const sn =
        (tool === "measure" || tool === "takeoff") && e.altKey
          ? { x: raw.x, y: raw.y, snapped: false }
          : snapNorm(
              raw.x,
              raw.y,
              el,
              snapSegmentsRef.current,
              snapStrokeContext(tool, markupShape),
            );
      const cssW = pageSize.w * scale;
      const cssH = pageSize.h * scale;

      if (tool === "takeoff") {
        const calT = calibrationByPage[pageIdx0];
        if (!calT) {
          setCalibrateNeededOpen(true);
          return;
        }
        const st = useViewerStore.getState();
        const vertexEditId = st.takeoffVertexEditZoneId;
        const moveTargetId = st.takeoffMoveZoneId;
        const redrawTargetId = st.takeoffRedrawZoneId;

        if (!takeoffVertexSession && !takeoffMoveSession) {
          if (vertexEditId) {
            const vz = st.takeoffZones.find(
              (z) => z.id === vertexEditId && z.pageIndex === pageIdx0 && !z.locked,
            );
            if (vz && vz.measurementType === "area" && vz.points.length >= 3) {
              const vi = hitTakeoffAreaVertexIndex(raw, vz.points, pageSize.w, pageSize.h);
              if (vi != null) {
                const o = vz.points.map((p) => ({ ...p }));
                setTakeoffVertexSession({
                  zoneId: vz.id,
                  vertexIndex: vi,
                  pointerId: e.pointerId,
                  originPoints: o,
                });
                setTakeoffVertexPreviewPoints(o);
                el.setPointerCapture(e.pointerId);
                e.preventDefault();
                return;
              }
            }
          }
          if (moveTargetId) {
            const mz = st.takeoffZones.find(
              (z) => z.id === moveTargetId && z.pageIndex === pageIdx0 && !z.locked,
            );
            if (mz && hitTakeoffZone(raw, mz.measurementType, mz.points, pageSize.w, pageSize.h)) {
              const o = mz.points.map((p) => ({ ...p }));
              setTakeoffMoveSession({
                zoneId: mz.id,
                pointerId: e.pointerId,
                anchorRaw: { x: raw.x, y: raw.y },
                originPoints: o,
              });
              setTakeoffMovePreviewPoints(o);
              el.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
          }
        }

        const zs = [...st.takeoffZones]
          .filter((z) => z.pageIndex === pageIdx0 && !z.locked)
          .reverse();
        if (!redrawTargetId) {
          for (const z of zs) {
            if (hitTakeoffZone(raw, z.measurementType, z.points, pageSize.w, pageSize.h)) {
              const it = st.takeoffItems.find((i) => i.id === z.itemId);
              if (it) st.setTakeoffPenColor(it.color);
              st.setTakeoffSelectedItemId(z.itemId);
              if (e.metaKey || e.ctrlKey) {
                const cur = [...st.takeoffSelectedZoneIds];
                const ix = cur.indexOf(z.id);
                if (ix >= 0) cur.splice(ix, 1);
                else cur.push(z.id);
                st.setTakeoffSelectedZoneIds(cur);
                return;
              }
              st.setTakeoffSelectedZoneIds([z.id]);
              st.openTakeoffSlider({ editZoneId: z.id });
              return;
            }
          }
        } else {
          for (const z of zs) {
            if (z.id === redrawTargetId) continue;
            if (hitTakeoffZone(raw, z.measurementType, z.points, pageSize.w, pageSize.h)) {
              const it = st.takeoffItems.find((i) => i.id === z.itemId);
              if (it) st.setTakeoffPenColor(it.color);
              st.setTakeoffSelectedItemId(z.itemId);
              if (e.metaKey || e.ctrlKey) {
                const cur = [...st.takeoffSelectedZoneIds];
                const ix = cur.indexOf(z.id);
                if (ix >= 0) cur.splice(ix, 1);
                else cur.push(z.id);
                st.setTakeoffSelectedZoneIds(cur);
                return;
              }
              st.setTakeoffSelectedZoneIds([z.id]);
              st.openTakeoffSlider({ editZoneId: z.id });
              return;
            }
          }
        }
        const k = st.takeoffDrawKind;
        if (k === "count") {
          const pts = [...(st.takeoffCountDraftPoints ?? []), { x: sn.x, y: sn.y }];
          st.setTakeoffCountDraftPoints(pts);
          return;
        }
        if (k === "linear") {
          if (!takeoffLineStart) {
            setTakeoffLineStart({ x: sn.x, y: sn.y });
            setTakeoffLinePreview(null);
            return;
          }
          const end = snapMeasureLineEndpoint(
            takeoffLineStart,
            raw,
            sn,
            e.shiftKey,
            el,
            pageSize.w,
            pageSize.h,
            snapSegmentsRef.current,
            snapToGeometry,
            snapRadiusPx,
            snapLayerIds,
          );
          if (Math.hypot(end.x - takeoffLineStart.x, end.y - takeoffLineStart.y) < 1e-6) return;
          commitTakeoffDrawOrRedraw("linear", [takeoffLineStart, end]);
          setTakeoffLineStart(null);
          setTakeoffLinePreview(null);
          return;
        }
        if (k === "area") {
          const areaMode = useViewerStore.getState().takeoffAreaMode;
          if (areaMode === "box") {
            if (!takeoffRectAnchor) {
              setTakeoffRectAnchor({ x: sn.x, y: sn.y });
              setTakeoffRectPreview({ x: sn.x, y: sn.y });
              return;
            }
            const end = snapMeasureLineEndpoint(
              takeoffRectAnchor,
              raw,
              sn,
              e.shiftKey,
              el,
              pageSize.w,
              pageSize.h,
              snapSegmentsRef.current,
              snapToGeometry,
              snapRadiusPx,
              snapLayerIds,
            );
            const boxPts = rectPolygonFromTwoCornersNorm(takeoffRectAnchor, end);
            commitTakeoffDrawOrRedraw(
              "area",
              boxPts.map((p) => ({ ...p })),
            );
            setTakeoffRectAnchor(null);
            setTakeoffRectPreview(null);
            return;
          }
          const closeTolN = 14 / Math.min(cssW, cssH);
          const pts = takeoffAreaPts ?? [];
          if (pts.length >= 3) {
            const d = Math.hypot(sn.x - pts[0].x, sn.y - pts[0].y);
            if (d < closeTolN) {
              commitTakeoffDrawOrRedraw(
                "area",
                pts.map((p) => ({ ...p })),
              );
              setTakeoffAreaPts(null);
              setTakeoffAreaPreview(null);
              return;
            }
          }
          const add =
            pts.length === 0
              ? { x: sn.x, y: sn.y }
              : measureOrthoEnd(
                  e.shiftKey,
                  pts[pts.length - 1],
                  { x: sn.x, y: sn.y },
                  pageSize.w,
                  pageSize.h,
                );
          setTakeoffAreaPts([...pts, add]);
          setTakeoffAreaPreview(null);
          return;
        }
        return;
      }

      if (tool === "pan") {
        const sc = scrollContainerRef?.current;
        if (sc) {
          panSessionRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            sl: sc.scrollLeft,
            st: sc.scrollTop,
          };
          el.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        return;
      }

      if (tool === "zoomArea") {
        const sc = scrollContainerRef?.current;
        if (sc) {
          setZoomMarquee({
            pointerId: e.pointerId,
            start: { x: raw.x, y: raw.y },
            current: { x: raw.x, y: raw.y },
          });
          el.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        return;
      }

      if (tool === "select") {
        const modMulti = e.metaKey || e.ctrlKey || e.shiftKey;
        if (selectedAnnotationIds.length === 1) {
          const sel = annotations.find((x) => x.id === selectedAnnotationIds[0]);
          if (sel) {
            const handles = getResizeHandles(sel, cssW, cssH, pageSize.w, pageSize.h, scale);
            const rawHit = (() => {
              const deg = sel.rotationDeg ?? 0;
              if (deg === 0 || sel.type === "measurement") return raw;
              const c = computeRotationCenterPx(sel, cssW, cssH, pageSize.w, pageSize.h, scale);
              if (!c) return raw;
              const inv = inverseRotateNorm(raw.x, raw.y, c.cx, c.cy, cssW, cssH, deg);
              return { x: inv.nx, y: inv.ny };
            })();
            const hit = hitResizeHandle(handles, rawHit.x, rawHit.y, cssW, cssH);
            if (hit) {
              const pts = sel.points.map((p) => ({ ...p }));
              const b = boundsNormFromPoints(pts);
              const session: ResizeSession = {
                id: sel.id,
                handle: hit,
                startPoints: pts,
                startBounds: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY },
              };
              if (sel.type === "text") {
                session.startFontSize = sel.fontSize ?? 12;
                session.startTextLayout = textBoxLayoutPx(sel, cssW, cssH);
              }
              resizeSessionRef.current = session;
              setResizeActive(true);
              el.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
        const id = pickAnnotationAt(
          annotations,
          raw.x,
          raw.y,
          cssW,
          cssH,
          pageSize.w,
          pageSize.h,
          scale,
        );
        if (id) {
          if (e.metaKey || e.ctrlKey) {
            setSelectedAnnotationIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            );
            return;
          }
          if (e.shiftKey) {
            setSelectedAnnotationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
            return;
          }
          const selectedOnPage = selectedAnnotationIds.filter((sid) =>
            annotations.some((a) => a.id === sid),
          );
          if (selectedOnPage.includes(id) && selectedOnPage.length > 1) {
            const unlocked = selectedOnPage.filter((sid) => {
              const a = annotations.find((x) => x.id === sid);
              return a && !a.locked;
            });
            if (unlocked.length === 0) return;
            setMoveDrag({ ids: unlocked, lastN: { x: raw.x, y: raw.y } });
            el.setPointerCapture(e.pointerId);
            return;
          }
          setSelectedAnnotationIds([id]);
          const hitAnn = annotations.find((a) => a.id === id);
          if (hitAnn?.issueDraft) {
            useViewerStore.getState().setIssueCreateDraft({ annotationId: hitAnn.id });
          }
          if (hitAnn?.locked) return;
          setMoveDrag({ ids: [id], lastN: { x: raw.x, y: raw.y } });
          el.setPointerCapture(e.pointerId);
          return;
        }
        if (!modMulti) {
          setSelectMarquee({
            pointerId: e.pointerId,
            start: { x: raw.x, y: raw.y },
            current: { x: raw.x, y: raw.y },
          });
          el.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        return;
      }

      if (tool === "annotate" && markupShape === "text") {
        setTextAnchor({ x: sn.x, y: sn.y });
        setTextCommentOpen(true);
        setSnapHoverPathIndex(null);
        return;
      }

      if (tool === "annotate" && markupShape === "rect") {
        setRectDrag({ a: { x: sn.x, y: sn.y }, b: { x: sn.x, y: sn.y } });
        el.setPointerCapture(e.pointerId);
        return;
      }

      if (tool === "annotate" && markupShape === "cloud") {
        setRectDrag({ a: { x: sn.x, y: sn.y }, b: { x: sn.x, y: sn.y } });
        el.setPointerCapture(e.pointerId);
        return;
      }

      if (
        tool === "annotate" &&
        (markupShape === "ellipse" || markupShape === "cross" || markupShape === "diamond")
      ) {
        setRectDrag({ a: { x: sn.x, y: sn.y }, b: { x: sn.x, y: sn.y } });
        el.setPointerCapture(e.pointerId);
        return;
      }

      if (tool === "annotate" && markupShape === "polygon") {
        const closeTolN = 14 / Math.min(cssW, cssH);
        const pts = polygonMarkup ?? [];
        if (pts.length >= 3) {
          const d = Math.hypot(sn.x - pts[0].x, sn.y - pts[0].y);
          if (d < closeTolN) {
            addAnnotation({
              pageIndex: pageIdx0,
              type: "polygon",
              color: strokeColor,
              strokeWidth,
              points: pts.map((p) => ({ ...p })),
              author: displayName,
            });
            setPolygonMarkup(null);
            setPolygonPreview(null);
            return;
          }
        }
        setPolygonMarkup([...pts, { x: sn.x, y: sn.y }]);
        setPolygonPreview(null);
        return;
      }

      if (tool === "annotate" && (markupShape === "line" || markupShape === "arrow")) {
        if (!lineMarkup) {
          setLineMarkup({ a: { x: sn.x, y: sn.y }, b: { x: sn.x, y: sn.y } });
          return;
        }
        const end = { x: sn.x, y: sn.y };
        if (Math.hypot(end.x - lineMarkup.a.x, end.y - lineMarkup.a.y) < 0.001) {
          setLineMarkup(null);
          return;
        }
        addAnnotation({
          pageIndex: pageIdx0,
          type: "line",
          color: strokeColor,
          strokeWidth,
          points: [lineMarkup.a, end],
          arrowHead: markupShape === "arrow",
          author: displayName,
        });
        setLineMarkup(null);
        return;
      }

      if (tool === "annotate" && (markupShape === "freehand" || markupShape === "highlight")) {
        setBrushHoverNorm(null);
        setDraftPoints([{ x: sn.x, y: sn.y }]);
        el.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      if (tool === "measure") {
        const cal = calibrationByPage[pageIdx0];
        if (!cal) {
          setCalibrateNeededOpen(true);
          return;
        }
        const closeTolN = 14 / Math.min(cssW, cssH);
        const mk = measureKind;

        if (mk === "line") {
          if (!measureStart) {
            measureLineDraftEndRef.current = null;
            setMeasureStart({ x: sn.x, y: sn.y });
            setMeasureEnd(null);
            setMeasurePreview(null);
            setMeasureOffsetPdf(0);
            return;
          }
          const hitPt = MEASURE_LINE_POINT_HIT_PX;
          const hitSeg = MEASURE_LINE_SEGMENT_HIT_PX;

          if (measureEnd) {
            const dS = distNormPx(raw, measureStart, cssW, cssH);
            const dE = distNormPx(raw, measureEnd, cssW, cssH);
            if (dS <= hitPt && dS <= dE) {
              measureLineDragRef.current = { pointerId: e.pointerId, mode: "moveStartCommitted" };
              el.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
            if (dE <= hitPt) {
              measureLineDragRef.current = { pointerId: e.pointerId, mode: "moveEndCommitted" };
              el.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
            const dSeg = distNormPointToSegmentPx(raw, measureStart, measureEnd, cssW, cssH);
            if (dSeg <= hitSeg && dS > hitPt && dE > hitPt) {
              measureLineDragRef.current = {
                pointerId: e.pointerId,
                mode: "translateCommitted",
                originStart: { ...measureStart },
                originEnd: { ...measureEnd },
                anchorN: { x: raw.x, y: raw.y },
              };
              el.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
            commitLineSegment(measureStart, measureEnd, measureOffsetPdf);
            return;
          }

          const dS0 = distNormPx(raw, measureStart, cssW, cssH);
          if (dS0 <= hitPt) {
            measureLineDragRef.current = { pointerId: e.pointerId, mode: "moveStartPreview" };
            el.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
          }
          /**
           * Before the second point is fixed (`!measureEnd`), do not treat hits on the rubber-band
           * preview as drags. Those modes only clear on pointerup without ever setting `measureEnd`,
           * so clicking on/near the preview line (the natural place to finish) looked broken.
           * Preview still follows the cursor via pointermove; click empty space to place the end.
           */

          if (Math.hypot(sn.x - measureStart.x, sn.y - measureStart.y) < 0.001) return;
          const end2 = snapMeasureLineEndpoint(
            measureStart,
            raw,
            sn,
            e.shiftKey,
            el,
            pageSize.w,
            pageSize.h,
            snapSegmentsRef.current,
            snapToGeometry,
            snapRadiusPx,
            snapLayerIds,
          );
          measureLineDraftEndRef.current = end2;
          setMeasureEnd(end2);
          setMeasureOffsetPdf(
            signedPerpendicularOffsetPdf(measureStart, end2, sn, pageSize.w, pageSize.h),
          );
          setMeasurePreview(null);
          return;
        }

        if (mk === "angle") {
          const pts = measureMultiPoints ?? [];
          if (pts.length >= 3) return;
          const add =
            pts.length === 0
              ? { x: sn.x, y: sn.y }
              : measureOrthoEnd(
                  e.shiftKey,
                  pts[pts.length - 1],
                  { x: sn.x, y: sn.y },
                  pageSize.w,
                  pageSize.h,
                );
          const next = [...pts, add];
          if (next.length === 3) {
            const deg = angleAtVertexDeg(next[0], next[1], next[2], pageSize.w, pageSize.h);
            addAnnotation({
              pageIndex: pageIdx0,
              type: "measurement",
              measurementKind: "angle",
              color: measureLabelColor,
              strokeWidth,
              fontSize: measureLabelFontSize,
              textColor: measureLabelColor,
              points: next,
              angleDeg: deg,
              author: displayName,
            });
            setMeasureMultiPoints(null);
            setMeasurePreview(null);
          } else {
            setMeasureMultiPoints(next);
          }
          return;
        }

        if (mk === "area") {
          const pts = measureMultiPoints ?? [];
          if (pts.length >= 3) {
            const d = Math.hypot(sn.x - pts[0].x, sn.y - pts[0].y);
            if (d < closeTolN) {
              const areaMm2 = polygonAreaMm2(pts, pageSize.w, pageSize.h, cal.mmPerPdfUnit);
              addAnnotation({
                pageIndex: pageIdx0,
                type: "measurement",
                measurementKind: "area",
                color: measureLabelColor,
                strokeWidth,
                fontSize: measureLabelFontSize,
                textColor: measureLabelColor,
                points: pts.map((p) => ({ ...p })),
                areaMm2,
                author: displayName,
              });
              setMeasureMultiPoints(null);
              setMeasurePreview(null);
              return;
            }
          }
          const add =
            pts.length === 0
              ? { x: sn.x, y: sn.y }
              : measureOrthoEnd(
                  e.shiftKey,
                  pts[pts.length - 1],
                  { x: sn.x, y: sn.y },
                  pageSize.w,
                  pageSize.h,
                );
          setMeasureMultiPoints([...pts, add]);
          return;
        }

        if (mk === "perimeter") {
          const pts = measureMultiPoints ?? [];
          const add =
            pts.length === 0
              ? { x: sn.x, y: sn.y }
              : measureOrthoEnd(
                  e.shiftKey,
                  pts[pts.length - 1],
                  { x: sn.x, y: sn.y },
                  pageSize.w,
                  pageSize.h,
                );
          setMeasureMultiPoints([...pts, add]);
          return;
        }
      }

      if (tool === "calibrate") {
        // Calibration is precision-sensitive: zoom to cursor anchor (same feel as wheel zoom).
        if (scale < 2.2) {
          const nextScale = Math.min(VIEWER_SCALE_MAX, Math.max(2.2, scale * 1.7));
          if (nextScale > scale + 1e-6) {
            const sc = scrollContainerRef?.current;
            const rect = sc?.getBoundingClientRect();
            const relativeX = rect ? e.clientX - rect.left : 0;
            const relativeY = rect ? e.clientY - rect.top : 0;
            const ratio = nextScale / scale;
            setScale(nextScale);
            requestAnimationFrame(() => {
              const scNow = scrollContainerRef?.current;
              if (!scNow) return;
              const nextLeft = scNow.scrollLeft * ratio + relativeX * (ratio - 1);
              const nextTop = scNow.scrollTop * ratio + relativeY * (ratio - 1);
              const maxL = Math.max(0, scNow.scrollWidth - scNow.clientWidth);
              const maxT = Math.max(0, scNow.scrollHeight - scNow.clientHeight);
              scNow.scrollLeft = Math.min(maxL, Math.max(0, nextLeft));
              scNow.scrollTop = Math.min(maxT, Math.max(0, nextTop));
            });
          }
        }
        const draft = useViewerStore.getState().calibrateDraft;
        if (draft.length === 0) {
          setCalibrateDraft([{ x: sn.x, y: sn.y }]);
          return;
        }
        if (draft.length === 1) {
          const p2 = measureOrthoEnd(
            e.shiftKey,
            draft[0],
            { x: sn.x, y: sn.y },
            pageSize.w,
            pageSize.h,
          );
          setCalibrateDraft([draft[0], p2]);
          setCalibrateKey((k) => k + 1);
          setCalibrateOpen(true);
        }
      }
    },
    [
      tool,
      markupShape,
      lineMarkup,
      calibrationByPage,
      pageIdx0,
      measureKind,
      measureStart,
      measureEnd,
      measureOffsetPdf,
      measurePreview,
      measureMultiPoints,
      pageSize.w,
      pageSize.h,
      scale,
      annotations,
      addAnnotation,
      displayName,
      setCalibrateDraft,
      strokeColor,
      strokeWidth,
      measureLabelFontSize,
      measureLabelColor,
      commitLineSegment,
      selectedAnnotationIds,
      setSelectedAnnotationIds,
      scrollContainerRef,
      setScale,
      polygonMarkup,
      compareReferenceOnly,
      snapToGeometry,
      snapRadiusPx,
      snapLayerIds,
      takeoffLineStart,
      takeoffAreaPts,
      takeoffRectAnchor,
      takeoffVertexSession,
      takeoffMoveSession,
      commitTakeoffDrawOrRedraw,
      setTakeoffLineStart,
      setTakeoffLinePreview,
      setTakeoffAreaPts,
      setTakeoffAreaPreview,
      setTakeoffRectAnchor,
      setTakeoffRectPreview,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = overlayRef.current;
      if (!el) return;
      if (textCommentOpen) {
        setSnapHoverPathIndex(null);
        setBrushHoverNorm(null);
        setTakeoffSnapHint(false);
        return;
      }
      const raw = normFromEvent(e, el);
      viewerCollab?.reportPointer(pageIdx0, raw.x, raw.y);
      if (compareReferenceOnly && tool !== "pan") return;
      if (
        selectMarquee &&
        selectMarquee.pointerId === e.pointerId &&
        tool === "select" &&
        !compareReferenceOnly
      ) {
        setSelectMarquee((m) => (m ? { ...m, current: { x: raw.x, y: raw.y } } : null));
        setSnapHoverPathIndex(null);
        return;
      }
      if (zoomMarquee && zoomMarquee.pointerId === e.pointerId && tool === "zoomArea") {
        setZoomMarquee((m) => (m ? { ...m, current: { x: raw.x, y: raw.y } } : null));
        setSnapHoverPathIndex(null);
        return;
      }
      const sn =
        (tool === "measure" || tool === "takeoff") && e.altKey
          ? { x: raw.x, y: raw.y, snapped: false }
          : snapNorm(
              raw.x,
              raw.y,
              el,
              snapSegmentsRef.current,
              snapStrokeContext(tool, markupShape),
            );

      if (tool === "takeoff") {
        const st = useViewerStore.getState();
        const drafting =
          st.takeoffCountDraftPoints != null ||
          takeoffLineStart != null ||
          takeoffAreaPts != null ||
          takeoffRectAnchor != null;
        setTakeoffSnapHint(!!drafting && sn.snapped);
      } else {
        setTakeoffSnapHint(false);
      }

      const mDrag = measureLineDragRef.current;
      if (
        mDrag &&
        mDrag.pointerId === e.pointerId &&
        tool === "measure" &&
        measureKind === "line" &&
        measureStart
      ) {
        if (mDrag.mode === "moveStartPreview") {
          setMeasureStart({ x: sn.x, y: sn.y });
        } else if (mDrag.mode === "moveEndPreview" && measurePreview) {
          const end = snapMeasureLineEndpoint(
            measureStart,
            raw,
            sn,
            e.shiftKey,
            el,
            pageSize.w,
            pageSize.h,
            snapSegmentsRef.current,
            snapToGeometry,
            snapRadiusPx,
            snapLayerIds,
          );
          setMeasurePreview(end);
        } else if (mDrag.mode === "translatePreview") {
          const dx = raw.x - mDrag.anchorN.x;
          const dy = raw.y - mDrag.anchorN.y;
          const ns = clampNorm({ x: mDrag.originStart.x + dx, y: mDrag.originStart.y + dy });
          const np = clampNorm({ x: mDrag.originPreview.x + dx, y: mDrag.originPreview.y + dy });
          setMeasureStart(ns);
          setMeasurePreview(np);
        } else if (mDrag.mode === "moveStartCommitted" && measureEnd) {
          const ns = { x: sn.x, y: sn.y };
          setMeasureStart(ns);
          setMeasureOffsetPdf(
            signedPerpendicularOffsetPdf(ns, measureEnd, sn, pageSize.w, pageSize.h),
          );
        } else if (mDrag.mode === "moveEndCommitted" && measureEnd) {
          const ne = { x: sn.x, y: sn.y };
          setMeasureEnd(ne);
          setMeasureOffsetPdf(
            signedPerpendicularOffsetPdf(measureStart, ne, sn, pageSize.w, pageSize.h),
          );
        } else if (mDrag.mode === "translateCommitted" && measureEnd) {
          const dx = raw.x - mDrag.anchorN.x;
          const dy = raw.y - mDrag.anchorN.y;
          const ns = clampNorm({ x: mDrag.originStart.x + dx, y: mDrag.originStart.y + dy });
          const ne = clampNorm({ x: mDrag.originEnd.x + dx, y: mDrag.originEnd.y + dy });
          setMeasureStart(ns);
          setMeasureEnd(ne);
          setMeasureOffsetPdf(signedPerpendicularOffsetPdf(ns, ne, sn, pageSize.w, pageSize.h));
        }
        setSnapHoverPathIndex(null);
        return;
      }

      if (
        tool === "annotate" &&
        (markupShape === "freehand" || markupShape === "highlight") &&
        !draftPoints &&
        !calibrateOpen &&
        !toolbarHoveredLayerId
      ) {
        setBrushHoverNorm({ x: sn.x, y: sn.y });
      } else {
        setBrushHoverNorm(null);
      }
      const ovW = pageSize.w * scale;
      const ovH = pageSize.h * scale;

      if (tool === "calibrate" && !calibrateOpen) {
        const calDraft = useViewerStore.getState().calibrateDraft;
        if (calDraft.length === 1) {
          const ortho = measureOrthoEnd(
            e.shiftKey,
            calDraft[0],
            { x: sn.x, y: sn.y },
            pageSize.w,
            pageSize.h,
          );
          setCalibratePreview(ortho);
        } else {
          setCalibratePreview(null);
        }
      }

      if (tool === "pan" && panSessionRef.current && scrollContainerRef?.current) {
        const ps = panSessionRef.current;
        const sc = scrollContainerRef.current;
        const dx = e.clientX - ps.startX;
        const dy = e.clientY - ps.startY;
        sc.scrollLeft = ps.sl - dx;
        sc.scrollTop = ps.st - dy;
        setSnapHoverPathIndex(null);
        return;
      }

      const rs = resizeSessionRef.current;
      if (tool === "select" && rs) {
        const ann = useViewerStore.getState().annotations.find((x) => x.id === rs.id);
        if (!ann || ann.pageIndex !== pageIdx0) {
          resizeSessionRef.current = null;
          setResizeActive(false);
          setSnapHoverPathIndex(null);
          return;
        }
        const cal = calibrationByPage[pageIdx0];
        const patch = computeResizePatch(
          ann,
          rs.handle,
          rs.startPoints,
          rs.startBounds,
          raw.x,
          raw.y,
          {
            pageW: pageSize.w,
            pageH: pageSize.h,
            scale,
            mmPerPdfUnit: ann.type === "measurement" ? cal?.mmPerPdfUnit : undefined,
            startFontSize: rs.startFontSize,
            startTextLayout: rs.startTextLayout,
            cssW: ovW,
            cssH: ovH,
          },
        );
        if (patch && Object.keys(patch).length > 0) {
          updateAnnotation(rs.id, patch);
        }
        setSnapHoverPathIndex(null);
        return;
      }

      if (tool === "select" && moveDrag) {
        const dx = raw.x - moveDrag.lastN.x;
        const dy = raw.y - moveDrag.lastN.y;
        if (Math.abs(dx) > 1e-12 || Math.abs(dy) > 1e-12) {
          const st = useViewerStore.getState();
          for (const id of moveDrag.ids) {
            const ann = st.annotations.find((x) => x.id === id);
            if (!ann || ann.pageIndex !== pageIdx0 || ann.locked) continue;
            updateAnnotation(id, {
              points: translateAnnotationPoints(ann.points, dx, dy),
            });
          }
        }
        setMoveDrag({ ids: moveDrag.ids, lastN: { x: raw.x, y: raw.y } });
        setSnapHoverPathIndex(null);
        return;
      }

      if (tool === "takeoff") {
        if (takeoffVertexSession && takeoffVertexSession.pointerId === e.pointerId) {
          const o = takeoffVertexSession.originPoints;
          const i = takeoffVertexSession.vertexIndex;
          const np = o.map((p, j) => (j === i ? clampNorm({ x: sn.x, y: sn.y }) : { ...p }));
          setTakeoffVertexPreviewPoints(np);
          setSnapHoverPathIndex(null);
          return;
        }
        if (takeoffMoveSession && takeoffMoveSession.pointerId === e.pointerId) {
          const dx = raw.x - takeoffMoveSession.anchorRaw.x;
          const dy = raw.y - takeoffMoveSession.anchorRaw.y;
          const np = takeoffMoveSession.originPoints.map((p) =>
            clampNorm({ x: p.x + dx, y: p.y + dy }),
          );
          setTakeoffMovePreviewPoints(np);
          setSnapHoverPathIndex(null);
          return;
        }
        const st = useViewerStore.getState();
        const k = st.takeoffDrawKind;
        if (k === "area" && st.takeoffAreaMode === "box" && takeoffRectAnchor) {
          const end = snapMeasureLineEndpoint(
            takeoffRectAnchor,
            raw,
            sn,
            e.shiftKey,
            el,
            pageSize.w,
            pageSize.h,
            snapSegmentsRef.current,
            snapToGeometry,
            snapRadiusPx,
            snapLayerIds,
          );
          setTakeoffRectPreview(end);
          setSnapHoverPathIndex(null);
          return;
        }
        if (k === "linear" && takeoffLineStart) {
          const end = snapMeasureLineEndpoint(
            takeoffLineStart,
            raw,
            sn,
            e.shiftKey,
            el,
            pageSize.w,
            pageSize.h,
            snapSegmentsRef.current,
            snapToGeometry,
            snapRadiusPx,
            snapLayerIds,
          );
          setTakeoffLinePreview(end);
          setSnapHoverPathIndex(null);
          return;
        }
        if (k === "area" && takeoffAreaPts && takeoffAreaPts.length > 0) {
          const last = takeoffAreaPts[takeoffAreaPts.length - 1];
          const end = measureOrthoEnd(
            e.shiftKey,
            last,
            { x: sn.x, y: sn.y },
            pageSize.w,
            pageSize.h,
          );
          setTakeoffAreaPreview(end);
          setSnapHoverPathIndex(null);
          return;
        }
        for (const z of [...st.takeoffZones].filter((z) => z.pageIndex === pageIdx0).reverse()) {
          if (hitTakeoffZone(raw, z.measurementType, z.points, pageSize.w, pageSize.h)) {
            setTakeoffHoverZoneId(z.id);
            setSnapHoverPathIndex(null);
            return;
          }
        }
        setTakeoffHoverZoneId(null);
        setSnapHoverPathIndex(null);
        return;
      }

      if (tool === "measure") {
        if (measureKind === "line" && measureStart) {
          const draftEnd = measureLineDraftEndRef.current;
          if (draftEnd) {
            setMeasurePreview(null);
            setMeasureOffsetPdf(
              signedPerpendicularOffsetPdf(measureStart, draftEnd, sn, pageSize.w, pageSize.h),
            );
          } else {
            const end = snapMeasureLineEndpoint(
              measureStart,
              raw,
              sn,
              e.shiftKey,
              el,
              pageSize.w,
              pageSize.h,
              snapSegmentsRef.current,
              snapToGeometry,
              snapRadiusPx,
              snapLayerIds,
            );
            setMeasurePreview(end);
          }
          setSnapHoverPathIndex(null);
          return;
        }
        const mpt = measureMultiPoints?.length ?? 0;
        if (
          (measureKind === "area" || measureKind === "perimeter") &&
          mpt > 0 &&
          measureMultiPoints
        ) {
          const last = measureMultiPoints[mpt - 1];
          const prev = { x: sn.x, y: sn.y };
          const end = measureOrthoEnd(e.shiftKey, last, prev, pageSize.w, pageSize.h);
          setMeasurePreview(end);
          setSnapHoverPathIndex(null);
          return;
        }
        if (measureKind === "angle" && mpt > 0 && mpt < 3 && measureMultiPoints) {
          const last = measureMultiPoints[mpt - 1];
          const prev = { x: sn.x, y: sn.y };
          const end = measureOrthoEnd(e.shiftKey, last, prev, pageSize.w, pageSize.h);
          setMeasurePreview(end);
          setSnapHoverPathIndex(null);
          return;
        }
      }

      if (
        tool === "annotate" &&
        (markupShape === "line" || markupShape === "arrow") &&
        lineMarkup
      ) {
        setLineMarkup({ a: lineMarkup.a, b: { x: sn.x, y: sn.y } });
        setSnapHoverPathIndex(null);
        return;
      }

      if (
        tool === "annotate" &&
        (markupShape === "rect" ||
          markupShape === "cloud" ||
          markupShape === "ellipse" ||
          markupShape === "cross" ||
          markupShape === "diamond") &&
        rectDrag
      ) {
        setRectDrag({ a: rectDrag.a, b: { x: sn.x, y: sn.y } });
        setSnapHoverPathIndex(null);
        return;
      }

      if (
        tool === "annotate" &&
        markupShape === "polygon" &&
        polygonMarkup &&
        polygonMarkup.length > 0
      ) {
        setPolygonPreview({ x: sn.x, y: sn.y });
        setSnapHoverPathIndex(null);
        return;
      }

      if (
        tool === "annotate" &&
        (markupShape === "freehand" || markupShape === "highlight") &&
        draftPoints
      ) {
        const last = draftPoints[draftPoints.length - 1];
        if (Math.hypot(sn.x - last.x, sn.y - last.y) >= 0.0015) {
          setDraftPoints((d) => (d ? [...d, { x: sn.x, y: sn.y }] : d));
        }
        setSnapHoverPathIndex(null);
        return;
      }

      if (tool !== "select" || compareReferenceOnly || textCommentOpen) {
        setMarkupHoverId(null);
      } else if (moveDrag || selectMarquee || resizeActive) {
        setMarkupHoverId(null);
      } else {
        const pageAnn = annotations.filter((a) => a.pageIndex === pageIdx0);
        const cw = pageSize.w * scale;
        const ch = pageSize.h * scale;
        const hid = pickAnnotationAt(pageAnn, raw.x, raw.y, cw, ch, pageSize.w, pageSize.h, scale);
        setMarkupHoverId(hid);
      }

      const blockPdfHover =
        calibrateOpen ||
        toolbarHoveredLayerId ||
        tool === "select" ||
        tool === "pan" ||
        tool === "zoomArea" ||
        moveDrag ||
        selectMarquee ||
        zoomMarquee ||
        resizeSessionRef.current;

      if (blockPdfHover) {
        setSnapHoverPathIndex(null);
        return;
      }

      const st = useViewerStore.getState();
      const snapOrCalibrateHover = st.snapToGeometry || st.tool === "calibrate";
      if (!snapOrCalibrateHover) {
        setSnapHoverPathIndex(null);
        return;
      }

      const layerFilter =
        st.snapLayerIds === null || st.snapLayerIds.length === 0 ? "all" : new Set(st.snapLayerIds);
      const hoverNormPx = st.tool === "calibrate" ? Math.max(32, st.snapRadiusPx) : st.snapRadiusPx;
      const { w: ow, h: oh } = overlayCssSizePx(el);
      const nearest = findNearestSegment(
        raw.x,
        raw.y,
        snapSegmentsRef.current,
        layerFilter,
        hoverNormPx,
        ow,
        oh,
      );
      if (nearest) setSnapHoverPathIndex(nearest.pathIndex);
      else setSnapHoverPathIndex(null);
    },
    [
      tool,
      markupShape,
      measureKind,
      measureStart,
      measureEnd,
      measurePreview,
      measureMultiPoints,
      pageSize.w,
      pageSize.h,
      lineMarkup,
      rectDrag,
      draftPoints,
      polygonMarkup,
      calibrateOpen,
      toolbarHoveredLayerId,
      textCommentOpen,
      moveDrag,
      selectMarquee,
      zoomMarquee,
      updateAnnotation,
      pageIdx0,
      calibrationByPage,
      scale,
      scrollContainerRef,
      compareReferenceOnly,
      snapToGeometry,
      snapRadiusPx,
      snapLayerIds,
      takeoffLineStart,
      takeoffAreaPts,
      takeoffRectAnchor,
      takeoffVertexSession,
      takeoffMoveSession,
      setTakeoffHoverZoneId,
      annotations,
      pageIdx0,
      resizeActive,
      compareReferenceOnly,
      viewerCollab,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = overlayRef.current;

      if (tool === "pan" && panSessionRef.current) {
        panSessionRef.current = null;
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        return;
      }

      if (zoomMarquee && tool === "zoomArea" && zoomMarquee.pointerId === e.pointerId) {
        const { start, current } = zoomMarquee;
        setZoomMarquee(null);
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const nx0 = Math.min(start.x, current.x);
        const nx1 = Math.max(start.x, current.x);
        const ny0 = Math.min(start.y, current.y);
        const ny1 = Math.max(start.y, current.y);
        const rw = nx1 - nx0;
        const rh = ny1 - ny0;
        const cwPx = pageSize.w * scale;
        const chPx = pageSize.h * scale;
        const dxPx = Math.abs(current.x - start.x) * cwPx;
        const dyPx = Math.abs(current.y - start.y) * chPx;
        const MIN_DRAG_PX = 8;
        if (Math.hypot(dxPx, dyPx) < MIN_DRAG_PX || rw < 0.001 || rh < 0.001) {
          return;
        }
        const sc = scrollContainerRef?.current;
        if (!sc) return;
        const rawS = computeScaleToFitNormRect(
          rw,
          rh,
          sc.clientWidth,
          sc.clientHeight,
          pageSize.w,
          pageSize.h,
        );
        const s2 = Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, rawS));
        setScale(s2);
        const cx = (nx0 + nx1) / 2;
        const cy = (ny0 + ny1) / 2;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const sc2 = scrollContainerRef?.current;
            const pw = pageWrapperRefProp?.current;
            if (sc2 && pw) scrollViewportToNorm(sc2, pw, cx, cy);
          });
        });
        return;
      }

      if (compareReferenceOnly) return;

      if (selectMarquee && selectMarquee.pointerId === e.pointerId && tool === "select") {
        const { start, current } = selectMarquee;
        setSelectMarquee(null);
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const cw = pageSize.w * scale;
        const ch = pageSize.h * scale;
        const MARQUEE_MIN_PX = 5;
        const dx = (current.x - start.x) * cw;
        const dy = (current.y - start.y) * ch;
        if (Math.hypot(dx, dy) < MARQUEE_MIN_PX) {
          setSelectedAnnotationIds([]);
        } else {
          const minPx = Math.min(start.x * cw, current.x * cw);
          const maxPx = Math.max(start.x * cw, current.x * cw);
          const minPy = Math.min(start.y * ch, current.y * ch);
          const maxPy = Math.max(start.y * ch, current.y * ch);
          const picked = pickAnnotationsInMarquee(
            annotations,
            { minX: minPx, minY: minPy, maxX: maxPx, maxY: maxPy },
            cw,
            ch,
            pageSize.w,
            pageSize.h,
            scale,
          );
          if (e.shiftKey) {
            setSelectedAnnotationIds((prev) => {
              const s = new Set(prev);
              for (const pid of picked) s.add(pid);
              return [...s];
            });
          } else {
            setSelectedAnnotationIds(picked);
          }
        }
        return;
      }

      if (measureLineDragRef.current?.pointerId === e.pointerId) {
        measureLineDragRef.current = null;
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        return;
      }

      if (tool === "select" && resizeSessionRef.current) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        resizeSessionRef.current = null;
        setResizeActive(false);
        return;
      }

      if (tool === "select" && moveDrag) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        setMoveDrag(null);
        return;
      }

      if (
        tool === "takeoff" &&
        takeoffVertexSession &&
        takeoffVertexSession.pointerId === e.pointerId
      ) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const sess = takeoffVertexSession;
        const preview = takeoffVertexPreviewPoints;
        setTakeoffVertexSession(null);
        setTakeoffVertexPreviewPoints(null);
        const cal = calibrationByPage[pageIdx0];
        const st = useViewerStore.getState();
        const z = st.takeoffZones.find((x) => x.id === sess.zoneId);
        const item = z ? st.takeoffItems.find((i) => i.id === z.itemId) : undefined;
        if (cal && z && item && !z.locked && preview && z.pageIndex === pageIdx0) {
          const { points, rawQuantity, computedQuantity } = patchZoneQuantitiesFromPoints(
            z,
            item,
            preview,
            pageSize.w,
            pageSize.h,
            cal.mmPerPdfUnit,
          );
          takeoffUpdateZone(sess.zoneId, { points, rawQuantity, computedQuantity });
          toast.success("Vertex adjusted.");
        }
        return;
      }
      if (
        tool === "takeoff" &&
        takeoffMoveSession &&
        takeoffMoveSession.pointerId === e.pointerId
      ) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const sess = takeoffMoveSession;
        const preview = takeoffMovePreviewPoints;
        setTakeoffMoveSession(null);
        setTakeoffMovePreviewPoints(null);
        const cal = calibrationByPage[pageIdx0];
        const st = useViewerStore.getState();
        const z = st.takeoffZones.find((x) => x.id === sess.zoneId);
        const item = z ? st.takeoffItems.find((i) => i.id === z.itemId) : undefined;
        if (cal && z && item && !z.locked && preview && z.pageIndex === pageIdx0) {
          const { points, rawQuantity, computedQuantity } = patchZoneQuantitiesFromPoints(
            z,
            item,
            preview,
            pageSize.w,
            pageSize.h,
            cal.mmPerPdfUnit,
          );
          takeoffUpdateZone(sess.zoneId, { points, rawQuantity, computedQuantity });
          toast.success("Zone moved.");
          st.setTakeoffMoveZoneId(null);
        }
        return;
      }

      if (tool === "annotate" && markupShape === "cloud" && rectDrag) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const { a, b } = rectDrag;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dx > 0.002 || dy > 0.002) {
          addAnnotation({
            pageIndex: pageIdx0,
            type: "cloud",
            color: strokeColor,
            strokeWidth,
            points: [a, b],
            author: displayName,
          });
        }
        setRectDrag(null);
        return;
      }

      if (tool === "annotate" && markupShape === "rect" && rectDrag) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const { a, b } = rectDrag;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dx > 0.002 || dy > 0.002) {
          addAnnotation({
            pageIndex: pageIdx0,
            type: "rect",
            color: strokeColor,
            strokeWidth,
            points: [a, b],
            author: displayName,
          });
        }
        setRectDrag(null);
        return;
      }

      if (tool === "annotate" && markupShape === "ellipse" && rectDrag) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const { a, b } = rectDrag;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dx > 0.002 || dy > 0.002) {
          addAnnotation({
            pageIndex: pageIdx0,
            type: "ellipse",
            color: strokeColor,
            strokeWidth,
            points: [a, b],
            author: displayName,
          });
        }
        setRectDrag(null);
        return;
      }

      if (tool === "annotate" && markupShape === "cross" && rectDrag) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const { a, b } = rectDrag;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dx > 0.002 || dy > 0.002) {
          addAnnotation({
            pageIndex: pageIdx0,
            type: "cross",
            color: strokeColor,
            strokeWidth,
            points: [a, b],
            author: displayName,
          });
        }
        setRectDrag(null);
        return;
      }

      if (tool === "annotate" && markupShape === "diamond" && rectDrag) {
        if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const { a, b } = rectDrag;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dx > 0.002 || dy > 0.002) {
          addAnnotation({
            pageIndex: pageIdx0,
            type: "diamond",
            color: strokeColor,
            strokeWidth,
            points: diamondPointsFromRectCorners(a, b),
            author: displayName,
          });
        }
        setRectDrag(null);
        return;
      }

      if (
        tool !== "annotate" ||
        (markupShape !== "freehand" && markupShape !== "highlight") ||
        !draftPoints
      )
        return;
      if (el?.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      if (draftPoints.length >= 2) {
        const hi = markupShape === "highlight";
        addAnnotation({
          pageIndex: pageIdx0,
          type: hi ? "highlight" : "polyline",
          color: strokeColor,
          strokeWidth,
          points: draftPoints,
          author: displayName,
        });
      }
      setDraftPoints(null);
    },
    [
      tool,
      markupShape,
      rectDrag,
      draftPoints,
      addAnnotation,
      pageIdx0,
      strokeColor,
      strokeWidth,
      displayName,
      moveDrag,
      compareReferenceOnly,
      selectMarquee,
      zoomMarquee,
      setSelectedAnnotationIds,
      setScale,
      scrollContainerRef,
      pageWrapperRefProp,
      annotations,
      pageSize.w,
      pageSize.h,
      scale,
      takeoffVertexSession,
      takeoffVertexPreviewPoints,
      takeoffMoveSession,
      takeoffMovePreviewPoints,
      takeoffUpdateZone,
      calibrationByPage,
    ],
  );

  const cssW = pageSize.w * scale;
  const cssH = pageSize.h * scale;
  const printCssW = pageSize.w * PRINT_PDF_SCALE;
  const printCssH = pageSize.h * PRINT_PDF_SCALE;
  const refPaneInactive = compareReferenceOnly && tool !== "pan";

  const selectionBounds = useMemo(() => {
    if (tool !== "select") return null;
    const selectedOnPage = annotations.filter((a) => selectedAnnotationIds.includes(a.id));
    if (selectedOnPage.length === 0) return null;
    return unionAnnotationSelectionBounds(
      selectedOnPage,
      cssW,
      cssH,
      pageSize.w,
      pageSize.h,
      scale,
    );
  }, [selectedAnnotationIds, tool, annotations, cssW, cssH, pageSize.w, pageSize.h, scale]);

  const remoteCollabSelectionRects = useMemo(() => {
    if (!viewerCollab?.collabActive || viewerCollab.remoteSelections.length === 0) return [];
    type B = NonNullable<ReturnType<typeof unionAnnotationSelectionBounds>>;
    const out: { userId: string; color: string; bounds: B }[] = [];
    for (const rs of viewerCollab.remoteSelections) {
      const anns = annotations.filter(
        (a) => a.pageIndex === pageIdx0 && rs.annotationIds.includes(a.id),
      );
      if (anns.length === 0) continue;
      const b = unionAnnotationSelectionBounds(anns, cssW, cssH, pageSize.w, pageSize.h, scale);
      if (!b) continue;
      out.push({ userId: rs.userId, color: collabColorForUser(rs.userId), bounds: b });
    }
    return out;
  }, [
    viewerCollab?.collabActive,
    viewerCollab?.remoteSelections,
    annotations,
    pageIdx0,
    cssW,
    cssH,
    pageSize.w,
    pageSize.h,
    scale,
  ]);

  const markupHoverHighlight = useMemo(() => {
    if (tool !== "select" || !markupHoverId || selectedAnnotationIds.includes(markupHoverId)) {
      return null;
    }
    const a = annotations.find((x) => x.id === markupHoverId);
    if (!a || a.pageIndex !== pageIdx0) return null;
    const b = annotationSelectionBounds(a, cssW, cssH, pageSize.w, pageSize.h, scale);
    if (!b) return null;
    let x0 = b.minX;
    let y0 = b.minY;
    let rw = b.maxX - b.minX;
    let rh = b.maxY - b.minY;
    const MIN = 16;
    if (rw < MIN) {
      const pad = (MIN - rw) / 2;
      x0 -= pad;
      rw = MIN;
    }
    if (rh < MIN) {
      const pad = (MIN - rh) / 2;
      y0 -= pad;
      rh = MIN;
    }
    return { x0, y0, rw, rh };
  }, [
    tool,
    markupHoverId,
    selectedAnnotationIds,
    annotations,
    pageIdx0,
    cssW,
    cssH,
    pageSize.w,
    pageSize.h,
    scale,
  ]);

  const selectedLinkedIssueLabel = useMemo(() => {
    if (tool !== "select" || selectedAnnotationIds.length !== 1) return null;
    const a = annotations.find((x) => x.id === selectedAnnotationIds[0]);
    if (!a?.linkedIssueId && !a?.issueDraft) return null;
    if (a.issueDraft) return a.linkedIssueTitle?.trim() || "New issue (unsaved)";
    return a.linkedIssueTitle?.trim() || "Linked issue";
  }, [tool, selectedAnnotationIds, annotations]);

  const calibrateDialogInitialMm = useMemo(() => {
    void calibrateKey;
    return loadLastCalibrationKnownMm(fileName, numPages, pageIdx0);
  }, [fileName, numPages, pageIdx0, calibrateKey]);

  const selectionResizeHandles = useMemo(() => {
    if (selectedAnnotationIds.length !== 1 || tool !== "select") return [];
    const a = annotations.find((x) => x.id === selectedAnnotationIds[0]);
    if (!a) return [];
    const handles = getResizeHandles(a, cssW, cssH, pageSize.w, pageSize.h, scale);
    const deg = a.rotationDeg ?? 0;
    if (deg === 0 || a.type === "measurement") return handles;
    const c = computeRotationCenterPx(a, cssW, cssH, pageSize.w, pageSize.h, scale);
    if (!c) return handles;
    return handles.map((h) => {
      const p = forwardRotateHandlePx(h.cx, h.cy, c, deg);
      return { ...h, cx: p.cx, cy: p.cy };
    });
  }, [selectedAnnotationIds, tool, annotations, cssW, cssH, pageSize.w, pageSize.h, scale]);

  const handleSheetContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (refPaneInactive) return;
      const el = overlayRef.current;
      if (!el) return;
      e.preventDefault();
      const busy =
        draftPoints ||
        rectDrag ||
        lineMarkup ||
        measureStart ||
        (measureMultiPoints && measureMultiPoints.length > 0) ||
        (polygonMarkup && polygonMarkup.length > 0) ||
        calibrateDraft.length > 0 ||
        calibrateOpen ||
        textCommentOpen ||
        moveDrag ||
        selectMarquee ||
        zoomMarquee ||
        resizeSessionRef.current;
      if (busy) {
        cancelInteraction();
      }
      const raw = normFromEvent(e, el);
      const hitId = pickAnnotationAt(
        annotations,
        raw.x,
        raw.y,
        cssW,
        cssH,
        pageSize.w,
        pageSize.h,
        scale,
      );
      setSheetContextMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        norm: raw,
        hitId,
      });
    },
    [
      refPaneInactive,
      draftPoints,
      rectDrag,
      lineMarkup,
      measureStart,
      measureMultiPoints,
      polygonMarkup,
      calibrateDraft.length,
      calibrateOpen,
      textCommentOpen,
      moveDrag,
      selectMarquee,
      zoomMarquee,
      cancelInteraction,
      cssW,
      cssH,
      annotations,
      pageSize.w,
      pageSize.h,
      scale,
    ],
  );

  return (
    <>
      <div
        ref={(el) => {
          if (pageWrapperRefProp) pageWrapperRefProp.current = el;
        }}
        className="pdf-print-screen relative inline-block rounded-sm bg-white shadow-[0_12px_40px_rgba(15,23,42,0.2)] ring-1 ring-black/10"
      >
        <canvas
          ref={(el) => {
            canvasRef.current = el;
            if (pageCanvasRefProp) pageCanvasRefProp.current = el;
          }}
          className="pointer-events-none block max-w-none"
          style={{ width: cssW, height: cssH }}
        />
        <div
          ref={overlayRef}
          className={
            refPaneInactive
              ? "absolute inset-0"
              : issuePlacementActive
                ? "absolute inset-0 cursor-crosshair"
                : tool === "pan"
                  ? "absolute inset-0 cursor-grab active:cursor-grabbing"
                  : tool === "zoomArea"
                    ? "absolute inset-0 cursor-crosshair"
                    : tool === "takeoff"
                      ? "absolute inset-0 cursor-crosshair"
                      : tool === "select"
                        ? moveDrag || resizeActive
                          ? "absolute inset-0 cursor-grabbing"
                          : selectMarquee
                            ? "absolute inset-0 cursor-crosshair"
                            : "absolute inset-0 cursor-default"
                        : tool === "annotate" && markupShape === "text"
                          ? "absolute inset-0 cursor-text"
                          : "absolute inset-0 cursor-crosshair"
          }
          style={{
            width: cssW,
            height: cssH,
            /* Pen / touch on iPad: prevent scroll & browser gestures from stealing strokes */
            ...(!refPaneInactive ? { touchAction: "none" as const } : {}),
            ...(refPaneInactive ? { pointerEvents: "none" as const } : {}),
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={(e) => {
            const oel = overlayRef.current;
            measureLineDragRef.current = null;
            panSessionRef.current = null;
            setSelectMarquee(null);
            if (oel?.hasPointerCapture(e.pointerId)) oel.releasePointerCapture(e.pointerId);
            if (
              draftPoints ||
              rectDrag ||
              lineMarkup ||
              measureStart ||
              (measureMultiPoints && measureMultiPoints.length > 0) ||
              (polygonMarkup && polygonMarkup.length > 0) ||
              calibrateDraft.length > 0 ||
              calibrateOpen ||
              textCommentOpen ||
              moveDrag ||
              resizeSessionRef.current ||
              tool === "takeoff"
            ) {
              cancelInteraction();
            }
          }}
          onContextMenu={handleSheetContextMenu}
          onPointerLeave={(ev) => {
            setMarkupHoverId(null);
            setSnapHoverPathIndex(null);
            setBrushHoverNorm(null);
            if (tool === "takeoff") {
              setTakeoffHoverZoneId(null);
              setTakeoffHoverItemId(null);
            }
            if (pointerDrawing && draftPoints) handlePointerUp(ev);
            if (
              tool === "annotate" &&
              (markupShape === "rect" ||
                markupShape === "cloud" ||
                markupShape === "ellipse" ||
                markupShape === "cross" ||
                markupShape === "diamond") &&
              rectDrag
            )
              handlePointerUp(ev);
          }}
        >
          {(tool === "measure" || tool === "takeoff") && !calibrationByPage[pageIdx0] && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex justify-center px-2 pt-2">
              <div className="max-w-[min(100%,28rem)] rounded-lg border border-amber-500/45 bg-amber-950/92 px-3 py-2 text-center text-[10px] leading-snug text-amber-100 shadow-md ring-1 ring-amber-500/20">
                {tool === "takeoff"
                  ? "Calibrate this page in the Measure tab before quantity takeoff."
                  : "Calibrate this page (Measure tab) to use real-world lengths and areas."}
              </div>
            </div>
          )}
          {calibrationByPage[pageIdx0] && (
            <div className="pointer-events-none absolute right-2 top-2 z-[5]">
              <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-950/90 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-200/95">
                Calibrated
              </span>
            </div>
          )}
          {!compareReferenceOnly && (
            <Fragment>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${cssW} ${cssH}`}
                className="pointer-events-none"
                preserveAspectRatio="none"
              >
                <defs>
                  <filter
                    id={`snap-pdf-path-highlight-${pageIdx0}`}
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="blur" />
                    <feColorMatrix
                      in="blur"
                      type="matrix"
                      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0"
                      result="soft"
                    />
                    <feMerge>
                      <feMergeNode in="soft" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter
                    id={`takeoff-draft-snap-${pageIdx0}`}
                    x="-25%"
                    y="-25%"
                    width="150%"
                    height="150%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1.15" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {layerHighlightSegments.length > 0 && (
                  <g opacity={0.5} className="print:hidden">
                    {layerHighlightSegments.map((s, i) => (
                      <line
                        key={`lh-${toolbarHoveredLayerId}-${i}`}
                        x1={s.nx1 * cssW}
                        y1={s.ny1 * cssH}
                        x2={s.nx2 * cssW}
                        y2={s.ny2 * cssH}
                        stroke="#22d3ee"
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                )}
                {snapHoverHighlightSegments.length > 0 && !toolbarHoveredLayerId && (
                  <g
                    className="print:hidden pointer-events-none"
                    style={{ mixBlendMode: "multiply" }}
                    filter={`url(#snap-pdf-path-highlight-${pageIdx0})`}
                  >
                    {snapHoverHighlightSegments.map((s, i) => (
                      <line
                        key={`snap-hl-${snapHoverPathIndex}-${i}`}
                        x1={s.nx1 * cssW}
                        y1={s.ny1 * cssH}
                        x2={s.nx2 * cssW}
                        y2={s.ny2 * cssH}
                        stroke="#06b6d4"
                        strokeWidth={s.strokeWidthPx ?? Math.max(0.65, Math.min(10, scale * 0.55))}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.42}
                      />
                    ))}
                  </g>
                )}
                <CommittedAnnotationsSvg
                  annotations={annotations}
                  cssW={cssW}
                  cssH={cssH}
                  pageW={pageSize.w}
                  pageH={pageSize.h}
                  scale={scale}
                  measureUnit={measureUnit}
                  arrowMarkerId={screenArrowMarkerId}
                />
                <TakeoffZonesSvg
                  zones={takeoffZonesForView}
                  itemsById={takeoffItemsById}
                  cssW={cssW}
                  cssH={cssH}
                  selectedZoneIds={takeoffSelectedZoneIds}
                  selectedItemId={takeoffSelectedItemId}
                  hoverZoneId={takeoffHoverZoneId}
                  hoverItemId={takeoffHoverItemId}
                  moveHighlightZoneId={takeoffMoveZoneId}
                />
                {tool === "takeoff" &&
                  takeoffVertexEditZoneId &&
                  (() => {
                    const z = takeoffZonesForView.find((tz) => tz.id === takeoffVertexEditZoneId);
                    if (!z || z.measurementType !== "area" || z.points.length < 3) return null;
                    return (
                      <g className="pointer-events-none print:hidden">
                        {z.points.map((p, i) => (
                          <circle
                            key={`tv-${z.id}-${i}`}
                            cx={p.x * cssW}
                            cy={p.y * cssH}
                            r={6}
                            fill="#f8fafc"
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </g>
                    );
                  })()}
                {tool === "takeoff" &&
                  takeoffDrawKind === "linear" &&
                  takeoffLineStart &&
                  takeoffLinePreview && (
                    <line
                      className="print:hidden"
                      x1={takeoffLineStart.x * cssW}
                      y1={takeoffLineStart.y * cssH}
                      x2={takeoffLinePreview.x * cssW}
                      y2={takeoffLinePreview.y * cssH}
                      stroke={takeoffDraftColor}
                      strokeWidth={takeoffSnapHint ? 2.75 : 2}
                      strokeDasharray="6 4"
                      opacity={takeoffSnapHint ? 1 : 0.92}
                      vectorEffect="non-scaling-stroke"
                      filter={takeoffSnapHint ? `url(#takeoff-draft-snap-${pageIdx0})` : undefined}
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="20"
                        dur="1.15s"
                        repeatCount="indefinite"
                      />
                    </line>
                  )}
                {tool === "takeoff" &&
                  takeoffDrawKind === "area" &&
                  takeoffAreaMode === "box" &&
                  takeoffRectAnchor &&
                  takeoffRectPreview &&
                  (() => {
                    const rp = rectPolygonFromTwoCornersNorm(takeoffRectAnchor, takeoffRectPreview);
                    const d =
                      rp
                        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * cssW} ${p.y * cssH}`)
                        .join(" ") + " Z";
                    const fillDraft = `${takeoffDraftColor}${takeoffSnapHint ? "58" : "38"}`;
                    return (
                      <path
                        key="takeoff-box-draft"
                        className="print:hidden"
                        d={d}
                        fill={fillDraft}
                        stroke={takeoffDraftColor}
                        strokeWidth={takeoffSnapHint ? 2.75 : 2}
                        strokeDasharray="5 4"
                        opacity={takeoffSnapHint ? 1 : 0.92}
                        vectorEffect="non-scaling-stroke"
                        filter={
                          takeoffSnapHint ? `url(#takeoff-draft-snap-${pageIdx0})` : undefined
                        }
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="0"
                          to="18"
                          dur="1.1s"
                          repeatCount="indefinite"
                        />
                      </path>
                    );
                  })()}
                {tool === "takeoff" &&
                  takeoffDrawKind === "area" &&
                  takeoffAreaMode === "polygon" &&
                  takeoffAreaPts &&
                  takeoffAreaPts.length > 0 &&
                  (() => {
                    const pts = takeoffAreaPts.map((p) => ({ x: p.x * cssW, y: p.y * cssH }));
                    const pv = takeoffAreaPreview;
                    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                    return (
                      <g className="print:hidden">
                        <path
                          d={d + (pv ? ` L ${pv.x * cssW} ${pv.y * cssH}` : "")}
                          fill="none"
                          stroke={takeoffDraftColor}
                          strokeWidth={takeoffSnapHint ? 2.75 : 2}
                          strokeDasharray="4 3"
                          opacity={takeoffSnapHint ? 1 : 0.92}
                          vectorEffect="non-scaling-stroke"
                          filter={
                            takeoffSnapHint ? `url(#takeoff-draft-snap-${pageIdx0})` : undefined
                          }
                        >
                          <animate
                            attributeName="stroke-dashoffset"
                            from="0"
                            to="14"
                            dur="1.05s"
                            repeatCount="indefinite"
                          />
                        </path>
                        {takeoffAreaPts.length >= 3 && pv && (
                          <line
                            x1={pv.x * cssW}
                            y1={pv.y * cssH}
                            x2={takeoffAreaPts[0].x * cssW}
                            y2={takeoffAreaPts[0].y * cssH}
                            stroke={takeoffDraftColor}
                            strokeWidth={1}
                            strokeDasharray="3 4"
                            opacity={takeoffSnapHint ? 0.72 : 0.5}
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </g>
                    );
                  })()}
                {tool === "takeoff" &&
                  takeoffDrawKind === "count" &&
                  takeoffCountDraftPoints?.map((p, idx) => (
                    <g key={`takeoff-cd-${idx}`} className="print:hidden">
                      <circle
                        cx={p.x * cssW}
                        cy={p.y * cssH}
                        r={8}
                        fill={takeoffDraftColor}
                        fillOpacity={0.5}
                        stroke={takeoffDraftColor}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={p.x * cssW}
                        y={p.y * cssH}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#0f172a"
                        fontSize={10}
                        fontWeight={700}
                      >
                        {idx + 1 + countDraftLabelOffset}
                      </text>
                    </g>
                  ))}
                {selectMarquee && tool === "select" && (
                  <rect
                    className="print:hidden pointer-events-none"
                    x={Math.min(selectMarquee.start.x, selectMarquee.current.x) * cssW}
                    y={Math.min(selectMarquee.start.y, selectMarquee.current.y) * cssH}
                    width={Math.abs(selectMarquee.current.x - selectMarquee.start.x) * cssW}
                    height={Math.abs(selectMarquee.current.y - selectMarquee.start.y) * cssH}
                    fill="rgba(14,165,233,0.1)"
                    stroke="#0ea5e9"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {zoomMarquee && tool === "zoomArea" && (
                  <rect
                    className="print:hidden pointer-events-none"
                    x={Math.min(zoomMarquee.start.x, zoomMarquee.current.x) * cssW}
                    y={Math.min(zoomMarquee.start.y, zoomMarquee.current.y) * cssH}
                    width={Math.abs(zoomMarquee.current.x - zoomMarquee.start.x) * cssW}
                    height={Math.abs(zoomMarquee.current.y - zoomMarquee.start.y) * cssH}
                    fill="rgba(59,130,246,0.12)"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="5 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {remoteCollabSelectionRects.map(({ userId, color, bounds: b }) => (
                  <rect
                    key={`remote-sel-${userId}`}
                    className="pointer-events-none print:hidden"
                    x={b.minX}
                    y={b.minY}
                    width={b.maxX - b.minX}
                    height={b.maxY - b.minY}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    opacity={0.92}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {selectionBounds && (
                  <rect
                    className="print:hidden"
                    x={selectionBounds.minX}
                    y={selectionBounds.minY}
                    width={selectionBounds.maxX - selectionBounds.minX}
                    height={selectionBounds.maxY - selectionBounds.minY}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {markupHoverHighlight && (
                  <rect
                    className="print:hidden pointer-events-none"
                    x={markupHoverHighlight.x0}
                    y={markupHoverHighlight.y0}
                    width={markupHoverHighlight.rw}
                    height={markupHoverHighlight.rh}
                    fill="rgba(251, 191, 36, 0.1)"
                    stroke="rgba(251, 191, 36, 0.72)"
                    strokeWidth={1.25}
                    rx={4}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {selectionResizeHandles.map((h) =>
                  h.key === "dm" ? (
                    <circle
                      key={`rh-${h.key}`}
                      className="print:hidden"
                      cx={h.cx}
                      cy={h.cy}
                      r={5}
                      fill="#fff"
                      stroke="#0ea5e9"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <rect
                      key={`rh-${h.key}`}
                      className="print:hidden"
                      x={h.cx - 4}
                      y={h.cy - 4}
                      width={8}
                      height={8}
                      fill="#fff"
                      stroke="#0ea5e9"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  ),
                )}
                {brushHoverNorm &&
                  tool === "annotate" &&
                  (markupShape === "freehand" || markupShape === "highlight") &&
                  !draftPoints && (
                    <circle
                      className="print:hidden pointer-events-none"
                      cx={brushHoverNorm.x * cssW}
                      cy={brushHoverNorm.y * cssH}
                      r={
                        markupShape === "highlight"
                          ? highlightStrokeWidthPx(strokeWidth) / 2
                          : strokeWidth / 2
                      }
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      opacity={0.55}
                    />
                  )}
                {draftPoints && draftPoints.length >= 2 && (
                  <path
                    d={draftPoints
                      .map((p, i) => {
                        const x = p.x * cssW;
                        const y = p.y * cssH;
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={
                      markupShape === "highlight"
                        ? highlightStrokeWidthPx(strokeWidth)
                        : strokeWidth
                    }
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={markupShape === "highlight" ? 0.4 : 0.85}
                  />
                )}
                {lineMarkup && lineMarkup.b && (
                  <g style={markupShape === "arrow" ? { color: strokeColor } : undefined}>
                    <line
                      x1={lineMarkup.a.x * cssW}
                      y1={lineMarkup.a.y * cssH}
                      x2={lineMarkup.b.x * cssW}
                      y2={lineMarkup.b.y * cssH}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray="6 4"
                      opacity={0.9}
                      markerEnd={markupShape === "arrow" ? screenArrowMarkerUrl : undefined}
                    />
                  </g>
                )}
                {rectDrag &&
                  markupShape === "cloud" &&
                  (() => {
                    const x0 = Math.min(rectDrag.a.x, rectDrag.b.x) * cssW;
                    const y0 = Math.min(rectDrag.a.y, rectDrag.b.y) * cssH;
                    const x1 = Math.max(rectDrag.a.x, rectDrag.b.x) * cssW;
                    const y1 = Math.max(rectDrag.a.y, rectDrag.b.y) * cssH;
                    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
                    const d = cloudRectPathD(x0, y0, x1, y1);
                    if (!d) return null;
                    return (
                      <path
                        d={d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray="5 4"
                        opacity={0.85}
                      />
                    );
                  })()}
                {rectDrag && markupShape === "rect" && (
                  <rect
                    x={Math.min(rectDrag.a.x, rectDrag.b.x) * cssW}
                    y={Math.min(rectDrag.a.y, rectDrag.b.y) * cssH}
                    width={Math.abs(rectDrag.b.x - rectDrag.a.x) * cssW}
                    height={Math.abs(rectDrag.b.y - rectDrag.a.y) * cssH}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray="5 4"
                    opacity={0.85}
                  />
                )}
                {rectDrag &&
                  markupShape === "ellipse" &&
                  (() => {
                    const x = Math.min(rectDrag.a.x, rectDrag.b.x) * cssW;
                    const y = Math.min(rectDrag.a.y, rectDrag.b.y) * cssH;
                    const w = Math.abs(rectDrag.b.x - rectDrag.a.x) * cssW;
                    const h = Math.abs(rectDrag.b.y - rectDrag.a.y) * cssH;
                    const rx = w / 2;
                    const ry = h / 2;
                    return (
                      <ellipse
                        cx={x + rx}
                        cy={y + ry}
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray="5 4"
                        opacity={0.85}
                      />
                    );
                  })()}
                {rectDrag &&
                  markupShape === "cross" &&
                  (() => {
                    const x1 = Math.min(rectDrag.a.x, rectDrag.b.x) * cssW;
                    const y1 = Math.min(rectDrag.a.y, rectDrag.b.y) * cssH;
                    const x2 = Math.max(rectDrag.a.x, rectDrag.b.x) * cssW;
                    const y2 = Math.max(rectDrag.a.y, rectDrag.b.y) * cssH;
                    return (
                      <g opacity={0.85}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray="5 4"
                        />
                        <line
                          x1={x1}
                          y1={y2}
                          x2={x2}
                          y2={y1}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray="5 4"
                        />
                      </g>
                    );
                  })()}
                {rectDrag &&
                  markupShape === "diamond" &&
                  (() => {
                    const pts = diamondPointsFromRectCorners(rectDrag.a, rectDrag.b).map((p) => ({
                      x: p.x * cssW,
                      y: p.y * cssH,
                    }));
                    const d =
                      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
                    return (
                      <path
                        d={d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray="5 4"
                        opacity={0.85}
                      />
                    );
                  })()}
                {tool === "annotate" &&
                  markupShape === "polygon" &&
                  polygonMarkup &&
                  polygonMarkup.length > 0 &&
                  (() => {
                    const pts = polygonMarkup.map((p) => ({ x: p.x * cssW, y: p.y * cssH }));
                    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                    const pv = polygonPreview;
                    return (
                      <g>
                        <path
                          d={d + (pv ? ` L ${pv.x * cssW} ${pv.y * cssH}` : "")}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray="4 3"
                          opacity={0.88}
                        />
                        {polygonMarkup.length >= 3 && pv && (
                          <line
                            x1={pv.x * cssW}
                            y1={pv.y * cssH}
                            x2={polygonMarkup[0].x * cssW}
                            y2={polygonMarkup[0].y * cssH}
                            stroke={strokeColor}
                            strokeWidth={1}
                            strokeDasharray="3 4"
                            opacity={0.4}
                          />
                        )}
                      </g>
                    );
                  })()}
                {tool === "measure" &&
                  measureKind === "line" &&
                  measureStart &&
                  !measureEnd &&
                  measurePreview &&
                  calibrationByPage[pageIdx0] && (
                    <MeasurementDimensionSvg
                      p1n={measureStart}
                      p2n={measurePreview}
                      offsetPdf={0}
                      pageW={pageSize.w}
                      pageH={pageSize.h}
                      scale={scale}
                      color={measureLabelColor}
                      strokeWidth={strokeWidth}
                      mm={
                        pdfDistanceUnits(measureStart, measurePreview, pageSize.w, pageSize.h) *
                        calibrationByPage[pageIdx0]!.mmPerPdfUnit
                      }
                      measureUnit={measureUnit}
                      labelFontSize={measureLabelFontSize}
                      labelFill={measureLabelColor}
                    />
                  )}
                {tool === "measure" &&
                  measureKind === "line" &&
                  measureStart &&
                  measureEnd &&
                  calibrationByPage[pageIdx0] && (
                    <MeasurementDimensionSvg
                      p1n={measureStart}
                      p2n={measureEnd}
                      offsetPdf={measureOffsetPdf}
                      pageW={pageSize.w}
                      pageH={pageSize.h}
                      scale={scale}
                      color={measureLabelColor}
                      strokeWidth={strokeWidth}
                      mm={
                        pdfDistanceUnits(measureStart, measureEnd, pageSize.w, pageSize.h) *
                        calibrationByPage[pageIdx0]!.mmPerPdfUnit
                      }
                      measureUnit={measureUnit}
                      labelFontSize={measureLabelFontSize}
                      labelFill={measureLabelColor}
                    />
                  )}
                {tool === "measure" && measureKind === "line" && measureStart && (
                  <circle
                    cx={measureStart.x * cssW}
                    cy={measureStart.y * cssH}
                    r={4}
                    fill="none"
                    stroke={measureLabelColor}
                    strokeWidth={strokeWidth}
                  />
                )}
                {tool === "measure" &&
                  measureKind === "line" &&
                  measureStart &&
                  !measureEnd &&
                  measurePreview && (
                    <circle
                      cx={measurePreview.x * cssW}
                      cy={measurePreview.y * cssH}
                      r={4}
                      fill="none"
                      stroke={measureLabelColor}
                      strokeWidth={strokeWidth}
                      opacity={0.95}
                    />
                  )}
                {tool === "measure" &&
                  measureKind === "angle" &&
                  measureMultiPoints &&
                  measurePreview &&
                  measureMultiPoints.length === 1 && (
                    <line
                      x1={measureMultiPoints[0].x * cssW}
                      y1={measureMultiPoints[0].y * cssH}
                      x2={measurePreview.x * cssW}
                      y2={measurePreview.y * cssH}
                      stroke={measureLabelColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray="4 3"
                      opacity={0.9}
                    />
                  )}
                {tool === "measure" &&
                  measureKind === "angle" &&
                  measureMultiPoints &&
                  measurePreview &&
                  measureMultiPoints.length === 2 && (
                    <g>
                      <line
                        x1={measureMultiPoints[0].x * cssW}
                        y1={measureMultiPoints[0].y * cssH}
                        x2={measureMultiPoints[1].x * cssW}
                        y2={measureMultiPoints[1].y * cssH}
                        stroke={measureLabelColor}
                        strokeWidth={strokeWidth}
                        opacity={0.9}
                      />
                      <line
                        x1={measureMultiPoints[0].x * cssW}
                        y1={measureMultiPoints[0].y * cssH}
                        x2={measurePreview.x * cssW}
                        y2={measurePreview.y * cssH}
                        stroke={measureLabelColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray="4 3"
                        opacity={0.9}
                      />
                    </g>
                  )}
                {tool === "measure" &&
                  (measureKind === "area" || measureKind === "perimeter") &&
                  measureMultiPoints &&
                  measureMultiPoints.length > 0 &&
                  measurePreview && (
                    <g>
                      <path
                        d={`${measureMultiPoints
                          .map((p, i) => {
                            const x = p.x * cssW;
                            const y = p.y * cssH;
                            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                          })
                          .join(" ")} L ${measurePreview.x * cssW} ${measurePreview.y * cssH}`}
                        fill="none"
                        stroke={measureLabelColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="5 4"
                        opacity={0.9}
                      />
                      {measureKind === "area" && measureMultiPoints.length >= 3 && (
                        <line
                          x1={measureMultiPoints[measureMultiPoints.length - 1].x * cssW}
                          y1={measureMultiPoints[measureMultiPoints.length - 1].y * cssH}
                          x2={measureMultiPoints[0].x * cssW}
                          y2={measureMultiPoints[0].y * cssH}
                          stroke={measureLabelColor}
                          strokeWidth={1}
                          strokeDasharray="3 4"
                          opacity={0.45}
                        />
                      )}
                    </g>
                  )}
                {tool === "measure" &&
                  measureMultiPoints &&
                  measureMultiPoints.map((p, i) => (
                    <circle
                      key={`md-${i}`}
                      cx={p.x * cssW}
                      cy={p.y * cssH}
                      r={3.5}
                      fill="none"
                      stroke={measureLabelColor}
                      strokeWidth={1.25}
                      opacity={0.95}
                    />
                  ))}
                {calibrateDraft.length >= 1 && (
                  <circle
                    cx={calibrateDraft[0].x * cssW}
                    cy={calibrateDraft[0].y * cssH}
                    r={6}
                    fill="none"
                    stroke="#c026d3"
                    strokeWidth={2}
                  />
                )}
                {tool === "calibrate" &&
                  !calibrateOpen &&
                  calibrateDraft.length === 1 &&
                  calibratePreview &&
                  (() => {
                    const pdfDCal = pdfDistanceUnits(
                      calibrateDraft[0],
                      calibratePreview,
                      pageSize.w,
                      pageSize.h,
                    );
                    const calRow = calibrationByPage[pageIdx0];
                    const mmLive = calRow
                      ? pdfDCal * calRow.mmPerPdfUnit
                      : pdfLengthPdfUnitsToMm(pdfDCal);
                    const deltaSubtitle =
                      calibrateTargetMm != null &&
                      calibrateTargetMm > 0 &&
                      Number.isFinite(calibrateTargetMm)
                        ? formatSignedDeltaMm(mmLive - calibrateTargetMm, measureUnit)
                        : null;
                    return (
                      <g className="print:hidden">
                        <line
                          x1={calibrateDraft[0].x * cssW}
                          y1={calibrateDraft[0].y * cssH}
                          x2={calibratePreview.x * cssW}
                          y2={calibratePreview.y * cssH}
                          stroke="#c026d3"
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                          opacity={0.92}
                        />
                        <MeasurementDimensionSvg
                          p1n={calibrateDraft[0]}
                          p2n={calibratePreview}
                          offsetPdf={0}
                          pageW={pageSize.w}
                          pageH={pageSize.h}
                          scale={scale}
                          color="#c026d3"
                          strokeWidth={1.5}
                          mm={mmLive}
                          measureUnit={measureUnit}
                          labelFontSize={measureLabelFontSize}
                          labelFill="#c026d3"
                          labelOnly
                          subtitle={deltaSubtitle}
                        />
                      </g>
                    );
                  })()}
              </svg>
              {selectedLinkedIssueLabel && selectionBounds ? (
                <div
                  className="pointer-events-none absolute z-[6] max-w-[min(240px,72vw)] truncate rounded-md border border-sky-500/40 bg-[#0F172A]/95 px-2 py-0.5 text-[10px] font-medium leading-tight text-sky-100 shadow-md ring-1 ring-sky-500/20 backdrop-blur-sm print:hidden"
                  style={{
                    left: selectionBounds.minX,
                    top: Math.max(2, selectionBounds.minY - 24),
                  }}
                >
                  {selectedLinkedIssueLabel}
                </div>
              ) : null}
            </Fragment>
          )}
          {viewerCollab?.collabActive &&
            viewerCollab.remoteCursors.some((c) => c.pageIndex === pageIdx0) && (
              <div className="pointer-events-none absolute inset-0 z-[6] print:hidden" aria-hidden>
                {viewerCollab.remoteCursors
                  .filter((c) => c.pageIndex === pageIdx0)
                  .map((c) => {
                    const peer = collabPeerByUserId.get(c.userId);
                    const peerName = peer?.name ?? `Teammate ${c.userId.slice(0, 6)}`;
                    const fill = collabColorForUser(c.userId);
                    const labelNudgeY = collabCursorLabelNudgeY(c.userId);
                    const pointerFilter = `drop-shadow(0 1px 2px rgb(0 0 0 / 0.55)) drop-shadow(0 0 10px ${fill}b3)`;
                    /** Lucide 24×24 path tip ≈ (4.037, 4.688) — anchor broadcast point to tip. */
                    const pointerSize = 28;
                    const pointerTipX = (4.037 * pointerSize) / 24;
                    const pointerTipY = (4.688 * pointerSize) / 24;
                    return (
                      <div
                        key={c.userId}
                        className="absolute motion-safe:transition-[left,top] motion-safe:duration-100 motion-safe:ease-out motion-reduce:transition-none"
                        style={{
                          left: `${c.x * 100}%`,
                          top: `${c.y * 100}%`,
                        }}
                        title={`${peerName} — on this page`}
                      >
                        <div
                          className="relative block"
                          style={{
                            transform: `translate(-${pointerTipX}px, -${pointerTipY}px)`,
                            filter: pointerFilter,
                          }}
                        >
                          <MousePointer2
                            size={pointerSize}
                            aria-hidden
                            fill={fill}
                            color="#0f172a"
                            strokeWidth={1.5}
                            className="block"
                          />
                        </div>
                        <div
                          className="absolute flex max-w-[min(220px,60vw)] items-center gap-1.5 rounded-lg border bg-[#0f172a]/95 py-1 pl-1 pr-2 shadow-lg ring-1 ring-black/20 backdrop-blur-sm"
                          style={{
                            left: 16,
                            top: 12 + labelNudgeY,
                            borderColor: `${fill}73`,
                            boxShadow: `0 4px 14px rgb(0 0 0 / 0.35), 0 0 0 1px ${fill}40`,
                          }}
                        >
                          <span
                            className="shrink-0 rounded-full p-0.5 ring-2 ring-white/95"
                            style={{
                              boxShadow: `0 0 0 1px ${fill}cc`,
                              backgroundColor: fill,
                            }}
                          >
                            <ViewerUserThumb
                              shape="circle"
                              name={peerName}
                              email={peer?.email}
                              image={peer?.image}
                              className="h-7 w-7 border-0 text-[10px]"
                            />
                          </span>
                          <span className="min-w-0 truncate text-[11px] font-semibold leading-tight tracking-tight text-slate-100">
                            {peerName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
        </div>
      </div>

      {!compareReferenceOnly && (
        <div
          className="pdf-print-only relative bg-white"
          style={{ width: printCssW, height: printCssH }}
        >
          <canvas
            ref={printCanvasRef}
            className="pointer-events-none block max-w-none print:break-inside-avoid"
            style={{ width: printCssW, height: printCssH }}
          />
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={printCssW}
            height={printCssH}
            viewBox={`0 0 ${printCssW} ${printCssH}`}
            preserveAspectRatio="none"
          >
            <CommittedAnnotationsSvg
              annotations={annotations}
              cssW={printCssW}
              cssH={printCssH}
              pageW={pageSize.w}
              pageH={pageSize.h}
              scale={PRINT_PDF_SCALE}
              measureUnit={measureUnit}
              arrowMarkerId={`markup-arrow-print-${pageIdx0}`}
            />
          </svg>
        </div>
      )}

      {sheetContextMenu && (
        <SheetContextMenu
          key={`${sheetContextMenu.clientX}-${sheetContextMenu.clientY}-${sheetContextMenu.hitId ?? "x"}`}
          clientX={sheetContextMenu.clientX}
          clientY={sheetContextMenu.clientY}
          hitId={sheetContextMenu.hitId}
          showEditComment={
            !!sheetContextMenu.hitId &&
            annotations.find((a) => a.id === sheetContextMenu.hitId)?.type === "text"
          }
          onClose={() => setSheetContextMenu(null)}
          onAddComment={() => {
            const n = sheetContextMenu.norm;
            setMarkupShape("text");
            setTool("annotate");
            setTextCommentEditId(null);
            setTextAnchor(n);
            setTextCommentOpen(true);
          }}
          onSelectTool={() => setTool("select")}
          onSelectOnlyThis={() => {
            if (sheetContextMenu.hitId) setSelectedAnnotationIds([sheetContextMenu.hitId]);
          }}
          onEditComment={() => {
            const id = sheetContextMenu.hitId;
            if (!id) return;
            const a = annotations.find((x) => x.id === id);
            if (!a || a.type !== "text" || !a.points[0]) return;
            setTextCommentEditId(id);
            setTextAnchor(a.points[0]);
            setTextCommentOpen(true);
            setTool("select");
            setSelectedAnnotationIds([id]);
          }}
          onDelete={() => {
            const hitId = sheetContextMenu.hitId;
            if (!hitId) return;
            const st0 = useViewerStore.getState();
            const hitA = st0.annotations.find((x) => x.id === hitId);
            if (hitA && annotationIsIssuePin(hitA)) return;
            const sel = st0.selectedAnnotationIds;
            if (sel.includes(hitId) && sel.length > 0) {
              const toRemove = filterAnnotationIdsExcludingIssuePins(st0.annotations, sel);
              if (toRemove.length > 0) removeAnnotations(toRemove);
            } else {
              removeAnnotation(hitId);
            }
          }}
          showDelete={(() => {
            if (!sheetContextMenu.hitId) return true;
            const h = annotations.find((a) => a.id === sheetContextMenu.hitId);
            return !h || !annotationIsIssuePin(h);
          })()}
          onCopy={() => {
            const hitId = sheetContextMenu.hitId;
            if (!hitId) return;
            setSelectedAnnotationIds([hitId]);
            copyAnnotationsToClipboard([hitId]);
          }}
          onDuplicate={() => {
            const hitId = sheetContextMenu.hitId;
            if (!hitId) return;
            setSelectedAnnotationIds([hitId]);
            duplicateAnnotationsOnPage(pageIdx0, { x: 0.002, y: 0.002 });
          }}
          onToggleLock={() => {
            const hitId = sheetContextMenu.hitId;
            if (!hitId) return;
            const a = annotations.find((x) => x.id === hitId);
            if (!a) return;
            updateAnnotation(hitId, { locked: !a.locked });
          }}
          hitLocked={!!annotations.find((a) => a.id === sheetContextMenu.hitId)?.locked}
        />
      )}

      <TextCommentDialog
        key={`${textCommentEditId ?? "new"}-${textAnchor?.x ?? 0}-${textAnchor?.y ?? 0}`}
        open={textCommentOpen}
        anchorRef={overlayRef}
        anchorNorm={textAnchor}
        title={textCommentEditId ? "Edit comment" : "Comment"}
        description={textCommentEditId ? "Update the note on the sheet." : "Placed at your click."}
        confirmLabel={textCommentEditId ? "Save" : "Place"}
        initialText={
          textCommentEditId ? (annotations.find((a) => a.id === textCommentEditId)?.text ?? "") : ""
        }
        onCancel={() => {
          setTextCommentOpen(false);
          setTextAnchor(null);
          setTextCommentEditId(null);
        }}
        onConfirm={(text) => {
          if (textCommentEditId) {
            updateAnnotation(textCommentEditId, { text });
            setTextCommentEditId(null);
          } else if (textAnchor) {
            addAnnotation({
              pageIndex: pageIdx0,
              type: "text",
              color: strokeColor,
              strokeWidth,
              points: [textAnchor],
              text,
              fontSize: 12,
              textColor: strokeColor,
              textBoxFillFromFrame: useViewerStore.getState().textBoxFillFromFrame,
              author: displayName,
            });
          }
          setTextCommentOpen(false);
          setTextAnchor(null);
        }}
      />

      <CalibrateNeededDialog
        open={calibrateNeededOpen}
        onClose={() => setCalibrateNeededOpen(false)}
      />

      <CalibrateDialog
        key={calibrateKey}
        open={calibrateOpen}
        initialKnownMm={calibrateDialogInitialMm}
        anchorRef={overlayRef}
        midNorm={
          calibrateOpen && calibrateDraft.length >= 2
            ? {
                x: (calibrateDraft[0].x + calibrateDraft[1].x) / 2,
                y: (calibrateDraft[0].y + calibrateDraft[1].y) / 2,
              }
            : null
        }
        onCancel={() => {
          setCalibrateOpen(false);
          setCalibrateDraft([]);
        }}
        onConfirm={(knownMm) => {
          const draft = useViewerStore.getState().calibrateDraft;
          if (draft.length < 2) return;
          const [p1, p2] = draft;
          const pdfD = pdfDistanceUnits(p1, p2, pageSize.w, pageSize.h);
          if (pdfD <= 0) return;
          const mmPerPdfUnit = knownMm / pdfD;
          setCalibration(pageIdx0, mmPerPdfUnit);
          saveLastCalibrationKnownMm(fileName, numPages, pageIdx0, knownMm);
          setCalibrateOpen(false);
          setCalibrateDraft([]);
          setTool("measure");
        }}
      />
    </>
  );
}
