"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type DockBox = { left: number; top: number; width: number; height: number };

const EDGE_MARGIN = 8;
/** Below this width docks render as bottom sheets, where free dragging makes no sense. */
const DRAG_MIN_VIEWPORT = 640;

function clampToViewport(value: number, max: number) {
  return Math.min(Math.max(value, EDGE_MARGIN), Math.max(EDGE_MARGIN, max));
}

/**
 * Lets a docked panel be picked up by its header and parked anywhere over the
 * canvas. Dragging freezes the measured size so the panel stops stretching
 * between the CSS top/bottom anchors.
 */
export function useDockDrag(enabled: boolean) {
  const panelRef = useRef<HTMLElement | null>(null);
  const grabRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const [box, setBox] = useState<DockBox | null>(null);

  useEffect(() => {
    if (!box) return;
    const onResize = () => {
      grabRef.current = null;
      setBox(null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [box]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return;
      if (window.innerWidth < DRAG_MIN_VIEWPORT) return;
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      grabRef.current = {
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const grab = grabRef.current;
    if (!grab || grab.pointerId !== e.pointerId) return;
    setBox({
      left: clampToViewport(e.clientX - grab.offsetX, window.innerWidth - grab.width - EDGE_MARGIN),
      top: clampToViewport(
        e.clientY - grab.offsetY,
        window.innerHeight - grab.height - EDGE_MARGIN,
      ),
      width: grab.width,
      height: grab.height,
    });
  }, []);

  const onDragEnd = useCallback(() => {
    grabRef.current = null;
  }, []);

  const onReset = useCallback(() => {
    grabRef.current = null;
    setBox(null);
  }, []);

  return {
    panelRef,
    panelStyle: box
      ? {
          left: box.left,
          top: box.top,
          right: "auto",
          bottom: "auto",
          width: box.width,
          height: box.height,
        }
      : undefined,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onDragEnd,
      onPointerCancel: onDragEnd,
      onDoubleClick: onReset,
    },
  };
}
