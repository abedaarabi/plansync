"use client";

import { useRef } from "react";
import { Layers3, Loader2, RotateCw } from "lucide-react";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { snapCutDisplayRotation, type CutDisplayRotation } from "@/lib/locations/calibrationMath";
import type { CanvasPoint } from "../CalibrationCanvas";
import { PLAN_MARKER_COLORS, PointMarkers } from "./PointMarkers";
import { PickPaneViewport } from "./PickPaneViewport";
import { usePlanMinimapCanvas } from "./usePlanMinimapCanvas";

type Props = {
  engine: BimEngine | null;
  planLoading: boolean;
  planPoints: CanvasPoint[];
  planPickActive: boolean;
  onPlanPick: (pt: CanvasPoint) => void;
  cutRotationDeg?: CutDisplayRotation;
  onCutRotate?: (deg: CutDisplayRotation) => void;
};

/** IFC cut plan with numbered pick markers and optional display rotation. */
export function PlanPickPane({
  engine,
  planLoading,
  planPoints,
  planPickActive,
  onPlanPick,
  cutRotationDeg = 0,
  onCutRotate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<HTMLDivElement | null>(null);
  usePlanMinimapCanvas(engine, sizeRef, canvasRef, [engine]);

  return (
    <div className="registration-pane relative flex min-h-0 flex-1 flex-col">
      <div className="registration-pane-header">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
            <Layers3 className="h-3 w-3" aria-hidden />
          </span>
          <p className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
            IFC cut
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onCutRotate ? (
            <>
              <button
                type="button"
                className="registration-toolbar-btn h-7 w-7"
                aria-label="Rotate cut 90°"
                title="Rotate 90°"
                onClick={() => onCutRotate(snapCutDisplayRotation(cutRotationDeg + 90))}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className="registration-toolbar-btn h-7 min-w-7 px-1 text-xs font-semibold"
                aria-label="Rotate cut 180°"
                title="Rotate 180°"
                onClick={() => onCutRotate(snapCutDisplayRotation(cutRotationDeg + 180))}
              >
                180°
              </button>
            </>
          ) : null}
          {planPickActive ? (
            <span className="shrink-0 rounded-full bg-[var(--enterprise-primary)] px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
              Tap a point
            </span>
          ) : null}
        </div>
      </div>
      {engine ? (
        <PickPaneViewport pickTargetRef={sizeRef} pickActive={planPickActive} onPick={onPlanPick}>
          {({ zoom }) => (
            <div ref={sizeRef} className="relative aspect-square max-h-full max-w-full">
              <div className="h-full w-full" style={{ transform: `rotate(${cutRotationDeg}deg)` }}>
                <canvas ref={canvasRef} className="block h-full w-full" />
                <div className="pointer-events-none absolute inset-0">
                  <PointMarkers points={planPoints} colors={PLAN_MARKER_COLORS} viewScale={zoom} />
                </div>
              </div>
            </div>
          )}
        </PickPaneViewport>
      ) : (
        <div className="registration-canvas flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Loader2
            className="h-6 w-6 animate-spin text-[var(--enterprise-text-muted)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            {planLoading ? "Loading 3D model…" : "Upload an IFC to extract the level plan"}
          </p>
        </div>
      )}
      {engine && planLoading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--enterprise-surface)]/75 p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--enterprise-primary)]" aria-hidden />
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            Extracting plan from 3D model…
          </p>
        </div>
      ) : null}
    </div>
  );
}
