"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map } from "lucide-react";
import type { BimEngine } from "./bimEngine";
import type { BimSyncContext } from "@/lib/api-client/bim-publish";
import {
  pdfNormToWorldXZ,
  worldXZToPdfNorm,
  type DrawingCoordTransform,
} from "@/lib/bim/drawingCoordBridge";
import { hitTestMapNavigator } from "@/lib/bim/bimMapNavigator";
import { BimPdfPageEmbed } from "./BimPdfPageEmbed";
import { BimMapNavigatorMarker } from "./BimMapNavigatorMarker";

export type PdfFootprintHighlight = {
  centroid: { x: number; y: number };
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  offSheet: boolean;
};

type SyncSource = "pdf" | "3d" | null;

type DragMode =
  | { kind: "pan" }
  | { kind: "rotate"; startPointerAngle: number; baseHeading: number };

function pointerToCanvasPx(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  canvasW: number,
  canvasH: number,
): { px: number; py: number; norm: { x: number; y: number } } {
  const norm = {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
  return {
    px: norm.x * canvasW,
    py: norm.y * canvasH,
    norm,
  };
}

export function BimDrawingSyncPanel(props: {
  engine: BimEngine | null;
  syncContext: BimSyncContext;
  transform: DrawingCoordTransform;
  className?: string;
  highlight?: PdfFootprintHighlight | null;
}) {
  const syncSourceRef = useRef<SyncSource>(null);
  const dragRef = useRef<DragMode | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef(0);
  const [navNorm, setNavNorm] = useState({ x: 0.5, y: 0.5 });
  const [heading, setHeading] = useState(0);
  const [scrollCenter, setScrollCenter] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  headingRef.current = heading;

  const applyPoseFromNorm = useCallback(
    (norm: { x: number; y: number }, opts?: { heading?: number; animate?: boolean }) => {
      const engine = props.engine;
      if (!engine) return;
      const h = opts?.heading ?? headingRef.current;
      syncSourceRef.current = "pdf";
      setNavNorm(norm);
      if (opts?.heading !== undefined) {
        setHeading(opts.heading);
        headingRef.current = opts.heading;
      }
      const { x, z } = pdfNormToWorldXZ(norm, props.transform);
      void engine.applyPlanMinimapPose({
        x,
        z,
        heading: h,
        animate: opts?.animate ?? false,
      });
      requestAnimationFrame(() => {
        syncSourceRef.current = null;
      });
    },
    [props.engine, props.transform],
  );

  useEffect(() => {
    const engine = props.engine;
    if (!engine) return;

    let raf = 0;
    const tick = () => {
      if (syncSourceRef.current === "pdf" || dragRef.current) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const state = engine.getPlanMinimapState();
      if (state?.bounds) {
        syncSourceRef.current = "3d";
        const norm = worldXZToPdfNorm(state.anchorX, state.anchorZ, props.transform);
        setNavNorm(norm);
        setHeading(state.heading);
        headingRef.current = state.heading;
        setScrollCenter({ x: norm.x, y: norm.y });
        requestAnimationFrame(() => {
          syncSourceRef.current = null;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.engine, props.transform]);

  useEffect(() => {
    const storey = props.syncContext.levelSourceName || props.syncContext.levelDisplayName;
    void props.engine?.setPlanMinimapStorey(storey);
  }, [props.engine, props.syncContext.levelSourceName, props.syncContext.levelDisplayName]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    const engine = props.engine;
    if (!overlay || !engine) return;

    const rect = overlay.getBoundingClientRect();
    const { px, py, norm } = pointerToCanvasPx(
      e.clientX,
      e.clientY,
      rect,
      canvasSize.w,
      canvasSize.h,
    );
    const anchorPx = navNorm.x * canvasSize.w;
    const anchorPy = navNorm.y * canvasSize.h;
    const hit = hitTestMapNavigator(px, py, anchorPx, anchorPy, canvasSize.w, canvasSize.h);

    if (hit.kind === "pan") {
      dragRef.current = { kind: "pan" };
      overlay.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (hit.kind === "rotate") {
      const dx = px - anchorPx;
      const dy = py - anchorPy;
      dragRef.current = {
        kind: "rotate",
        startPointerAngle: Math.atan2(dy, dx),
        baseHeading: headingRef.current,
      };
      overlay.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    applyPoseFromNorm(norm, { animate: true });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    const drag = dragRef.current;
    if (!overlay || !drag) return;

    const rect = overlay.getBoundingClientRect();
    const { px, py, norm } = pointerToCanvasPx(
      e.clientX,
      e.clientY,
      rect,
      canvasSize.w,
      canvasSize.h,
    );

    if (drag.kind === "pan") {
      applyPoseFromNorm(norm);
      return;
    }

    const anchorPx = navNorm.x * canvasSize.w;
    const anchorPy = navNorm.y * canvasSize.h;
    const dx = px - anchorPx;
    const dy = py - anchorPy;
    const pointerAngle = Math.atan2(dy, dx);
    const nextHeading = drag.baseHeading + (pointerAngle - drag.startPointerAngle);
    applyPoseFromNorm(navNorm, { heading: nextHeading });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (overlay?.hasPointerCapture(e.pointerId)) {
      overlay.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-white ${props.className ?? ""}`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        <Map className="h-3.5 w-3.5" />
        Drawing sync — {props.syncContext.levelDisplayName}
      </div>
      <div className="relative min-h-0 flex-1">
        <BimPdfPageEmbed
          fileId={props.syncContext.pdfFileId}
          fileVersionId={props.syncContext.pdfFileVersionId}
          pageIndex={props.syncContext.pageIndex}
          className="h-full min-h-[200px] w-full"
          scrollToCenterNorm={scrollCenter}
          onCanvasSize={(w, h) => setCanvasSize({ w, h })}
          overlayInteractive
          overlay={
            <div
              ref={overlayRef}
              className="absolute inset-0"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <BimMapNavigatorMarker
                norm={navNorm}
                headingRad={heading}
                canvasWidth={canvasSize.w}
                canvasHeight={canvasSize.h}
              />
              {props.highlight && !props.highlight.offSheet ? (
                <div
                  className="pointer-events-none absolute border-2 border-[var(--bim-accent)] bg-[var(--bim-accent)]/15"
                  style={{
                    left: `${props.highlight.minX * 100}%`,
                    top: `${props.highlight.minY * 100}%`,
                    width: `${Math.max(props.highlight.maxX - props.highlight.minX, 0.012) * 100}%`,
                    height: `${Math.max(props.highlight.maxY - props.highlight.minY, 0.012) * 100}%`,
                  }}
                />
              ) : null}
              {props.highlight && !props.highlight.offSheet ? (
                <span
                  className="pointer-events-none absolute z-[2] h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--bim-accent)] shadow"
                  style={{
                    left: `${props.highlight.centroid.x * 100}%`,
                    top: `${props.highlight.centroid.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ) : null}
            </div>
          }
        />
        {props.highlight?.offSheet ? (
          <p className="pointer-events-none absolute bottom-2 left-1/2 z-[3] -translate-x-1/2 rounded-md bg-[var(--bim-panel)] px-2 py-1 text-xs font-medium text-[var(--bim-text-muted)] shadow">
            Not on this sheet
          </p>
        ) : null}
      </div>
    </div>
  );
}
