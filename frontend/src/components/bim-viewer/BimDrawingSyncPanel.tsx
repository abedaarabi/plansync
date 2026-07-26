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
import { BimPdfPageEmbed } from "./BimPdfPageEmbed";

type SyncSource = "pdf" | "3d" | null;

function NavigatorCone(props: {
  norm: { x: number; y: number };
  headingRad: number;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const size = Math.min(props.canvasWidth, props.canvasHeight);
  const x = props.norm.x * props.canvasWidth;
  const y = props.norm.y * props.canvasHeight;
  const r = size * 0.04;
  const len = size * 0.08;
  const hx = x + Math.sin(props.headingRad) * len;
  const hy = y - Math.cos(props.headingRad) * len;
  return (
    <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <circle cx={x} cy={y} r={r} fill="rgba(59,130,246,0.35)" stroke="#2563eb" strokeWidth={2} />
      <line x1={x} y1={y} x2={hx} y2={hy} stroke="#2563eb" strokeWidth={2} />
    </svg>
  );
}

export function BimDrawingSyncPanel(props: {
  engine: BimEngine | null;
  syncContext: BimSyncContext;
  transform: DrawingCoordTransform;
  className?: string;
}) {
  const syncSourceRef = useRef<SyncSource>(null);
  const [navNorm, setNavNorm] = useState({ x: 0.5, y: 0.5 });
  const [heading, setHeading] = useState(0);
  const [scrollCenter, setScrollCenter] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  const applyPdfTo3d = useCallback(
    (norm: { x: number; y: number }) => {
      if (syncSourceRef.current === "3d") return;
      syncSourceRef.current = "pdf";
      setNavNorm(norm);
      const { x, z } = pdfNormToWorldXZ(norm, props.transform);
      props.engine?.applyPlanMinimapPose({ x, z, heading, animate: false });
      requestAnimationFrame(() => {
        syncSourceRef.current = null;
      });
    },
    [props.engine, props.transform, heading],
  );

  useEffect(() => {
    const engine = props.engine;
    if (!engine) return;

    let raf = 0;
    const tick = () => {
      if (syncSourceRef.current === "pdf") {
        raf = requestAnimationFrame(tick);
        return;
      }
      const state = engine.getPlanMinimapState();
      if (state?.bounds) {
        syncSourceRef.current = "3d";
        const norm = worldXZToPdfNorm(state.anchorX, state.anchorZ, props.transform);
        setNavNorm(norm);
        setHeading(state.heading);
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
          onPointerNorm={applyPdfTo3d}
          scrollToCenterNorm={scrollCenter}
          onCanvasSize={(w, h) => setCanvasSize({ w, h })}
          overlay={
            <NavigatorCone
              norm={navNorm}
              headingRad={heading}
              canvasWidth={canvasSize.w}
              canvasHeight={canvasSize.h}
            />
          }
        />
      </div>
      <p className="shrink-0 border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
        Click the sheet to move the 3D camera · walk mode recommended
      </p>
    </div>
  );
}
