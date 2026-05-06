import type { MouseEvent, PointerEvent } from "react";
import { clamp01 } from "@/lib/coords";
import { closestOnSegment } from "@/lib/snap";

/**
 * Normalize pointer/mouse coordinates to 0–1 within an overlay element’s layout box.
 * Used everywhere hit-testing and drawing use the same coordinate space as the PDF.
 */
export function normFromEvent(e: PointerEvent | MouseEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const x = clamp01((e.clientX - rect.left) / rect.width);
  const y = clamp01((e.clientY - rect.top) / rect.height);
  return { x, y };
}

/** Must match `normFromEvent`: same box as pointer coords (not clientWidth, which can differ by border/subpixel). */
export function overlayCssSizePx(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
}

export function clampNorm(p: { x: number; y: number }): { x: number; y: number } {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

export function distNormPx(
  a: { x: number; y: number },
  b: { x: number; y: number },
  cssW: number,
  cssH: number,
): number {
  const dx = (a.x - b.x) * cssW;
  const dy = (a.y - b.y) * cssH;
  return Math.hypot(dx, dy);
}

export function distNormPointToSegmentPx(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  cssW: number,
  cssH: number,
): number {
  const px = p.x * cssW;
  const py = p.y * cssH;
  const { d2 } = closestOnSegment(px, py, a.x * cssW, a.y * cssH, b.x * cssW, b.y * cssH);
  return Math.sqrt(d2);
}

/** Corners of the axis-aligned rect → four points in “diamond” order for diamond markup. */
export function diamondPointsFromRectCorners(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return [
    { x: cx, y: minY },
    { x: maxX, y: cy },
    { x: cx, y: maxY },
    { x: minX, y: cy },
  ];
}
