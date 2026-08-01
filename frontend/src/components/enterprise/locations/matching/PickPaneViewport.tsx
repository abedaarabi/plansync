"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import type { CanvasPoint } from "../CalibrationCanvas";
import { PickPaneZoomControls } from "./PickPaneZoomControls";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;
const PICK_DRAG_THRESHOLD_PX = 5;

function normFromElement(clientX: number, clientY: number, el: HTMLElement): CanvasPoint | null {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

type PickPaneView = { zoom: number; pan: { x: number; y: number } };

type Props = {
  children: ReactNode | ((view: PickPaneView) => ReactNode);
  /** Element whose bounds define normalized pick coordinates (e.g. canvas). */
  pickTargetRef: React.RefObject<HTMLElement | null>;
  pickActive?: boolean;
  onPick?: (pt: CanvasPoint) => void;
  className?: string;
};

/** Pan/zoom viewport for calibration pick panes — scroll to zoom, drag to pan, click to pick. */
export function PickPaneViewport({
  children,
  pickTargetRef,
  pickActive = false,
  onPick,
  className = "",
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const next = z * (e.deltaY < 0 ? 1.12 : 0.89);
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) >= PICK_DRAG_THRESHOLD_PX) d.moved = true;
    setPan({ x: d.panX + dx, y: d.panY + dy });
  };

  const endPointer = (e: PointerEvent) => {
    const d = dragRef.current;
    if (d && pickActive && onPick && !d.moved) {
      const target = pickTargetRef.current;
      if (target) {
        const pt = normFromElement(e.clientX, e.clientY, target);
        if (pt) onPick(pt);
      }
    }
    dragRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const cursorClass = pickActive ? "cursor-crosshair" : "cursor-grab";
  const view: PickPaneView = { zoom, pan };

  return (
    <div
      className={`relative min-h-0 flex-1 touch-none overflow-hidden registration-canvas ${className}`}
      onWheel={onWheel}
    >
      <div
        className={`absolute inset-0 flex items-center justify-center active:cursor-grabbing ${cursorClass}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {typeof children === "function" ? children(view) : children}
      </div>

      <PickPaneZoomControls
        className="absolute bottom-1.5 right-1.5"
        onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))}
        onReset={resetView}
      />
    </div>
  );
}
