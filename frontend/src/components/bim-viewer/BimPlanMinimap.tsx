"use client";

import { ChevronDown, Map } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BimEngine } from "./bimEngine";
import type { PlanStoreyOption } from "./BimSplitViewPane";
import { BimWalkPlanSizeControl } from "./BimWalkPlanSizeControl";
import type { BimWalkPlanSize } from "@/lib/bim/walkPlanSize";
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

// fallow-ignore-next-line complexity
export function BimPlanMinimap(props: {
  engine: BimEngine | null;
  storeys: string[];
  storeyOptions?: PlanStoreyOption[];
  selectedStorey: string | null;
  onSelectStorey: (storey: string | null) => void;
  variant?: "floating" | "split";
  planSize?: BimWalkPlanSize;
  onPlanSizeChange?: (size: BimWalkPlanSize) => void;
}) {
  const variant = props.variant ?? "floating";
  const isSplit = variant === "split";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragMode | null>(null);
  const mapPxRef = useRef(PLAN_MINIMAP_PX);
  const [mapPx, setMapPx] = useState(PLAN_MINIMAP_PX);
  const floorOptions =
    props.storeyOptions && props.storeyOptions.length > 0
      ? props.storeyOptions
      : props.storeys.map((storey) => ({ value: storey, label: storey }));

  useEffect(() => {
    if (!isSplit) {
      mapPxRef.current = PLAN_MINIMAP_PX;
      setMapPx(PLAN_MINIMAP_PX);
      return;
    }
    const mapEl = mapContainerRef.current;
    if (!mapEl) return;
    const syncSize = () => {
      const size = Math.max(200, Math.min(mapEl.clientWidth, mapEl.clientHeight, 640));
      mapPxRef.current = size;
      setMapPx(size);
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(mapEl);
    return () => ro.disconnect();
  }, [isSplit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const tick = () => {
      const px = mapPxRef.current;
      const state = props.engine?.getPlanMinimapState();
      if (state) {
        drawPlanMinimap(ctx, px, state);
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, px, px);
        ctx.fillStyle = "#64748b";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading plan…", px / 2, px / 2);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.engine, mapPx]);

  useEffect(() => {
    void props.engine?.setPlanMinimapStorey(props.selectedStorey);
  }, [props.engine, props.selectedStorey]);

  // fallow-ignore-next-line complexity
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = props.engine;
    if (!canvas || !engine) return;

    const px = mapPxRef.current;
    const state = engine.getPlanMinimapState();
    if (!state?.bounds) return;

    const pt = mapPointer(canvas, e.clientX, e.clientY);
    const hit = hitTestPlanMinimap(pt.x, pt.y, px, state);
    if (hit.kind === "none") return;

    canvas.setPointerCapture(e.pointerId);

    if (hit.kind === "pan") {
      dragRef.current = { kind: "pan" };
      return;
    }

    if (hit.kind === "rotate") {
      const anchorMap = worldToMap(state.anchorX, state.anchorZ, state.bounds, px);
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

    const px = mapPxRef.current;
    const state = engine.getPlanMinimapState();
    if (!state?.bounds) return;

    const pt = mapPointer(canvas, e.clientX, e.clientY);

    if (drag.kind === "pan") {
      const world = mapToWorld(pt.x, pt.y, state.bounds, px);
      void engine.applyPlanMinimapPose({ x: world.x, z: world.z });
      return;
    }

    const anchorMap = worldToMap(state.anchorX, state.anchorZ, state.bounds, px);
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
    <div
      className={`bim-plan-minimap${isSplit ? " bim-plan-minimap--split" : ""}`}
      aria-label="Plan minimap navigator"
    >
      {!isSplit ? (
        <div className="bim-plan-minimap__header">
          <div className="bim-plan-minimap__title">
            <Map className="bim-plan-minimap__icon" aria-hidden />
            <span className="bim-plan-minimap__label">Plan</span>
          </div>
          {floorOptions.length > 0 ? (
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
                {floorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="bim-plan-minimap__floor-icon" aria-hidden />
            </div>
          ) : null}
          {props.planSize && props.onPlanSizeChange ? (
            <BimWalkPlanSizeControl
              className="bim-plan-minimap__size"
              size={props.planSize}
              onChange={props.onPlanSizeChange}
            />
          ) : null}
        </div>
      ) : null}
      <div ref={mapContainerRef} className="bim-plan-minimap__map">
        <canvas
          ref={canvasRef}
          width={mapPx}
          height={mapPx}
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
