"use client";

import { useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { BimPdfPageEmbed } from "@/components/bim-viewer/BimPdfPageEmbed";
import { overlayTransformCss, type OverlayTransform } from "@/lib/locations/calibrationMath";
import type { CanvasPoint } from "../CalibrationCanvas";
import { PDF_MARKER_COLORS, PLAN_MARKER_COLORS, PointMarkers } from "./PointMarkers";
import { usePlanMinimapCanvas } from "./usePlanMinimapCanvas";

type Props = {
  engine: BimEngine | null;
  planLoading: boolean;
  pdfFileId: string | null;
  pdfFileVersionId: string | null;
  pdfPageIndex?: number;
  pdfPoints: CanvasPoint[];
  planPoints: CanvasPoint[];
  transform: OverlayTransform;
  overlayOpacity: number;
  onPageSizePt?: (widthPt: number, heightPt: number) => void;
  controls?: ReactNode;
};

/** Right region: live composite of the PDF over the IFC cut for confirming alignment. */
export function OverlayPreviewPane({
  engine,
  planLoading,
  pdfFileId,
  pdfFileVersionId,
  pdfPageIndex = 0,
  pdfPoints,
  planPoints,
  transform,
  overlayOpacity,
  onPageSizePt,
  controls,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePlanMinimapCanvas(engine, containerRef, canvasRef);

  return (
    <div ref={containerRef} className="registration-canvas relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {engine ? (
          <canvas ref={canvasRef} className="h-full w-full max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Loader2
              className="h-6 w-6 animate-spin text-[var(--enterprise-text-muted)]"
              aria-hidden
            />
            <p className="text-sm text-[var(--enterprise-text-muted)]">Loading plan…</p>
          </div>
        )}
        <PointMarkers points={planPoints} colors={PLAN_MARKER_COLORS} />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[5] flex flex-col"
        style={{
          opacity: overlayOpacity,
          ...overlayTransformCss(transform),
        }}
      >
        {pdfFileId ? (
          <BimPdfPageEmbed
            fileId={pdfFileId}
            fileVersionId={pdfFileVersionId}
            pageIndex={pdfPageIndex}
            className="h-full w-full overflow-hidden bg-transparent"
            quality="high"
            fit="stretch"
            onPageSizePt={onPageSizePt}
            overlay={
              <PointMarkers
                points={pdfPoints}
                colors={PDF_MARKER_COLORS}
                viewScale={transform.scale}
              />
            }
          />
        ) : null}
      </div>

      {engine && planLoading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--enterprise-surface)]/70">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--enterprise-primary)]" aria-hidden />
        </div>
      ) : null}

      {controls ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/95 px-2 py-1.5">
          {controls}
        </div>
      ) : null}
    </div>
  );
}
