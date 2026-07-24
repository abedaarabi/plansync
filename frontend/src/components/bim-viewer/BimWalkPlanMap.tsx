"use client";

import { useEffect, useRef } from "react";
import type { BimEngine } from "./bimEngine";
import { drawWalkPlanMap, WALK_PLAN_MAP_PX } from "@/lib/bim/walkMinimap";

export function BimWalkPlanMap(props: { engine: BimEngine | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const tick = () => {
      const state = props.engine?.getWalkPlanState();
      if (state) {
        drawWalkPlanMap(ctx, WALK_PLAN_MAP_PX, state);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.engine]);

  return (
    <div className="bim-walk-minimap bim-glass-surface" aria-label="Walk mode plan map">
      <span className="bim-walk-minimap__label">Plan</span>
      <canvas
        ref={canvasRef}
        width={WALK_PLAN_MAP_PX}
        height={WALK_PLAN_MAP_PX}
        className="bim-walk-minimap__canvas"
      />
    </div>
  );
}
