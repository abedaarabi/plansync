import type { RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ResizeHandleKey, TextLayoutPx } from "@/lib/annotationResize";

/**
 * Public props for `PdfPageView`: one rendered PDF page plus refs for scroll/minimap wiring.
 */
export type PdfPageViewProps = {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  /** Called after on-screen page bitmap render completes. */
  onScreenRenderComplete?: (info: {
    pageNumber: number;
    renderMs: number;
    renderScale: number;
  }) => void;
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

/** Active resize/transform session for a selected annotation (handles + bounds). */
export type ResizeSession = {
  id: string;
  handle: ResizeHandleKey;
  startPoints: { x: number; y: number }[];
  startBounds: { minX: number; minY: number; maxX: number; maxY: number };
  startFontSize?: number;
  startTextLayout?: TextLayoutPx;
};

/** Pointer-drag state for adjusting an in-progress line measure before commit. */
export type MeasureLineDrag =
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
