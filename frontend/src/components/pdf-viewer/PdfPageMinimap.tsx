"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import { useViewerStore } from "@/store/viewerStore";

const MINIMAP_MAX_W = 180;
/** Compare mode stacks two panes — cap height so the floating card stays usable on tall pages / when zoomed. */
const MINIMAP_COMPARE_MAX_W = 160;
const MINIMAP_COMPARE_MAX_H = 112;

export type MinimapFocusRect = { fx0: number; fy0: number; fw: number; fh: number };

type Props = {
  scrollRef: RefObject<HTMLDivElement | null>;
  /**
   * Compare mode: scroll surface that actually contains the page for this minimap’s viewport
   * (left pane vs right). Defaults to `scrollRef`. Pointer panning still uses `scrollRef` + markup
   * page so both columns stay in sync.
   */
  viewportScrollRef?: RefObject<HTMLDivElement | null>;
  sourceCanvasRef: RefObject<HTMLCanvasElement | null>;
  pageWrapperRef: RefObject<HTMLDivElement | null>;
  /** Reference pane (original PDF only) — compare mode */
  compareCanvasRef?: RefObject<HTMLCanvasElement | null>;
  comparePageWrapperRef?: RefObject<HTMLDivElement | null>;
  scale: number;
  pageNumber: number;
  /** Side-by-side compare: this instance only paints one pane’s map. */
  comparePane?: "original" | "markup";
  /** Shared focus rect between the two compare minimaps (parent ref). */
  sharedFocusRef?: MutableRefObject<MinimapFocusRect>;
};

type MiniVariant = "default" | "original" | "markup";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Visible page region in normalized [0,1] coordinates.
 * Prefer scroll geometry (same basis as panning) so zoomed-in viewports stay valid — the old
 * `iw <= 1` screen-pixel check wrongly treated many zoomed views as “invisible” and broke the map.
 */
function getViewportOnPageNorm(
  scrollEl: HTMLElement,
  pageEl: HTMLElement,
): { nx0: number; ny0: number; nw: number; nh: number } {
  const pw = pageEl.offsetWidth;
  const ph = pageEl.offsetHeight;
  if (pw <= 0 || ph <= 0) return { nx0: 0, ny0: 0, nw: 1, nh: 1 };

  const pad = scrollEl.firstElementChild as HTMLElement | null;
  const pl = pageEl.offsetLeft + (pad?.offsetLeft ?? 0);
  const pt = pageEl.offsetTop + (pad?.offsetTop ?? 0);

  const sl = scrollEl.scrollLeft;
  const st = scrollEl.scrollTop;
  const cw = scrollEl.clientWidth;
  const ch = scrollEl.clientHeight;

  const vx1 = sl + cw;
  const vy1 = st + ch;
  const px1 = pl + pw;
  const py1 = pt + ph;

  const ix0 = Math.max(sl, pl);
  const iy0 = Math.max(st, pt);
  const ix1 = Math.min(vx1, px1);
  const iy1 = Math.min(vy1, py1);
  const iw = ix1 - ix0;
  const ih = iy1 - iy0;

  if (iw > 0 && ih > 0) {
    return {
      nx0: (ix0 - pl) / pw,
      ny0: (iy0 - pt) / ph,
      nw: iw / pw,
      nh: ih / ph,
    };
  }

  const scrollRect = scrollEl.getBoundingClientRect();
  const pageRect = pageEl.getBoundingClientRect();
  const interLeft = Math.max(scrollRect.left, pageRect.left);
  const interTop = Math.max(scrollRect.top, pageRect.top);
  const interRight = Math.min(scrollRect.right, pageRect.right);
  const interBottom = Math.min(scrollRect.bottom, pageRect.bottom);
  const iw2 = interRight - interLeft;
  const ih2 = interBottom - interTop;
  if (iw2 > 0 && ih2 > 0 && pageRect.width > 0 && pageRect.height > 0) {
    return {
      nx0: (interLeft - pageRect.left) / pageRect.width,
      ny0: (interTop - pageRect.top) / pageRect.height,
      nw: iw2 / pageRect.width,
      nh: ih2 / pageRect.height,
    };
  }

  return { nx0: 0, ny0: 0, nw: 1, nh: 1 };
}

function scrollToNormOnPage(scrollEl: HTMLElement, pageEl: HTMLElement, nx: number, ny: number) {
  const pad = scrollEl.firstElementChild as HTMLElement | null;
  const pl = pageEl.offsetLeft + (pad?.offsetLeft ?? 0);
  const pt = pageEl.offsetTop + (pad?.offsetTop ?? 0);
  const pw = pageEl.offsetWidth;
  const ph = pageEl.offsetHeight;
  const targetLeft = pl + nx * pw - scrollEl.clientWidth / 2;
  const targetTop = pt + ny * ph - scrollEl.clientHeight / 2;
  const maxL = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
  const maxT = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  scrollEl.scrollLeft = clamp(targetLeft, 0, maxL);
  scrollEl.scrollTop = clamp(targetTop, 0, maxT);
}

const VIEWPORT: Record<MiniVariant, { fill: string; stroke: string }> = {
  default: {
    fill: "rgba(37, 99, 235, 0.2)",
    stroke: "rgba(96, 165, 250, 0.95)",
  },
  original: {
    fill: "rgba(148, 163, 184, 0.24)",
    stroke: "rgba(226, 232, 240, 0.92)",
  },
  markup: {
    fill: "rgba(37, 99, 235, 0.24)",
    stroke: "rgba(147, 197, 253, 0.96)",
  },
};

function paintMini(
  mini: HTMLCanvasElement,
  src: HTMLCanvasElement | null,
  scrollEl: HTMLElement,
  pageEl: HTMLElement | null,
  variant: MiniVariant,
  drawMarkupCue: boolean,
  opts?: {
    maxWidth?: number;
    maxHeight?: number;
    /** Compare: same viewport for both panes (usually markup page). */
    viewportNorm?: { nx0: number; ny0: number; nw: number; nh: number };
    /** Called with full-page focus {0,0,1,1} for minimap click → scroll mapping. */
    onFocusComputed?: (f: MinimapFocusRect) => void;
  },
) {
  if (!pageEl) return;
  const pw = pageEl.offsetWidth;
  const ph = pageEl.offsetHeight;
  if (pw <= 0 || ph <= 0) return;

  const capW = opts?.maxWidth ?? MINIMAP_MAX_W;
  const capH = opts?.maxHeight ?? Number.POSITIVE_INFINITY;

  /** Page aspect ratio — same at any zoom; do not use `pw`/`ph` in px for sizing or minimap grows/shrinks when zooming. */
  const aspect = ph / pw;
  if (!Number.isFinite(aspect) || aspect <= 0) return;

  let mw = capW;
  let mh = mw * aspect;
  if (mh > capH) {
    mh = capH;
    mw = mh / aspect;
    mw = Math.min(mw, capW);
  }

  mini.width = Math.round(mw);
  mini.height = Math.round(mh);

  const ctx = mini.getContext("2d");
  if (!ctx) return;

  const vp = opts?.viewportNorm ?? getViewportOnPageNorm(scrollEl, pageEl);
  const nx0 = clamp(vp.nx0, 0, 1);
  const ny0 = clamp(vp.ny0, 0, 1);
  const nw = clamp(vp.nw, 1e-6, 1);
  const nh = clamp(vp.nh, 1e-6, 1);

  /** Full-page overview: thumbnail always shows the whole sheet; viewport box tracks zoom/pan. */
  const focusFullPage: MinimapFocusRect = { fx0: 0, fy0: 0, fw: 1, fh: 1 };

  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, mw, mh);

  if (src && src.width >= 2 && src.height >= 2) {
    try {
      ctx.save();
      if (variant === "original") {
        ctx.filter = "saturate(0.88) contrast(0.98)";
      }
      ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, mw, mh);
      ctx.restore();
    } catch {
      ctx.fillStyle = "#e4e4e7";
      ctx.fillRect(0, 0, mw, mh);
    }
  } else {
    ctx.fillStyle = "#e4e4e7";
    ctx.fillRect(0, 0, mw, mh);
  }

  const rx = clamp(nx0 * mw, 0, mw - 2);
  const ry = clamp(ny0 * mh, 0, mh - 2);
  const rw = Math.min(Math.max(nw * mw, 2), mw - rx);
  const rh = Math.min(Math.max(nh * mh, 2), mh - ry);

  const v = VIEWPORT[variant];
  ctx.fillStyle = v.fill;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = v.stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);

  if (drawMarkupCue && mw > 24 && mh > 24) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(37, 99, 235, 0.92)";
    ctx.beginPath();
    const cx = mw - 10;
    const cy = mh - 9;
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  opts?.onFocusComputed?.(focusFullPage);
}

export function PdfPageMinimap({
  scrollRef,
  viewportScrollRef,
  sourceCanvasRef,
  pageWrapperRef,
  compareCanvasRef,
  comparePageWrapperRef,
  scale,
  pageNumber,
  comparePane,
  sharedFocusRef,
}: Props) {
  const showMinimap = useViewerStore((s) => s.showMinimap);
  const minimapOnlyWhenZoomed = useViewerStore((s) => s.minimapOnlyWhenZoomed);
  const compareMode = useViewerStore((s) => s.compareMode);

  const miniRef = useRef<HTMLCanvasElement>(null);
  const miniOriginalRef = useRef<HTMLCanvasElement>(null);
  const miniMarkupRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<"original" | "markup" | null>(null);
  const internalFocusRef = useRef<MinimapFocusRect>({ fx0: 0, fy0: 0, fw: 1, fh: 1 });
  const minimapFocusRef = sharedFocusRef ?? internalFocusRef;

  const compareSplit = compareMode && comparePane;

  const draw = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    if (compareSplit) {
      const refWrap = comparePageWrapperRef?.current;
      const workWrap = pageWrapperRef.current;
      const mo = miniOriginalRef.current;
      const mm = miniMarkupRef.current;
      const vpScroll = viewportScrollRef?.current ?? scrollEl;
      const sharedBase = {
        maxWidth: MINIMAP_COMPARE_MAX_W,
        maxHeight: MINIMAP_COMPARE_MAX_H,
        onFocusComputed: (f: MinimapFocusRect) => {
          minimapFocusRef.current = f;
        },
      };
      if (comparePane === "original" && mo && refWrap) {
        const vp = getViewportOnPageNorm(vpScroll, refWrap);
        paintMini(mo, compareCanvasRef?.current ?? null, scrollEl, refWrap, "original", false, {
          ...sharedBase,
          viewportNorm: vp,
        });
      }
      if (comparePane === "markup" && mm && workWrap) {
        const vp = getViewportOnPageNorm(vpScroll, workWrap);
        paintMini(mm, sourceCanvasRef.current, scrollEl, workWrap, "markup", true, {
          ...sharedBase,
          viewportNorm: vp,
        });
      }
      return;
    }

    const pageEl = pageWrapperRef.current;
    const mini = miniRef.current;
    if (!scrollEl || !pageEl || !mini) return;
    paintMini(mini, sourceCanvasRef.current, scrollEl, pageEl, "default", false, {
      onFocusComputed: (f: MinimapFocusRect) => {
        minimapFocusRef.current = f;
      },
    });
  }, [
    scrollRef,
    viewportScrollRef,
    sourceCanvasRef,
    pageWrapperRef,
    compareCanvasRef,
    comparePageWrapperRef,
    compareSplit,
    comparePane,
    minimapFocusRef,
  ]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const schedule = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        draw();
      });
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(scrollEl);
    const vpScrollEl = viewportScrollRef?.current;
    if (vpScrollEl && vpScrollEl !== scrollEl) {
      ro.observe(vpScrollEl);
      vpScrollEl.addEventListener("scroll", schedule, { passive: true });
    }
    const w1 = pageWrapperRef.current;
    const w2 = comparePageWrapperRef?.current;
    if (w1) ro.observe(w1);
    if (w2) ro.observe(w2);

    scrollEl.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    schedule();
    const t = window.setTimeout(schedule, 120);

    return () => {
      ro.disconnect();
      scrollEl.removeEventListener("scroll", schedule);
      if (vpScrollEl && vpScrollEl !== scrollEl) {
        vpScrollEl.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      window.clearTimeout(t);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, scrollRef, viewportScrollRef, pageWrapperRef, comparePageWrapperRef, compareSplit]);

  useEffect(() => {
    const id = window.setTimeout(() => draw(), 0);
    return () => window.clearTimeout(id);
  }, [draw, scale, pageNumber, compareMode, compareSplit, comparePane]);

  const handlePointer = useCallback(
    (
      clientX: number,
      clientY: number,
      mini: HTMLCanvasElement | null,
      scrollTargetPageEl: HTMLElement | null,
    ) => {
      const scrollEl = scrollRef.current;
      if (!mini || !scrollEl || !scrollTargetPageEl) return;
      const rect = mini.getBoundingClientRect();
      const nx = clamp((clientX - rect.left) / rect.width, 0, 1);
      const ny = clamp((clientY - rect.top) / rect.height, 0, 1);
      const focus = minimapFocusRef.current;
      const fullNx = focus.fx0 + nx * focus.fw;
      const fullNy = focus.fy0 + ny * focus.fh;
      scrollToNormOnPage(scrollEl, scrollTargetPageEl, fullNx, fullNy);
      requestAnimationFrame(draw);
    },
    [scrollRef, draw, minimapFocusRef],
  );

  const makeHandlers = (
    which: "original" | "markup",
    miniRefEl: RefObject<HTMLCanvasElement | null>,
    /** Page element used for scroll math — compare mode uses markup pane so both maps pan the same region. */
    getScrollTargetPageEl: () => HTMLElement | null,
  ) => ({
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      dragRef.current = which;
      e.currentTarget.setPointerCapture(e.pointerId);
      handlePointer(e.clientX, e.clientY, miniRefEl.current, getScrollTargetPageEl());
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current !== which) return;
      handlePointer(e.clientX, e.clientY, miniRefEl.current, getScrollTargetPageEl());
    },
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
  });

  const singleHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      dragRef.current = "markup";
      e.currentTarget.setPointerCapture(e.pointerId);
      handlePointer(e.clientX, e.clientY, miniRef.current, pageWrapperRef.current);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current !== "markup") return;
      handlePointer(e.clientX, e.clientY, miniRef.current, pageWrapperRef.current);
    },
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
  };

  const originalHandlers = makeHandlers("original", miniOriginalRef, () => pageWrapperRef.current);
  const markupHandlers = makeHandlers("markup", miniMarkupRef, () => pageWrapperRef.current);

  if (!showMinimap) return null;
  if (minimapOnlyWhenZoomed && scale <= 1.02) return null;

  if (compareMode && !comparePane) return null;

  if (compareSplit) {
    const isOriginal = comparePane === "original";
    const h = isOriginal ? originalHandlers : markupHandlers;
    return (
      <div
        className="pointer-events-auto relative z-20 w-full max-w-[min(100vw-2rem,200px)] justify-self-end print:hidden"
        role="navigation"
        aria-label={
          isOriginal
            ? "Original PDF — map, click or drag to pan"
            : "With markups — map, click or drag to pan"
        }
      >
        <div className="rounded-[12px] border border-[#334155]/90 bg-[#0a0f1e]/96 p-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(37,99,235,0.12)] ring-1 ring-[var(--viewer-primary)]/15 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
            <span
              className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${
                isOriginal ? "text-[var(--viewer-text-muted)]" : "text-[var(--viewer-primary)]"
              }`}
            >
              {isOriginal ? "Original" : "With markups"}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tabular-nums ${
                isOriginal
                  ? "border-[var(--viewer-border-strong)] bg-[#1e293b] text-[var(--viewer-text)]"
                  : "border-[var(--viewer-primary)]/40 bg-[rgba(37,99,235,0.15)] text-[var(--viewer-text)]"
              }`}
            >
              Pg {pageNumber}
            </span>
          </div>
          <canvas
            ref={isOriginal ? miniOriginalRef : miniMarkupRef}
            className={`block w-full cursor-grab touch-none rounded active:cursor-grabbing ${
              isOriginal
                ? "border border-[var(--viewer-border-strong)]/90"
                : "border border-[var(--viewer-primary)]/35"
            }`}
            style={{ maxWidth: MINIMAP_COMPARE_MAX_W }}
            {...h}
            onPointerCancel={h.onPointerUp}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-4 right-4 z-20 max-w-[min(100vw-2rem,240px)] print:hidden"
      role="navigation"
      aria-label="Page overview — click or drag to scroll"
    >
      <div className="rounded-[12px] border border-[#334155]/90 bg-[#0a0f1e]/96 p-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(37,99,235,0.12)] ring-1 ring-[var(--viewer-primary)]/15 backdrop-blur-sm">
        <p className="mb-2 select-none text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--viewer-text-muted)]">
          Map
        </p>
        <canvas
          ref={miniRef}
          className="block cursor-grab touch-none active:cursor-grabbing"
          style={{ maxWidth: MINIMAP_MAX_W }}
          {...singleHandlers}
          onPointerCancel={singleHandlers.onPointerUp}
        />
      </div>
    </div>
  );
}
