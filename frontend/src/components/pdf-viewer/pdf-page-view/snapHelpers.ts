import { snapMeasureGridAxisAligned, snapMeasureLineEndOrtho } from "@/lib/measureGeometry";
import type { SnapSegment } from "@/lib/pdfSnapGeometry";
import { snapNormalizedPoint } from "@/lib/snap";
import { useViewerStore, type MarkupShape, type Tool } from "@/store/viewerStore";
import { overlayCssSizePx } from "./coordHelpers";

/** Softer snap for continuous strokes (pen / Hi / poly); crisp snap for lines, rects, measure, etc. */
export function snapStrokeContext(tool: Tool, markupShape: MarkupShape): "default" | "drawStroke" {
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
export function measureOrthoEnd(
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
export function snapMeasureLineEndpoint(
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

/**
 * Global snap for markup: reads current tool/mode from the viewer store (calibrate + measure
 * use softer radii than crisp annotation strokes).
 */
export function snapNorm(
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
  let rPx = st.snapRadiusPx;
  if (context === "drawStroke") {
    rPx *= 0.52;
  }
  /** Measure / takeoff / calibrate: soft pull so the chord follows the cursor over the art instead of jumping/sticking. */
  if (measureLikeSnap || calibrateMode) {
    rPx *= 0.58;
  }
  const layerFilter =
    st.snapLayerIds === null || st.snapLayerIds.length === 0 ? "all" : new Set(st.snapLayerIds);
  const blend: "hard" | "soft" =
    context === "drawStroke" || measureLikeSnap || calibrateMode ? "soft" : "hard";
  return snapNormalizedPoint(nx, ny, segments, rPx, w, h, layerFilter, {
    blend,
  });
}
