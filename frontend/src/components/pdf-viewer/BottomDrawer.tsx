"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, GripHorizontal } from "lucide-react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BottomDrawerSnap } from "@/lib/bottomDrawerSnap";

export type { BottomDrawerSnap };

type Snap = BottomDrawerSnap;

const RESIZE_DEBOUNCE_MS = 120;
const MAGNET_PX = 14;

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
  /** When the drawer is collapsed (minimal height), show this instead of `title` if set. */
  titleWhenCollapsed?: ReactNode;
  /** Right side of chrome row (e.g. Export). */
  headerRight?: ReactNode;
  className?: string;
  /** When false, Escape does not collapse (e.g. takeoff redraw/move modes). */
  escapeToCollapseEnabled?: boolean;
  /** Hydration: first snap after mount (e.g. from localStorage). */
  initialSnap?: Snap;
  /** Called when snap settles (not during drag). */
  onSnapSettled?: (info: { snap: Snap; heightPx: number }) => void;
  /** Increment to programmatically open at least half height (e.g. after new zone save). */
  expandRequestNonce?: number;
  /** Increment to expand to the "full" snap (e.g. inventory full screen). */
  expandFullscreenNonce?: number;
  /** Increment to snap back to half height (e.g. leaving inventory full screen). */
  collapseToHalfNonce?: number;
  /** Visual polish when inventory uses viewport “full” height. */
  inventoryFullscreen?: boolean;
  /** Global: Ctrl+` / ⌘+J toggles collapsed ↔ last half/full. */
  keyboardToggleEnabled?: boolean;
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

function applyMagnet(h: number, collapsedPx: number, half: number, full: number, magnetPx: number) {
  const targets = [collapsedPx, half, full];
  for (const t of targets) {
    if (Math.abs(h - t) <= magnetPx) return t;
  }
  return h;
}

function snapLabel(s: Snap): string {
  if (s === "collapsed") return "Collapsed";
  if (s === "half") return "Half height";
  return "Full height";
}

/**
 * Bottom overlay drawer: collapsed / half / full height, pointer drag to resize.
 * z-index must stay below takeoff slider (z-[85]) and modals (z-[90]) — set by parent wrapper.
 */
export const BottomDrawer = forwardRef<HTMLDivElement, BottomDrawerProps>(function BottomDrawer(
  {
    collapsedPx: collapsedPxProp = 40,
    snapHeightsPx,
    children,
    title,
    titleWhenCollapsed,
    headerRight,
    className = "",
    escapeToCollapseEnabled = true,
    initialSnap = "collapsed",
    onSnapSettled,
    expandRequestNonce = 0,
    expandFullscreenNonce = 0,
    collapseToHalfNonce = 0,
    inventoryFullscreen = false,
    keyboardToggleEnabled = true,
  },
  ref,
) {
  const collapsedPx = snapHeightsPx ? snapHeightsPx[0] : collapsedPxProp;
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const { half: halfFromVh, full: fullFromVh } = snapHeights(vh, collapsedPx);
  const halfH = snapHeightsPx ? snapHeightsPx[1] : halfFromVh;
  const fullH = snapHeightsPx ? snapHeightsPx[2] : fullFromVh;

  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [dragPx, setDragPx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    pointerId: number;
  } | null>(null);

  const lastOpenSnapRef = useRef<"half" | "full">(initialSnap === "full" ? "full" : "half");

  /** Latest snap targets for pointer handlers (stable listener identity via ref object). */
  const layoutRef = useRef({ collapsedPx, fullH, halfH });

  const endDragRef = useRef<(clientY: number) => void>(() => {});
  const lastExpandNonceRef = useRef(expandRequestNonce);
  const lastExpandFsNonceRef = useRef(expandFullscreenNonce);
  const lastCollapseHalfNonceRef = useRef(collapseToHalfNonce);

  const pointerHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  useLayoutEffect(() => {
    layoutRef.current = { collapsedPx, fullH, halfH };
  }, [collapsedPx, fullH, halfH]);

  useEffect(() => {
    if (snap === "half" || snap === "full") lastOpenSnapRef.current = snap;
  }, [snap]);

  useLayoutEffect(() => {
    if (pointerHandlersRef.current != null) return;
    pointerHandlersRef.current = {
      move: (e: PointerEvent) => {
        if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
        const { collapsedPx: c, fullH: f, halfH: h } = layoutRef.current;
        const dy = dragRef.current.startY - e.clientY;
        let nextH = Math.max(c, Math.min(f, dragRef.current.startH + dy));
        nextH = applyMagnet(nextH, c, h, f, MAGNET_PX);
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
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = undefined;
        setVh(window.innerHeight);
      }, RESIZE_DEBOUNCE_MS);
    };
    ro();
    window.addEventListener("resize", ro);
    return () => {
      window.removeEventListener("resize", ro);
      if (t) clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (expandRequestNonce > lastExpandNonceRef.current) {
      lastExpandNonceRef.current = expandRequestNonce;
      setSnap("half");
    }
  }, [expandRequestNonce]);

  useEffect(() => {
    if (expandFullscreenNonce > lastExpandFsNonceRef.current) {
      lastExpandFsNonceRef.current = expandFullscreenNonce;
      setSnap("full");
    }
  }, [expandFullscreenNonce]);

  useEffect(() => {
    if (collapseToHalfNonce > lastCollapseHalfNonceRef.current) {
      lastCollapseHalfNonceRef.current = collapseToHalfNonce;
      setSnap("half");
    }
  }, [collapseToHalfNonce]);

  const heightPx = dragPx ?? (snap === "collapsed" ? collapsedPx : snap === "half" ? halfH : fullH);

  const previewSnap = isDragging ? nearestSnap(heightPx, collapsedPx, halfH, fullH) : snap;

  const endDrag = useCallback((clientY: number) => {
    const start = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!start) return;
    const { collapsedPx: c, fullH: f, halfH: h } = layoutRef.current;
    const dy = start.startY - clientY;
    let nextH = Math.max(c, Math.min(f, start.startH + dy));
    nextH = applyMagnet(nextH, c, h, f, MAGNET_PX);
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

  const cycleSnap = useCallback(() => {
    setSnap((s) => {
      if (s === "collapsed") return "half";
      if (s === "half") return "full";
      return "collapsed";
    });
  }, []);

  const onDoubleClickChrome = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cycleSnap();
    },
    [cycleSnap],
  );

  const prevSnapForNotifyRef = useRef<Snap | null>(null);
  useEffect(() => {
    if (isDragging || !onSnapSettled) return;
    if (prevSnapForNotifyRef.current === null) {
      prevSnapForNotifyRef.current = snap;
      return;
    }
    if (prevSnapForNotifyRef.current === snap) return;
    prevSnapForNotifyRef.current = snap;
    const h = snap === "collapsed" ? collapsedPx : snap === "half" ? halfH : fullH;
    onSnapSettled({ snap, heightPx: h });
  }, [snap, collapsedPx, halfH, fullH, isDragging, onSnapSettled]);

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

  useEffect(() => {
    if (!keyboardToggleEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.closest("input, textarea, select, [contenteditable='true']") ||
          t.getAttribute("role") === "textbox")
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const isBackquote = e.key === "`" || e.code === "Backquote";
      const isJ = e.key.toLowerCase() === "j";
      if (!mod || (!isBackquote && !isJ)) return;
      e.preventDefault();
      setSnap((s) => {
        if (s === "collapsed") return lastOpenSnapRef.current;
        lastOpenSnapRef.current = s === "full" ? "full" : "half";
        return "collapsed";
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboardToggleEnabled]);

  const expanded = heightPx > collapsedPx + 4;

  const pctOfVh = vh > 0 ? Math.round((heightPx / vh) * 100) : 0;
  const ariaValueText = isDragging
    ? `${Math.round(heightPx)} pixels, ${pctOfVh}% of viewport, snaps to ${snapLabel(previewSnap)}`
    : `${snapLabel(snap)}, ${Math.round(heightPx)} pixels`;

  const showSnapIndicators = isDragging;
  const targetsForDots: { snap: Snap; px: number }[] = [
    { snap: "collapsed", px: collapsedPx },
    { snap: "half", px: halfH },
    { snap: "full", px: fullH },
  ];

  const chromeTitle = !expanded && titleWhenCollapsed != null ? titleWhenCollapsed : title;

  return (
    <div
      ref={ref}
      data-takeoff-inventory-drawer
      className={`pointer-events-auto relative flex max-h-[min(100dvh,100vh)] flex-col rounded-t-lg border border-[#334155] border-b-0 bg-[#0f172a] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.45)] ${
        inventoryFullscreen ? "ring-1 ring-[#475569]/60" : ""
      } ${className}`}
      style={{
        height: heightPx,
        transition: isDragging ? "none" : "height 200ms ease-in-out",
      }}
    >
      {isDragging ? (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#475569] bg-[#0f172a]/95 px-2 py-1 text-[10px] font-medium tabular-nums text-[#e2e8f0] shadow-lg"
          aria-hidden
        >
          {Math.round(heightPx)} px · {pctOfVh}% · {snapLabel(previewSnap)}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col border-b border-[#334155] bg-[#0f172a] select-none">
        <div
          role="slider"
          tabIndex={0}
          aria-valuemin={collapsedPx}
          aria-valuemax={fullH}
          aria-valuenow={Math.round(heightPx)}
          aria-valuetext={ariaValueText}
          aria-label="Resize inventory panel height"
          onPointerDown={startDrag}
          onDoubleClick={onDoubleClickChrome}
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
          className="flex h-5 cursor-ns-resize flex-col items-center justify-center rounded-t-lg pt-0.5"
        >
          <GripHorizontal className="h-4 w-4 text-[#94a3b8]" strokeWidth={2.25} aria-hidden />
          {showSnapIndicators ? (
            <div className="flex w-full justify-center gap-3 px-4 pb-0.5">
              {targetsForDots.map(({ snap: ds }) => {
                const active = previewSnap === ds;
                return (
                  <span
                    key={ds}
                    className={`h-1 w-6 rounded-full transition-colors ${
                      active ? "bg-[#38bdf8]" : "bg-[#334155]"
                    }`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
        <div
          className="flex min-h-[28px] cursor-pointer items-center gap-2 px-2 pb-1"
          onClick={(e) => {
            const el = e.target as HTMLElement;
            if (el.closest("button, a, [role=listbox]")) return;
            e.stopPropagation();
            setSnap((s) => (s === "collapsed" ? "half" : "collapsed"));
          }}
        >
          <span
            className="pointer-events-none flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#334155] bg-[#1e293b]/90 text-[#cbd5e1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            aria-hidden
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
            )}
          </span>
          <div className="min-w-0 flex-1 text-[11px] font-semibold text-[#e2e8f0]">
            {chromeTitle}
          </div>
          {headerRight ? (
            <div
              className="shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
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
});
