"use client";

import { useRef } from "react";
import { FileText } from "lucide-react";
import { BimPdfPageEmbed } from "@/components/bim-viewer/BimPdfPageEmbed";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import type { CanvasPoint } from "../CalibrationCanvas";
import { PDF_MARKER_COLORS, PointMarkers } from "./PointMarkers";
import { PickPaneViewport } from "./PickPaneViewport";

type Props = {
  pdfFileId: string | null;
  pdfFileVersionId: string | null;
  pdfPageIndex?: number;
  pdfPoints: CanvasPoint[];
  pdfPickActive: boolean;
  onPdfPick: (pt: CanvasPoint) => void;
  onPageSizePt?: (widthPt: number, heightPt: number) => void;
};

/** Top-left region: the source PDF drawing with numbered pick markers. */
export function PdfPickPane({
  pdfFileId,
  pdfFileVersionId,
  pdfPageIndex = 0,
  pdfPoints,
  pdfPickActive,
  onPdfPick,
  onPageSizePt,
}: Props) {
  const pickTargetRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="registration-pane flex min-h-0 flex-1 flex-col">
      <div className="registration-pane-header">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-primary-soft)]">
            <PdfFileIcon className="h-3.5 w-3.5 shrink-0" />
          </span>
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
            Drawing
          </p>
        </div>
        {pdfPickActive ? (
          <span className="shrink-0 rounded-full bg-[var(--enterprise-primary)] px-2 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
            Tap a point
          </span>
        ) : null}
      </div>
      {pdfFileId ? (
        <PickPaneViewport
          pickTargetRef={pickTargetRef}
          pickActive={pdfPickActive}
          onPick={onPdfPick}
        >
          {({ zoom }) => (
            <div className="relative max-h-full max-w-full">
              <BimPdfPageEmbed
                fileId={pdfFileId}
                fileVersionId={pdfFileVersionId}
                pageIndex={pdfPageIndex}
                pickSurfaceRef={pickTargetRef}
                className="max-h-full max-w-full overflow-hidden bg-transparent"
                quality="high"
                onPageSizePt={onPageSizePt}
                overlay={
                  <PointMarkers points={pdfPoints} colors={PDF_MARKER_COLORS} viewScale={zoom} />
                }
              />
            </div>
          )}
        </PickPaneViewport>
      ) : (
        <div className="registration-canvas flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <FileText className="h-7 w-7 text-[var(--enterprise-text-muted)]" aria-hidden />
          <p className="text-sm text-[var(--enterprise-text-muted)]">Preparing your PDF…</p>
        </div>
      )}
    </div>
  );
}
