"use client";

import { useEffect, type RefObject } from "react";
import { hapticTap } from "@/lib/haptic";
import { useViewerStore, VIEWER_SCALE_MAX, VIEWER_SCALE_MIN } from "@/store/viewerStore";

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1]!.clientX - touches[0]!.clientX;
  const dy = touches[1]!.clientY - touches[0]!.clientY;
  return Math.hypot(dx, dy);
}

function touchCenterInElement(touches: TouchList, rect: DOMRect): { x: number; y: number } {
  return {
    x: (touches[0]!.clientX + touches[1]!.clientX) / 2 - rect.left,
    y: (touches[0]!.clientY + touches[1]!.clientY) / 2 - rect.top,
  };
}

type PinchSession = {
  startDistance: number;
  startScale: number;
  startScrollLeft: number;
  startScrollTop: number;
  hapticFired: boolean;
};

/**
 * Two-finger pinch-to-zoom on the PDF scroll container — works in every tool mode
 * (select, measure, markup) without starting a stroke first.
 */
export function usePdfPinchZoom(
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    let session: PinchSession | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const st = useViewerStore.getState();
      session = {
        startDistance: Math.max(1, touchDistance(e.touches)),
        startScale: st.scale,
        startScrollLeft: el.scrollLeft,
        startScrollTop: el.scrollTop,
        hapticFired: false,
      };
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!session || e.touches.length < 2) return;
      e.preventDefault();

      const distance = Math.max(1, touchDistance(e.touches));
      const nextScale = Math.min(
        VIEWER_SCALE_MAX,
        Math.max(VIEWER_SCALE_MIN, session.startScale * (distance / session.startDistance)),
      );
      const ratio = nextScale / session.startScale;

      if (!session.hapticFired) {
        session.hapticFired = true;
        hapticTap(8);
      }

      useViewerStore.getState().setScale(nextScale);

      const rect = el.getBoundingClientRect();
      const { x: cx, y: cy } = touchCenterInElement(e.touches, rect);
      const maxL = Math.max(0, el.scrollWidth - el.clientWidth);
      const maxT = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollLeft = Math.min(
        maxL,
        Math.max(0, session.startScrollLeft * ratio + cx * (ratio - 1)),
      );
      el.scrollTop = Math.min(maxT, Math.max(0, session.startScrollTop * ratio + cy * (ratio - 1)));
    };

    const endPinch = (e: TouchEvent) => {
      if (e.touches.length >= 2) return;
      session = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endPinch);
    el.addEventListener("touchcancel", endPinch);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endPinch);
      el.removeEventListener("touchcancel", endPinch);
    };
  }, [scrollRef, enabled]);
}
