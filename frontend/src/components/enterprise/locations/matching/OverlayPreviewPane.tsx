"use client";

import { useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { BimPdfPageEmbed } from "@/components/bim-viewer/BimPdfPageEmbed";
import {
  overlayTransformCss,
  type CutDisplayRotation,
  type OverlayTransform,
} from "@/lib/locations/calibrationMath";
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
  cutRotationDeg?: CutDisplayRotation;
};

/** Composite of the PDF over the IFC cut in one shared square frame. */
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
  cutRotationDeg = 0,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePlanMinimapCanvas(engine, frameRef, canvasRef);

  return (
    <div className="registration-canvas relative flex h-full w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <div
          ref={frameRef}
          className="relative aspect-square max-h-full max-w-full"
          style={{ transform: cutRotationDeg ? `rotate(${cutRotationDeg}deg)` : undefined }}
        >
          {engine ? (
            <canvas ref={canvasRef} className="block h-full w-full" />
          ) : (
            <div className="flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 p-6 text-center">
              <Loader2
                className="h-6 w-6 animate-spin text-[var(--enterprise-text-muted)]"
                aria-hidden
              />
              <p className="text-sm text-[var(--enterprise-text-muted)]">Loading plan…</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0">
            <PointMarkers points={planPoints} colors={PLAN_MARKER_COLORS} />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[5]"
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
        </div>
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
