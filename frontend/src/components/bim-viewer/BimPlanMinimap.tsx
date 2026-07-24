"use client";

import { ChevronDown, Map } from "lucide-react";
import { useEffect, useRef } from "react";
import type { BimEngine } from "./bimEngine";
import {
  drawPlanMinimap,
  hitTestPlanMinimap,
  mapToWorld,
  PLAN_MINIMAP_PX,
  worldToMap,
} from "@/lib/bim/planMinimap";

type DragMode =
  | { kind: "pan" }
  | { kind: "rotate"; startPointerAngle: number; baseHeading: number };

function mapPointer(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function BimPlanMinimap(props: {
  engine: BimEngine | null;
  storeys: string[];
  selectedStorey: string | null;
  onSelectStorey: (storey: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragMode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const tick = () => {
      const state = props.engine?.getPlanMinimapState();
      if (state) {
        drawPlanMinimap(ctx, PLAN_MINIMAP_PX, state);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.engine]);

  useEffect(() => {
    void props.engine?.setPlanMinimapStorey(props.selectedStorey);
  }, [props.engine, props.selectedStorey]);

  // fallow-ignore-next-line complexity
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = props.engine;
    if (!canvas || !engine) return;

    const state = engine.getPlanMinimapState();
    if (!state?.bounds) return;

    const pt = mapPointer(canvas, e.clientX, e.clientY);
    const hit = hitTestPlanMinimap(pt.x, pt.y, PLAN_MINIMAP_PX, state);
    if (hit.kind === "none") return;

    canvas.setPointerCapture(e.pointerId);

    if (hit.kind === "pan") {
      dragRef.current = { kind: "pan" };
      return;
    }

    if (hit.kind === "rotate") {
      const anchorMap = worldToMap(state.anchorX, state.anchorZ, state.bounds, PLAN_MINIMAP_PX);
      const dx = pt.x - anchorMap.x;
      const dy = pt.y - anchorMap.y;
      dragRef.current = {
        kind: "rotate",
        startPointerAngle: Math.atan2(dy, dx),
        baseHeading: state.heading,
      };
      return;
    }

    void engine.applyPlanMinimapPose({
      x: hit.worldX,
      z: hit.worldZ,
      animate: true,
    });
  };

  // fallow-ignore-next-line complexity
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = props.engine;
    const drag = dragRef.current;
    if (!canvas || !engine || !drag) return;

    const state = engine.getPlanMinimapState();
    if (!state?.bounds) return;

    const pt = mapPointer(canvas, e.clientX, e.clientY);

    if (drag.kind === "pan") {
      const world = mapToWorld(pt.x, pt.y, state.bounds, PLAN_MINIMAP_PX);
      void engine.applyPlanMinimapPose({ x: world.x, z: world.z });
      return;
    }

    const anchorMap = worldToMap(state.anchorX, state.anchorZ, state.bounds, PLAN_MINIMAP_PX);
    const dx = pt.x - anchorMap.x;
    const dy = pt.y - anchorMap.y;
    const pointerAngle = Math.atan2(dy, dx);
    const heading = drag.baseHeading + (pointerAngle - drag.startPointerAngle);
    void engine.applyPlanMinimapPose({
      x: state.anchorX,
      z: state.anchorZ,
      heading,
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div className="bim-plan-minimap" aria-label="Plan minimap navigator">
      <div className="bim-plan-minimap__header">
        <div className="bim-plan-minimap__title">
          <Map className="bim-plan-minimap__icon" aria-hidden />
          <span className="bim-plan-minimap__label">Plan</span>
        </div>
        {props.storeys.length > 0 ? (
          <div className="bim-plan-minimap__floor-wrap">
            <select
              className="bim-plan-minimap__floor bim-focus-ring"
              aria-label="Floor level"
              value={props.selectedStorey ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                props.onSelectStorey(value === "" ? null : value);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">All levels</option>
              {props.storeys.map((storey) => (
                <option key={storey} value={storey}>
                  {storey}
                </option>
              ))}
            </select>
            <ChevronDown className="bim-plan-minimap__floor-icon" aria-hidden />
          </div>
        ) : null}
      </div>
      <div className="bim-plan-minimap__map">
        <canvas
          ref={canvasRef}
          width={PLAN_MINIMAP_PX}
          height={PLAN_MINIMAP_PX}
          className="bim-plan-minimap__canvas"
          aria-label="Interactive floor plan"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
