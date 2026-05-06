"use client";

import { rectPolygonFromTwoCornersNorm } from "@/lib/takeoffCompute";
import {
  formatSignedDeltaMm,
  pdfDistanceUnits,
  pdfLengthPdfUnitsToMm,
  type MeasureUnit,
} from "@/lib/coords";
import { highlightStrokeWidthPx } from "@/lib/highlightStroke";
import { cloudRectPathD } from "@/lib/cloudPath";
import { diamondPointsFromRectCorners } from "./coordHelpers";
import { CommittedAnnotationsSvg } from "../CommittedAnnotationsSvg";
import { TakeoffZonesSvg } from "../TakeoffZonesSvg";
import { MeasurementDimensionSvg } from "./MeasurementDimensionSvg";
import type { SnapSegment } from "@/lib/pdfSnapGeometry";
import type { Annotation, Calibration, MarkupShape, MeasureKind, Tool } from "@/store/viewerStore";
import type { TakeoffItem, TakeoffMeasurementType, TakeoffZone } from "@/lib/takeoffTypes";
import type { ResizeHandleHit } from "@/lib/annotationResize";

export type PdfPageScreenSvgProps = {
  pageIdx0: number;
  cssW: number;
  cssH: number;
  layerHighlightSegments: SnapSegment[];
  toolbarHoveredLayerId: string | null;
  snapHoverHighlightSegments: SnapSegment[];
  snapHoverPathIndex: number | null;
  scale: number;
  visibleAnnotations: Annotation[];
  selectedAnnotationIds: string[];
  screenArrowMarkerId: string;
  screenArrowMarkerUrl: string;
  takeoffZonesForScreen: TakeoffZone[];
  takeoffItemsById: Map<string, TakeoffItem>;
  takeoffSelectedZoneIds: string[];
  takeoffSelectedItemId: string | null;
  takeoffHoverZoneId: string | null;
  takeoffHoverItemId: string | null;
  takeoffMoveZoneId: string | null;
  tool: Tool;
  takeoffVertexEditZoneId: string | null;
  takeoffDrawKind: TakeoffMeasurementType;
  takeoffLineStart: { x: number; y: number } | null;
  takeoffLinePreview: { x: number; y: number } | null;
  takeoffDraftColor: string;
  takeoffSnapHint: boolean;
  takeoffAreaMode: "polygon" | "box";
  takeoffRectAnchor: { x: number; y: number } | null;
  takeoffRectPreview: { x: number; y: number } | null;
  takeoffAreaPts: { x: number; y: number }[] | null;
  takeoffAreaPreview: { x: number; y: number } | null;
  takeoffCountDraftPoints: { x: number; y: number }[] | null;
  countDraftLabelOffset: number;
  selectMarquee: {
    pointerId: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null;
  zoomMarquee: {
    pointerId: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null;
  remoteCollabSelectionRects: {
    userId: string;
    color: string;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  }[];
  selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  markupHoverHighlight: { x0: number; y0: number; rw: number; rh: number } | null;
  selectionResizeHandles: ResizeHandleHit[];
  brushHoverNorm: { x: number; y: number } | null;
  markupShape: MarkupShape;
  draftPoints: { x: number; y: number }[] | null;
  strokeColor: string;
  strokeWidth: number;
  lineMarkup: { a: { x: number; y: number }; b?: { x: number; y: number } } | null;
  rectDrag: { a: { x: number; y: number }; b: { x: number; y: number } } | null;
  polygonMarkup: { x: number; y: number }[] | null;
  polygonPreview: { x: number; y: number } | null;
  measureKind: MeasureKind;
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  measurePreview: { x: number; y: number } | null;
  measureOffsetPdf: number;
  calibrationByPage: Record<number, Calibration>;
  measureLabelColor: string;
  measureLabelFontSize: number;
  measureUnit: MeasureUnit;
  pageW: number;
  pageH: number;
  measureMultiPoints: { x: number; y: number }[] | null;
  calibrateDraft: { x: number; y: number }[];
  calibrateOpen: boolean;
  calibratePreview: { x: number; y: number } | null;
  calibrateTargetMm: number | null;
};

/** On-screen SVG overlay: snap highlights, committed markups, takeoff, selection chrome, measure/calibrate drafts. */
export function PdfPageScreenSvg(props: PdfPageScreenSvgProps) {
  const {
    pageIdx0,
    cssW,
    cssH,
    layerHighlightSegments,
    toolbarHoveredLayerId,
    snapHoverHighlightSegments,
    snapHoverPathIndex,
    scale,
    visibleAnnotations,
    selectedAnnotationIds,
    screenArrowMarkerId,
    screenArrowMarkerUrl,
    takeoffZonesForScreen,
    takeoffItemsById,
    takeoffSelectedZoneIds,
    takeoffSelectedItemId,
    takeoffHoverZoneId,
    takeoffHoverItemId,
    takeoffMoveZoneId,
    tool,
    takeoffVertexEditZoneId,
    takeoffDrawKind,
    takeoffLineStart,
    takeoffLinePreview,
    takeoffDraftColor,
    takeoffSnapHint,
    takeoffAreaMode,
    takeoffRectAnchor,
    takeoffRectPreview,
    takeoffAreaPts,
    takeoffAreaPreview,
    takeoffCountDraftPoints,
    countDraftLabelOffset,
    selectMarquee,
    zoomMarquee,
    remoteCollabSelectionRects,
    selectionBounds,
    markupHoverHighlight,
    selectionResizeHandles,
    brushHoverNorm,
    markupShape,
    draftPoints,
    strokeColor,
    strokeWidth,
    lineMarkup,
    rectDrag,
    polygonMarkup,
    polygonPreview,
    measureKind,
    measureStart,
    measureEnd,
    measurePreview,
    measureOffsetPdf,
    calibrationByPage,
    measureLabelColor,
    measureLabelFontSize,
    measureUnit,
    pageW,
    pageH,
    measureMultiPoints,
    calibrateDraft,
    calibrateOpen,
    calibratePreview,
    calibrateTargetMm,
  } = props;

  return (
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
        annotations={visibleAnnotations}
        cssW={cssW}
        cssH={cssH}
        pageW={pageW}
        pageH={pageH}
        scale={scale}
        measureUnit={measureUnit}
        arrowMarkerId={screenArrowMarkerId}
        selectedAnnotationIds={selectedAnnotationIds}
      />
      <TakeoffZonesSvg
        zones={takeoffZonesForScreen}
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
          const z = takeoffZonesForScreen.find((tz) => tz.id === takeoffVertexEditZoneId);
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
            rp.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * cssW} ${p.y * cssH}`).join(" ") + " Z";
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
              filter={takeoffSnapHint ? `url(#takeoff-draft-snap-${pageIdx0})` : undefined}
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
                filter={takeoffSnapHint ? `url(#takeoff-draft-snap-${pageIdx0})` : undefined}
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
            markupShape === "highlight" ? highlightStrokeWidthPx(strokeWidth) : strokeWidth
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
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
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
            pageW={pageW}
            pageH={pageH}
            scale={scale}
            color={measureLabelColor}
            strokeWidth={strokeWidth}
            mm={
              pdfDistanceUnits(measureStart, measurePreview, pageW, pageH) *
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
            pageW={pageW}
            pageH={pageH}
            scale={scale}
            color={measureLabelColor}
            strokeWidth={strokeWidth}
            mm={
              pdfDistanceUnits(measureStart, measureEnd, pageW, pageH) *
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
        calibrateDraft.length === 2 &&
        (() => {
          const pdfDCal = pdfDistanceUnits(calibrateDraft[0], calibrateDraft[1], pageW, pageH);
          const calRow = calibrationByPage[pageIdx0];
          const mmLive = calRow ? pdfDCal * calRow.mmPerPdfUnit : pdfLengthPdfUnitsToMm(pdfDCal);
          const deltaSubtitle =
            calibrateTargetMm != null && calibrateTargetMm > 0 && Number.isFinite(calibrateTargetMm)
              ? formatSignedDeltaMm(mmLive - calibrateTargetMm, measureUnit)
              : null;
          return (
            <g className="print:hidden">
              <line
                x1={calibrateDraft[0].x * cssW}
                y1={calibrateDraft[0].y * cssH}
                x2={calibrateDraft[1].x * cssW}
                y2={calibrateDraft[1].y * cssH}
                stroke="#c026d3"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.95}
              />
              <circle
                cx={calibrateDraft[1].x * cssW}
                cy={calibrateDraft[1].y * cssH}
                r={6}
                fill="none"
                stroke="#c026d3"
                strokeWidth={2}
              />
              <MeasurementDimensionSvg
                p1n={calibrateDraft[0]}
                p2n={calibrateDraft[1]}
                offsetPdf={0}
                pageW={pageW}
                pageH={pageH}
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
      {tool === "calibrate" &&
        !calibrateOpen &&
        calibrateDraft.length === 1 &&
        calibratePreview &&
        (() => {
          const pdfDCal = pdfDistanceUnits(calibrateDraft[0], calibratePreview, pageW, pageH);
          const calRow = calibrationByPage[pageIdx0];
          const mmLive = calRow ? pdfDCal * calRow.mmPerPdfUnit : pdfLengthPdfUnitsToMm(pdfDCal);
          const deltaSubtitle =
            calibrateTargetMm != null && calibrateTargetMm > 0 && Number.isFinite(calibrateTargetMm)
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
                pageW={pageW}
                pageH={pageH}
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
  );
}
