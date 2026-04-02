"use client";

import type { ReactNode } from "react";
import { ChevronUp, GripHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
type Snap = "collapsed" | "half" | "full";

export type BottomDrawerProps = {
  /** Collapsed total height in CSS px (chrome only). Ignored when `snapHeightsPx` is set (uses its first value). */
  collapsedPx?: number;
  /**
   * Fixed [collapsed, half, full] heights in px (e.g. inventory panel: 40, 200, 400).
   * When set, viewport-based snap targets are not used.
   */
  snapHeightsPx?: readonly [number, number, number];
  children: ReactNode;
  /** Main label (e.g. inventory count). */
  title: ReactNode;
  /** Right side of chrome row (e.g. Export). */
  headerRight?: ReactNode;
  className?: string;
  /** When false, Escape does not collapse (e.g. takeoff redraw/move modes). */
  escapeToCollapseEnabled?: boolean;
  /** Increment to programmatically open at least half height (e.g. after new zone save). */
  expandRequestNonce?: number;
};

function snapHeights(vh: number, collapsedPx: number) {
  const half = Math.max(collapsedPx + 80, Math.round(vh * 0.35));
  const full = Math.max(half + 40, Math.round(vh * 0.78));
  return { half, full };
}

function nearestSnap(h: number, collapsedPx: number, half: number, full: number): Snap {
  const targets = [
    { snap: "collapsed" as const, px: collapsedPx },
    { snap: "half" as const, px: half },
    { snap: "full" as const, px: full },
  ];
  let best = targets[0]!;
  let bestD = Math.abs(h - best.px);
  for (const t of targets) {
    const d = Math.abs(h - t.px);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best.snap;
}

/**
 * Bottom overlay drawer: collapsed / half / full height, pointer drag to resize.
 * z-index must stay below takeoff slider (z-[85]) and modals (z-[90]) — set by parent wrapper.
 */
export function BottomDrawer({
  collapsedPx: collapsedPxProp = 40,
  snapHeightsPx,
  children,
  title,
  headerRight,
  className = "",
  escapeToCollapseEnabled = true,
  expandRequestNonce = 0,
}: BottomDrawerProps) {
  const collapsedPx = snapHeightsPx ? snapHeightsPx[0] : collapsedPxProp;
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const { half: halfFromVh, full: fullFromVh } = snapHeights(vh, collapsedPx);
  const halfH = snapHeightsPx ? snapHeightsPx[1] : halfFromVh;
  const fullH = snapHeightsPx ? snapHeightsPx[2] : fullFromVh;

  const [snap, setSnap] = useState<Snap>("collapsed");
  const [dragPx, setDragPx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    pointerId: number;
  } | null>(null);

  /** Latest snap targets for pointer handlers (stable listener identity via ref object). */
  const layoutRef = useRef({ collapsedPx, fullH, halfH });

  const endDragRef = useRef<(clientY: number) => void>(() => {});
  const lastExpandNonceRef = useRef(expandRequestNonce);

  const pointerHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  useLayoutEffect(() => {
    layoutRef.current = { collapsedPx, fullH, halfH };
  }, [collapsedPx, fullH, halfH]);

  useLayoutEffect(() => {
    if (pointerHandlersRef.current != null) return;
    pointerHandlersRef.current = {
      move: (e: PointerEvent) => {
        if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
        const { collapsedPx: c, fullH: f } = layoutRef.current;
        const dy = dragRef.current.startY - e.clientY;
        const nextH = Math.max(c, Math.min(f, dragRef.current.startH + dy));
        setDragPx(nextH);
      },
      up: (e: PointerEvent) => {
        const h = pointerHandlersRef.current;
        if (!h || !dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
        window.removeEventListener("pointermove", h.move);
        window.removeEventListener("pointerup", h.up);
        window.removeEventListener("pointercancel", h.up);
        endDragRef.current(e.clientY);
      },
    };
  }, []);

  useLayoutEffect(() => {
    const ro = () => setVh(window.innerHeight);
    ro();
    window.addEventListener("resize", ro);
    return () => window.removeEventListener("resize", ro);
  }, []);

  useEffect(() => {
    if (expandRequestNonce > lastExpandNonceRef.current) {
      lastExpandNonceRef.current = expandRequestNonce;
      setSnap("half");
    }
  }, [expandRequestNonce]);

  const heightPx = dragPx ?? (snap === "collapsed" ? collapsedPx : snap === "half" ? halfH : fullH);

  const endDrag = useCallback((clientY: number) => {
    const start = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!start) return;
    const { collapsedPx: c, fullH: f, halfH: h } = layoutRef.current;
    const dy = start.startY - clientY;
    const nextH = Math.max(c, Math.min(f, start.startH + dy));
    setDragPx(null);
    setSnap(nearestSnap(nextH, c, h, f));
  }, []);

  useLayoutEffect(() => {
    endDragRef.current = endDrag;
  }, [endDrag]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const { collapsedPx: c, fullH: f, halfH: h } = layoutRef.current;
      const startH = dragPx ?? (snap === "collapsed" ? c : snap === "half" ? h : f);
      dragRef.current = {
        startY: e.clientY,
        startH,
        pointerId: e.pointerId,
      };
      setIsDragging(true);
      setDragPx(startH);
      const ph = pointerHandlersRef.current!;
      window.addEventListener("pointermove", ph.move);
      window.addEventListener("pointerup", ph.up);
      window.addEventListener("pointercancel", ph.up);
    },
    [dragPx, snap],
  );

  useEffect(() => {
    if (!escapeToCollapseEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (snap === "collapsed") return;
      const el = document.activeElement;
      if (el && el.closest?.("[data-takeoff-inventory-drawer]")) {
        e.preventDefault();
        setSnap("collapsed");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escapeToCollapseEnabled, snap]);

  const expanded = heightPx > collapsedPx + 4;

  return (
    <div
      data-takeoff-inventory-drawer
      className={`pointer-events-auto flex max-h-[min(100dvh,100vh)] flex-col rounded-t-lg border border-[#334155] border-b-0 bg-[#0f172a] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.45)] ${className}`}
      style={{
        height: heightPx,
        transition: isDragging ? "none" : "height 200ms ease-in-out",
      }}
    >
      <div className="flex shrink-0 flex-col border-b border-[#334155] bg-[#0f172a] select-none">
        <div
          role="slider"
          tabIndex={0}
          aria-valuemin={collapsedPx}
          aria-valuemax={fullH}
          aria-valuenow={Math.round(heightPx)}
          aria-label="Resize inventory panel height"
          onPointerDown={startDrag}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSnap((s) => (s === "collapsed" ? "half" : s === "half" ? "full" : "full"));
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSnap((s) => (s === "full" ? "half" : s === "half" ? "collapsed" : "collapsed"));
            }
          }}
          className="flex h-5 cursor-ns-resize items-center justify-center pt-0.5"
        >
          <GripHorizontal className="h-3.5 w-3.5 text-[#64748b]" aria-hidden />
        </div>
        <div
          className="flex min-h-[28px] items-center gap-2 px-2 pb-1"
          onClick={(e) => {
            e.stopPropagation();
            if (snap === "collapsed") setSnap("half");
          }}
        >
          <ChevronUp
            className={`h-3.5 w-3.5 shrink-0 text-[#64748b] transition-transform duration-200 ${
              expanded ? "" : "-rotate-180"
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1 text-[11px] font-semibold text-[#e2e8f0]">{title}</div>
          {headerRight ? (
            <div className="shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              {headerRight}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          expanded ? "" : "pointer-events-none invisible h-0 min-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
