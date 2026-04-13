"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Square, Slash, Trash2, X } from "lucide-react";
import type { IssuePhotoSketchV1 } from "@/lib/api-client";

type Tool = "pen" | "line" | "rect";

function newStrokeId(): string {
  return `s_${Math.random().toString(36).slice(2, 11)}`;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normPoint(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01((clientX - r.left) / r.width),
    y: clamp01((clientY - r.top) / r.height),
  };
}

function parseSketch(raw: unknown): IssuePhotoSketchV1 {
  if (!raw || typeof raw !== "object") return { v: 1, strokes: [] };
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.strokes)) return { v: 1, strokes: [] };
  const strokes: IssuePhotoSketchV1["strokes"] = [];
  for (const s of o.strokes) {
    if (!s || typeof s !== "object") continue;
    const st = s as Record<string, unknown>;
    if (st.tool !== "pen" && st.tool !== "line" && st.tool !== "rect") continue;
    if (typeof st.id !== "string" || typeof st.color !== "string") continue;
    const sw = typeof st.sw === "number" && Number.isFinite(st.sw) ? st.sw : 2;
    const pts = Array.isArray(st.pts)
      ? st.pts
          .map((p) => {
            if (!p || typeof p !== "object") return null;
            const q = p as Record<string, unknown>;
            if (typeof q.x !== "number" || typeof q.y !== "number") return null;
            return { x: clamp01(q.x), y: clamp01(q.y) };
          })
          .filter(Boolean)
      : [];
    if (pts.length === 0) continue;
    strokes.push({
      id: st.id,
      tool: st.tool,
      color: st.color,
      sw,
      pts: pts as { x: number; y: number }[],
    });
  }
  return { v: 1, strokes };
}

/** `sw` stored in sketch JSON — slider maps 1 … 5 to ~2px … ~14px on the drawing board. */
const STROKE_SW_MIN = 1;
const STROKE_SW_MAX = 5;
const STROKE_SW_DEFAULT = 2;
/** Minimum stroke at slider left (sw = 1), in CSS pixels on the board overlay. */
const STROKE_MIN_PX = 2;
const STROKE_MAX_PX = 14;

function clampStrokeSw(n: number): number {
  return Math.min(STROKE_SW_MAX, Math.max(STROKE_SW_MIN, n));
}

/** Intended on-screen thickness in px (independent of board size — used for labels). */
function strokeTargetPx(sw: number): number {
  const u = clampStrokeSw(sw);
  const t = (u - STROKE_SW_MIN) / (STROKE_SW_MAX - STROKE_SW_MIN);
  return STROKE_MIN_PX + t * (STROKE_MAX_PX - STROKE_MIN_PX);
}

/** Stroke width in 0–1 viewBox units; `boardMinSidePx` = min(width,height) of the board. */
function strokeWidthInViewBox(sw: number, boardMinSidePx: number): number {
  const side = Math.max(64, boardMinSidePx);
  const px = strokeTargetPx(sw);
  return Math.max(0.0004, px / side);
}

function strokeToSvgEl(
  s: IssuePhotoSketchV1["strokes"][number],
  key: string,
  boardMinSidePx: number,
) {
  const { tool, color, sw, pts } = s;
  const w = strokeWidthInViewBox(sw, boardMinSidePx);
  if (tool === "pen" && pts.length >= 2) {
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return (
      <path
        key={key}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (tool === "line" && pts.length >= 2) {
    const [a, b] = pts;
    return (
      <line
        key={key}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
      />
    );
  }
  if (tool === "rect" && pts.length >= 2) {
    const [a, b] = pts;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const rw = Math.abs(b.x - a.x);
    const rh = Math.abs(b.y - a.y);
    return (
      <rect
        key={key}
        x={x}
        y={y}
        width={rw}
        height={rh}
        fill="none"
        stroke={color}
        strokeWidth={w}
      />
    );
  }
  return null;
}

type Props = {
  open: boolean;
  imageUrl: string;
  fileName: string;
  initialSketch: unknown;
  onClose: () => void;
  onSave: (sketch: IssuePhotoSketchV1 | null) => void | Promise<void>;
  /** When true, opens showing the photo and saved markups only; user taps Draw to show tools. */
  startInViewMode?: boolean;
};

export function IssuePhotoSketchModal(props: Props) {
  const {
    open,
    imageUrl,
    fileName,
    initialSketch,
    onClose,
    onSave,
    startInViewMode = false,
  } = props;
  const [mounted, setMounted] = useState(false);
  const [drawEnabled, setDrawEnabled] = useState(!startInViewMode);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#f97316");
  /** Line weight for new strokes (also persisted per stroke in saved JSON). */
  const [strokeSw, setStrokeSw] = useState(STROKE_SW_DEFAULT);
  const [strokes, setStrokes] = useState<IssuePhotoSketchV1["strokes"]>([]);
  const [boardMinSidePx, setBoardMinSidePx] = useState(400);
  const boardRef = useRef<HTMLDivElement>(null);
  /** Same element that receives pointer capture — must match normPoint rect. */
  const drawSurfaceRef = useRef<HTMLDivElement>(null);
  const penDraft = useRef<{ pts: { x: number; y: number }[] } | null>(null);
  const dragRef = useRef<{
    tool: "line" | "rect";
    start: { x: number; y: number };
    cur: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const parsed = parseSketch(initialSketch).strokes;
    setStrokes(parsed);
    setTool("pen");
    setDrawEnabled(!startInViewMode);
    if (parsed.length > 0) {
      const lastSw = parsed[parsed.length - 1]!.sw;
      setStrokeSw(
        clampStrokeSw(
          typeof lastSw === "number" && Number.isFinite(lastSw) ? lastSw : STROKE_SW_DEFAULT,
        ),
      );
    } else {
      setStrokeSw(STROKE_SW_DEFAULT);
    }
  }, [open, initialSketch, startInViewMode]);

  /** iOS / touch: parent scroll containers steal `touchmove` unless default is prevented here. */
  useEffect(() => {
    const el = drawSurfaceRef.current;
    if (!open || !mounted || !el || !drawEnabled) return;
    const blockScrollChaining = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    el.addEventListener("touchstart", blockScrollChaining, { passive: false });
    el.addEventListener("touchmove", blockScrollChaining, { passive: false });
    return () => {
      el.removeEventListener("touchstart", blockScrollChaining);
      el.removeEventListener("touchmove", blockScrollChaining);
    };
  }, [open, mounted, drawEnabled]);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const m = Math.min(r.width, r.height);
      if (m > 0) setBoardMinSidePx(m);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, mounted]);

  const normFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = drawSurfaceRef.current ?? boardRef.current;
    if (!el) return { x: 0, y: 0 };
    return normPoint(el, clientX, clientY);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const surface = drawSurfaceRef.current;
      if (!surface) return;
      e.preventDefault();
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        /* Safari / embedded browsers may throw; drawing still works without capture */
      }
      const p = normFromEvent(e.clientX, e.clientY);
      if (tool === "pen") {
        penDraft.current = { pts: [p] };
        return;
      }
      dragRef.current = { tool, start: p, cur: p };
    },
    [tool, normFromEvent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const surface = drawSurfaceRef.current;
      if (!surface) return;
      if (penDraft.current || dragRef.current) e.preventDefault();
      const p = normFromEvent(e.clientX, e.clientY);
      if (penDraft.current) {
        const last = penDraft.current.pts[penDraft.current.pts.length - 1]!;
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (dx * dx + dy * dy < 1e-10) return;
        penDraft.current.pts.push(p);
        setStrokes((prev) => {
          const draft = penDraft.current;
          if (!draft || draft.pts.length < 2) return prev;
          const tail = {
            id: newStrokeId(),
            tool: "pen" as const,
            color,
            sw: strokeSw,
            pts: [...draft.pts],
          };
          const withoutLive = prev.filter((s) => !s.id.startsWith("__live_pen"));
          return [...withoutLive, { ...tail, id: "__live_pen" }];
        });
        return;
      }
      const d = dragRef.current;
      if (d) {
        dragRef.current = { ...d, cur: p };
        setStrokes((prev) => {
          const id = `__live_${d.tool}`;
          const next = prev.filter((s) => s.id !== id);
          const stroke = {
            id,
            tool: d.tool,
            color,
            sw: strokeSw,
            pts: [d.start, p],
          };
          return [...next, stroke];
        });
      }
    },
    [color, normFromEvent, strokeSw],
  );

  const finishPen = useCallback(() => {
    const draft = penDraft.current;
    penDraft.current = null;
    if (!draft || draft.pts.length === 0) {
      setStrokes((prev) => prev.filter((s) => !s.id.startsWith("__live_pen")));
      return;
    }
    if (draft.pts.length === 1) {
      const a = draft.pts[0]!;
      draft.pts.push({ x: clamp01(a.x + 0.004), y: clamp01(a.y + 0.004) });
    }
    if (draft.pts.length < 2) {
      setStrokes((prev) => prev.filter((s) => !s.id.startsWith("__live_pen")));
      return;
    }
    setStrokes((prev) => {
      const rest = prev.filter((s) => !s.id.startsWith("__live_pen"));
      return [
        ...rest,
        {
          id: newStrokeId(),
          tool: "pen",
          color,
          sw: strokeSw,
          pts: draft.pts,
        },
      ];
    });
  }, [color, strokeSw]);

  const finishDrag = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    setStrokes((prev) => {
      const rest = prev.filter((s) => !s.id.startsWith("__live_"));
      const stroke = {
        id: newStrokeId(),
        tool: d.tool,
        color,
        sw: strokeSw,
        pts: [d.start, d.cur],
      };
      const [a, b] = stroke.pts;
      if (Math.abs(a.x - b.x) < 0.002 && Math.abs(a.y - b.y) < 0.002) return rest;
      return [...rest, stroke];
    });
  }, [color, strokeSw]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const surface = drawSurfaceRef.current;
      if (penDraft.current || dragRef.current) e.preventDefault();
      try {
        surface?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (penDraft.current) finishPen();
      else finishDrag();
    },
    [finishDrag, finishPen],
  );

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-5"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close sketch editor"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-[1] flex min-h-0 max-h-[min(92vh,980px)] w-full max-w-[min(96vw,1120px)] flex-col overflow-y-auto overflow-x-hidden rounded-xl border border-slate-700/90 bg-slate-950 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-white">
              {drawEnabled ? "Markup on photo" : "Reference photo"}
            </h2>
            <p className="truncate text-[11px] text-slate-500" title={fileName}>
              {fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="viewer-focus-ring rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        {drawEnabled ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-800/90 px-4 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Tool
              </span>
              <div className="flex gap-1">
                {(
                  [
                    ["pen", Pencil, "Draw"],
                    ["line", Slash, "Line"],
                    ["rect", Square, "Box"],
                  ] as const
                ).map(([t, Icon, label]) => (
                  <button
                    key={t}
                    type="button"
                    title={label}
                    onClick={() => setTool(t)}
                    className={`viewer-focus-ring flex h-8 w-8 items-center justify-center rounded-lg border text-slate-300 transition ${
                      tool === t
                        ? "border-[var(--viewer-primary)]/60 bg-[var(--viewer-primary-muted)] text-white"
                        : "border-slate-700/80 bg-slate-900/60 hover:bg-slate-800/80"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <label className="flex w-[6.75rem] shrink-0 flex-col gap-0.5 sm:w-28">
              <div className="flex items-center justify-between gap-1 text-[9px] font-medium text-slate-500">
                <span className="uppercase tracking-wide">Line</span>
                <span className="tabular-nums text-slate-400" aria-hidden>
                  {Math.round(strokeTargetPx(strokeSw))}px
                </span>
              </div>
              <div className="rounded-full bg-slate-800/80 px-0.5 py-px ring-1 ring-slate-700/50">
                <input
                  type="range"
                  min={STROKE_SW_MIN}
                  max={STROKE_SW_MAX}
                  step={0.1}
                  value={strokeSw}
                  onChange={(e) => setStrokeSw(clampStrokeSw(Number(e.target.value)))}
                  aria-label={`Stroke thickness, ${Math.round(strokeTargetPx(strokeSw))} pixels`}
                  className="viewer-focus-ring m-0 h-1 w-full min-w-0 cursor-pointer accent-[var(--viewer-primary)] disabled:opacity-40"
                />
              </div>
            </label>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                Color
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0"
                />
              </label>
              <button
                type="button"
                onClick={() => setStrokes([])}
                className="viewer-focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-700/80 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/80"
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden />
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {/* No overflow-y-auto here — it steals touch drags for scroll. Whole dialog scrolls if needed. */}
        <div className="flex min-h-[min(48vh,420px)] flex-1 flex-col p-3 sm:min-h-0 sm:p-4">
          <div
            ref={boardRef}
            className={`relative isolate mx-auto min-h-[min(44vh,360px)] w-full max-w-full flex-1 overflow-hidden rounded-lg border border-slate-800 bg-black/40 sm:min-h-[min(52vh,480px)] sm:flex-none sm:h-[min(58vh,560px)] lg:h-[min(62vh,640px)] ${drawEnabled ? "touch-none" : ""}`}
            style={drawEnabled ? { touchAction: "none" } : undefined}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
              />
            </div>
            <svg
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden
            >
              {strokes.map((s) => strokeToSvgEl(s, s.id, boardMinSidePx))}
            </svg>
            {/* Drawing surface: pointer capture + touch scroll blocking */}
            <div
              ref={drawSurfaceRef}
              className={`absolute inset-0 z-[2] select-none ${drawEnabled ? "cursor-crosshair" : "pointer-events-none"}`}
              style={drawEnabled ? { touchAction: "none" } : undefined}
              onPointerDown={drawEnabled ? onPointerDown : undefined}
              onPointerMove={drawEnabled ? onPointerMove : undefined}
              onPointerUp={drawEnabled ? onPointerUp : undefined}
              onPointerCancel={drawEnabled ? onPointerUp : undefined}
            />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            {drawEnabled ? (
              <>
                Draw in the frame above. Use the line slider for thickness. Markups are saved as
                vectors on this image (not on the PDF sheet).
              </>
            ) : (
              <>
                Saved markups are overlaid on the photo. Tap{" "}
                <span className="font-medium text-slate-400">Draw</span> to add or change them.
              </>
            )}
          </p>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-800/90 px-4 py-3">
          {!drawEnabled ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="viewer-focus-ring rounded-lg border border-slate-600/80 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800/80"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setDrawEnabled(true)}
                className="viewer-focus-ring rounded-lg bg-[var(--viewer-primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[var(--viewer-primary-hover)]"
              >
                Draw
              </button>
            </>
          ) : (
            <>
              {startInViewMode ? (
                <button
                  type="button"
                  onClick={() => setDrawEnabled(false)}
                  className="viewer-focus-ring rounded-lg border border-slate-600/80 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800/80"
                >
                  Back to preview
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="viewer-focus-ring rounded-lg border border-slate-600/80 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800/80"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const clean = strokes.filter((s) => !s.id.startsWith("__live"));
                  void Promise.resolve(
                    onSave(clean.length === 0 ? null : { v: 1, strokes: clean }),
                  );
                }}
                className="viewer-focus-ring rounded-lg bg-[var(--viewer-primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[var(--viewer-primary-hover)]"
              >
                Save markups
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
