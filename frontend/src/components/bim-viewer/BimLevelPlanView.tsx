"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Loader2, Map } from "lucide-react";
import type { BimEngine } from "./bimEngine";
import { BimPdfPageEmbed } from "./BimPdfPageEmbed";
import { drawPlanMinimap } from "@/lib/bim/planMinimap";
import { fetchLevelMappings, type BuildingLevel } from "@/lib/api-client/locations";
import { PickPaneZoomControls } from "@/components/enterprise/locations/matching/PickPaneZoomControls";
import { qk } from "@/lib/queryKeys";

const PLAN_VIEW_PX = 1400;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;

type Props = {
  engine: BimEngine | null;
  /** Engine-resolved storey name to slice. */
  storey: string | null;
  level: BuildingLevel;
  onShowModel: () => void;
};

/** Full-pane 2D plan cut with pan/zoom, rendered from the engine plan silhouette. */
export function BimLevelPlanView({ engine, storey, level, onShowModel }: Props) {
  const levelName = level.name;
  const wantDrawing = level.displaySource === "DRAWING" && level.mappedDrawingCount > 0;
  const { data: mappings = [] } = useQuery({
    queryKey: qk.levelMappings(level.id),
    queryFn: () => fetchLevelMappings(level.id),
    enabled: wantDrawing,
  });
  const drawing = wantDrawing ? (mappings[0] ?? null) : null;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    if (!engine || !storey) return;
    let cancelled = false;
    setReady(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    engine.setPlanBakeResolution(PLAN_VIEW_PX);
    void engine.setPlanMinimapStorey(storey).then(() => {
      if (!cancelled) setReady(false);
    });
    return () => {
      cancelled = true;
      engine.setPlanBakeResolution(512);
    };
  }, [engine, storey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine || wantDrawing) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const tick = () => {
      const state = engine.getPlanMinimapState();
      if (state) {
        drawPlanMinimap(ctx, PLAN_VIEW_PX, state, { hideNavigator: true });
        if (state.silhouette && !state.baking) setReady(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, wantDrawing]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const next = z * (e.deltaY < 0 ? 1.12 : 0.89);
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.panX + (e.clientX - d.x), y: d.panY + (e.clientY - d.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="bim-level-plan absolute inset-0 z-[6] flex flex-col bg-[var(--bim-canvas)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--bim-border)] bg-[var(--bim-panel)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--bim-border)] bg-[var(--bim-hover)] text-[var(--bim-icon)]">
            <Map className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
              {drawing ? "Matched drawing" : "2D plan"}
            </p>
            <p className="truncate text-sm font-medium text-[var(--bim-text)]">{levelName}</p>
          </div>
        </div>
        <button
          type="button"
          className="bim-glass-surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--bim-text)]"
          onClick={onShowModel}
        >
          <Box className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
          3D model
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {drawing ? (
            <div
              className="h-full w-full select-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <BimPdfPageEmbed
                fileId={drawing.pdfFileId}
                fileVersionId={drawing.pdfFileVersionId}
                pageIndex={drawing.pageIndex}
                className="h-full w-full bg-white"
              />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={PLAN_VIEW_PX}
              height={PLAN_VIEW_PX}
              className="max-h-full max-w-full select-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                imageRendering: "auto",
              }}
            />
          )}
        </div>

        {!ready && !drawing ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--bim-text-muted)]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <p className="text-sm">Extracting plan…</p>
          </div>
        ) : null}

        <PickPaneZoomControls
          className="absolute bottom-2 right-2"
          variant="bim"
          onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}
          onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))}
          onReset={resetView}
        />
      </div>
    </div>
  );
}
