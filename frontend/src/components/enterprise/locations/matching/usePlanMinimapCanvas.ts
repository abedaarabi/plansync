"use client";

import { useEffect, useState, type RefObject } from "react";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { cssToCanvasPx } from "@/lib/canvasRenderQuality";
import { drawPlanMinimap } from "@/lib/bim/planMinimap";

/** Resize-aware plan silhouette canvas (no navigator) for registration panes. */
export function usePlanMinimapCanvas(
  engine: BimEngine | null,
  sizeElRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  resizeDeps: unknown[] = [],
): number {
  const [mapPx, setMapPx] = useState(1024);

  useEffect(() => {
    const el = sizeElRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const size = Math.min(el.clientWidth, el.clientHeight);
      setMapPx(cssToCanvasPx(size));
    });
    ro.observe(el);
    const size = Math.min(el.clientWidth, el.clientHeight);
    if (size > 0) setMapPx(cssToCanvasPx(size));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass resize triggers
  }, [sizeElRef, ...resizeDeps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;
    canvas.width = mapPx;
    canvas.height = mapPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const tick = () => {
      const state = engine.getPlanMinimapState();
      if (state) drawPlanMinimap(ctx, mapPx, state, { hideNavigator: true });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, mapPx, canvasRef]);

  return mapPx;
}
