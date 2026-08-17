"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, Loader2, RotateCcw, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { BimEngine } from "./bimEngine";
import type { DrawingMapRecord } from "@/lib/api-client/bim-publish";
import { fetchBimSyncContext, saveDrawingCoordTransform } from "@/lib/api-client/bim-publish";
import { fetchViewerState } from "@/lib/api-client/core-members-viewer-rfi";
import { apiUrl } from "@/lib/api-url";
import { pdfDistanceUnits } from "@/lib/coords";
import { parseServerViewerState } from "@/lib/viewerStateCloud";
import {
  buildTransformFromControlPoints,
  fitSimilarityTransform,
  pdfNormToUser,
  type DrawingCoordTransform,
} from "@/lib/bim/drawingCoordBridge";
import {
  drawPlanMinimap,
  hitTestPlanMinimap,
  worldToMap,
  type PlanMinimapBounds,
} from "@/lib/bim/planMinimap";
import { BimPdfPageEmbed } from "./BimPdfPageEmbed";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";

// fallow-ignore-next-line code-duplication
const ALIGN_PLAN_PX = 280;

function mapPointer(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function drawControlPoints(
  ctx: CanvasRenderingContext2D,
  controlPoints: ControlPoint[],
  bounds: PlanMinimapBounds | null,
) {
  if (!bounds) return;
  for (const cp of controlPoints) {
    const pt = worldToMap(cp.worldXZ.x, cp.worldXZ.z, bounds, ALIGN_PLAN_PX);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#60a5fa";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

type ControlPoint = DrawingCoordTransform["controlPoints"][number];

// fallow-ignore-next-line complexity
function residualWarningM(
  controlPoints: ControlPoint[],
  transform: DrawingCoordTransform,
): string | null {
  if (controlPoints.length < 2) return null;
  let worst = 0;
  for (const cp of controlPoints) {
    const { u, v } = pdfNormToUser(cp.pdfNorm, transform.pageWidthPt, transform.pageHeightPt);
    try {
      const fit = fitSimilarityTransform(
        controlPoints.map((p) => {
          const uv = pdfNormToUser(p.pdfNorm, transform.pageWidthPt, transform.pageHeightPt);
          return { src: { x: uv.u, z: uv.v }, dst: p.worldXZ };
        }),
      );
      const cosR = Math.cos(fit.rotationRad);
      const sinR = Math.sin(fit.rotationRad);
      const rx = cosR * u - sinR * v;
      const rz = sinR * u + cosR * v;
      const px = fit.scale * rx + fit.translation.x;
      const pz = fit.scale * rz + fit.translation.z;
      worst = Math.max(worst, Math.hypot(px - cp.worldXZ.x, pz - cp.worldXZ.z));
    } catch {
      return null;
    }
  }
  if (worst <= 0.5) return null;
  return `Alignment error up to ${(worst * 1000).toFixed(0)} mm at control points — add another point or recheck picks.`;
}

type PickSide = "pdf" | "world";

async function persistPageCalibration(
  pdfFileVersionId: string,
  pageIndex: number,
  mmPerPdfUnit: number,
): Promise<void> {
  const { viewerState, revision } = await fetchViewerState(pdfFileVersionId);
  const parsed = parseServerViewerState(viewerState) ?? { annotations: [], calibrationByPage: {} };
  const calibrationByPage = {
    ...parsed.calibrationByPage,
    [String(pageIndex)]: { pageIndex, mmPerPdfUnit },
  };
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(pdfFileVersionId)}/viewer-state`),
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed,
        calibrationByPage,
        baseRevision: revision,
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Could not save PDF calibration.");
  }
}

// fallow-ignore-next-line complexity
export function AlignCoordinatesPanel(props: {
  open: boolean;
  onClose: () => void;
  engine: BimEngine | null;
  map: DrawingMapRecord;
  ifcFileVersionId: string;
  onSaved?: (transform: DrawingCoordTransform) => void;
}) {
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [pickSide, setPickSide] = useState<PickSide>("pdf");
  const [pendingPdf, setPendingPdf] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [mmPerPdfUnit, setMmPerPdfUnit] = useState(0);
  const [pageWidthPt, setPageWidthPt] = useState(612);
  const [pageHeightPt, setPageHeightPt] = useState(792);
  const [pdfFileVersionId, setPdfFileVersionId] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrateDraft, setCalibrateDraft] = useState<{ x: number; y: number }[]>([]);
  const [knownLengthMm, setKnownLengthMm] = useState("1000");
  const [calibratingSaving, setCalibratingSaving] = useState(false);
  const planCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const existing = props.map.coordTransformJson as DrawingCoordTransform | null;
    setControlPoints(existing?.controlPoints ?? []);
    setPickSide("pdf");
    setPendingPdf(null);
    setCalibrating(false);
    setCalibrateDraft([]);
  }, [props.open, props.map]);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setLoadingContext(true);
    void fetchBimSyncContext(props.ifcFileVersionId, props.map.bimModelLevelId)
      // fallow-ignore-next-line complexity
      .then((ctx) => {
        if (cancelled) return;
        const fromTransform = ctx.coordTransform?.mmPerPdfUnit;
        setMmPerPdfUnit(ctx.mmPerPdfUnit ?? fromTransform ?? 0);
        setPageWidthPt(ctx.pageWidthPt);
        setPageHeightPt(ctx.pageHeightPt);
        setPdfFileVersionId(ctx.pdfFileVersionId);
      })
      // fallow-ignore-next-line complexity
      .catch(() => {
        if (cancelled) return;
        const pinned =
          props.map.pdfFileVersionId ??
          props.map.pinnedPdfFileVersionId ??
          props.map.latestPdfFileVersionId ??
          null;
        setPdfFileVersionId(pinned);
        const existing = props.map.coordTransformJson as DrawingCoordTransform | null;
        if (existing?.mmPerPdfUnit) setMmPerPdfUnit(existing.mmPerPdfUnit);
        if (existing?.pageWidthPt) setPageWidthPt(existing.pageWidthPt);
        if (existing?.pageHeightPt) setPageHeightPt(existing.pageHeightPt);
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    props.open,
    props.ifcFileVersionId,
    props.map.bimModelLevelId,
    props.map.coordTransformJson,
    props.map.pdfFileVersionId,
    props.map.pinnedPdfFileVersionId,
    props.map.latestPdfFileVersionId,
  ]);

  // fallow-ignore-next-line complexity
  useEffect(() => {
    if (!props.open || !props.engine) return;
    const storey = props.map.level?.sourceName ?? null;
    void props.engine.setPlanMinimapStorey(storey);
  }, [props.open, props.engine, props.map.level?.sourceName]);

  useEffect(() => {
    if (!props.open) return;
    const canvas = planCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const tick = () => {
      const state = props.engine?.getPlanMinimapState();
      if (state) {
        drawPlanMinimap(ctx, ALIGN_PLAN_PX, state);
        drawControlPoints(ctx, controlPoints, state.bounds);
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, ALIGN_PLAN_PX, ALIGN_PLAN_PX);
        ctx.fillStyle = "#64748b";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading plan view…", ALIGN_PLAN_PX / 2, ALIGN_PLAN_PX / 2);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.open, props.engine, controlPoints]);

  const draftTransform =
    controlPoints.length >= 2 && mmPerPdfUnit > 0
      ? buildTransformFromControlPoints(controlPoints, mmPerPdfUnit, pageWidthPt, pageHeightPt)
      : null;
  const residualWarning = draftTransform ? residualWarningM(controlPoints, draftTransform) : null;

  const addPdfPoint = useCallback(
    (norm: { x: number; y: number }) => {
      if (calibrating) {
        setCalibrateDraft((prev) => {
          if (prev.length >= 2) return [norm];
          if (prev.length === 0) return [norm];
          return [prev[0], norm];
        });
        return;
      }
      if (mmPerPdfUnit <= 0) {
        toast.message("Calibrate the drawing scale before placing control points.");
        setCalibrating(true);
        setCalibrateDraft([norm]);
        return;
      }
      if (pickSide !== "pdf") return;
      setPendingPdf(norm);
      setPickSide("world");
    },
    [calibrating, mmPerPdfUnit, pickSide],
  );

  // fallow-ignore-next-line complexity
  async function applyCalibration() {
    if (calibrateDraft.length < 2) {
      toast.error("Click two points on a known dimension line.");
      return;
    }
    const knownMm = Number(knownLengthMm);
    if (!Number.isFinite(knownMm) || knownMm <= 0) {
      toast.error("Enter a valid known length in millimeters.");
      return;
    }
    const pdfD = pdfDistanceUnits(calibrateDraft[0], calibrateDraft[1], pageWidthPt, pageHeightPt);
    if (pdfD <= 0) {
      toast.error("Calibration points are too close together.");
      return;
    }
    const fvId =
      pdfFileVersionId ??
      props.map.pdfFileVersionId ??
      props.map.pinnedPdfFileVersionId ??
      props.map.latestPdfFileVersionId ??
      null;
    if (!fvId) {
      toast.error("PDF file version not found.");
      return;
    }
    const mm = knownMm / pdfD;
    setCalibratingSaving(true);
    try {
      await persistPageCalibration(fvId, props.map.pageIndex, mm);
      setMmPerPdfUnit(mm);
      setCalibrating(false);
      setCalibrateDraft([]);
      toast.success("Drawing scale calibrated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save calibration.");
    } finally {
      setCalibratingSaving(false);
    }
  }

  const addWorldPoint = useCallback(
    // fallow-ignore-next-line complexity
    (clientX: number, clientY: number) => {
      if (pickSide !== "world" || !pendingPdf || !props.engine) return;
      const canvas = planCanvasRef.current;
      if (!canvas) return;
      const state = props.engine.getPlanMinimapState();
      if (!state?.bounds) {
        toast.error("Model plan bounds not ready — wait for the viewer to load.");
        return;
      }
      const pt = mapPointer(canvas, clientX, clientY);
      const hit = hitTestPlanMinimap(pt.x, pt.y, ALIGN_PLAN_PX, state);
      if (hit.kind !== "jump") {
        toast.message("Click on the floor footprint to place a control point.");
        return;
      }
      setControlPoints((prev) => [
        ...prev,
        { pdfNorm: pendingPdf, worldXZ: { x: hit.worldX, z: hit.worldZ } },
      ]);
      setPendingPdf(null);
      setPickSide("pdf");
    },
    [pickSide, pendingPdf, props.engine],
  );

  // fallow-ignore-next-line complexity
  async function save() {
    if (controlPoints.length < 2) {
      toast.error("Add at least 2 control point pairs.");
      return;
    }
    const transform = buildTransformFromControlPoints(
      controlPoints,
      mmPerPdfUnit,
      pageWidthPt,
      pageHeightPt,
    );
    setSaving(true);
    try {
      await saveDrawingCoordTransform(props.map.id, transform);
      toast.success("Coordinate alignment saved.");
      props.onSaved?.(transform);
      props.onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const stepLabel = calibrating
    ? calibrateDraft.length === 0
      ? "Calibrate: click the first end of a known dimension"
      : calibrateDraft.length === 1
        ? "Calibrate: click the second end of the same dimension"
        : "Enter the real-world length between the two points"
    : pickSide === "pdf"
      ? `Step ${controlPoints.length + 1}: pick a point on the PDF`
      : "Click the matching point on the 3D plan";

  return (
    <EnterpriseSlideOver
      open={props.open}
      onClose={props.onClose}
      panelMaxWidthClass="max-w-[min(960px,100vw)]"
      header={
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
            aria-hidden
          >
            <Compass className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Align coordinates
            </p>
            <h2 className="truncate text-base font-semibold text-[var(--enterprise-text)]">
              {props.map.pdfFileName ?? "Drawing"} · page {props.map.pageIndex + 1}
            </h2>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full min-w-0 flex-col gap-2.5">
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 lg:ml-auto lg:w-auto"
            onClick={() => void save()}
            disabled={saving || controlPoints.length < 2 || mmPerPdfUnit <= 0}
          >
            {saving ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Save className="h-4 w-4" />
                Save alignment
              </span>
            )}
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onClick={() => setControlPoints((p) => p.slice(0, -1))}
              disabled={controlPoints.length === 0 || saving}
            >
              <Undo2 className="mr-1 inline h-4 w-4" />
              Undo
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              onClick={() => {
                setControlPoints([]);
                setPendingPdf(null);
                setPickSide("pdf");
              }}
              disabled={saving}
            >
              <RotateCcw className="mr-1 inline h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      }
      footerClassName="!flex-col px-4 lg:px-5"
      overlayZClass="z-[110]"
      panelZClass="z-[111]"
    >
      <p className="mb-3 text-sm text-slate-600">{stepLabel}</p>
      {loadingContext ? (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading sheet calibration…
        </div>
      ) : null}
      {!loadingContext && mmPerPdfUnit <= 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
          <p className="font-medium">Drawing scale required</p>
          <p className="mt-1">
            Click <strong>Calibrate scale</strong>, then pick two points on a known dimension (e.g.
            a grid line or wall length) and enter its real length.
          </p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-amber-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-900"
            onClick={() => {
              setCalibrating(true);
              setCalibrateDraft([]);
              setPickSide("pdf");
              setPendingPdf(null);
            }}
          >
            Calibrate scale
          </button>
        </div>
      ) : !loadingContext ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
          Scale calibrated ({mmPerPdfUnit.toExponential(3)} mm per PDF unit)
        </div>
      ) : null}
      {calibrating && calibrateDraft.length >= 2 ? (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <label className="block text-xs text-slate-600">
            Known length (mm)
            <input
              type="number"
              min={1}
              step={1}
              value={knownLengthMm}
              onChange={(e) => setKnownLengthMm(e.target.value)}
              className="mt-1 block w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            disabled={calibratingSaving}
            onClick={() => void applyCalibration()}
          >
            {calibratingSaving ? "Saving…" : "Apply calibration"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
            onClick={() => {
              setCalibrating(false);
              setCalibrateDraft([]);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {residualWarning ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {residualWarning}
        </div>
      ) : null}
      {draftTransform ? (
        <p className="mb-3 text-xs text-slate-500">
          Scale {draftTransform.scale.toFixed(4)} · rotation{" "}
          {((draftTransform.rotationRad * 180) / Math.PI).toFixed(1)}° · {controlPoints.length}{" "}
          points — use <strong className="font-medium text-slate-700">Save alignment</strong> below.
        </p>
      ) : controlPoints.length > 0 && mmPerPdfUnit > 0 ? (
        <p className="mb-3 text-xs text-amber-800">
          Add at least 2 control point pairs to enable Save alignment.
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            PDF sheet
          </div>
          <BimPdfPageEmbed
            fileId={props.map.pdfFileId}
            fileVersionId={
              pdfFileVersionId ?? props.map.pdfFileVersionId ?? props.map.latestPdfFileVersionId
            }
            pageIndex={props.map.pageIndex}
            className={`h-[280px] ${calibrating || (mmPerPdfUnit > 0 && pickSide === "pdf") ? "cursor-crosshair" : ""}`}
            onPointerNorm={addPdfPoint}
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            3D plan (click footprint)
          </div>
          <div className="relative h-[280px] bg-slate-100">
            <canvas
              ref={planCanvasRef}
              width={ALIGN_PLAN_PX}
              height={ALIGN_PLAN_PX}
              className={`h-full w-full ${pickSide === "world" ? "cursor-crosshair" : "cursor-default"}`}
              aria-label="Top-down model plan for control point picking"
              onClick={(e) => addWorldPoint(e.clientX, e.clientY)}
            />
            {pickSide === "world" ? (
              <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-slate-900/75 px-2 py-1 text-[10px] text-white">
                <Compass className="h-3 w-3" aria-hidden />
                Click matching point on footprint
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-1 text-xs text-slate-600">
        {controlPoints.map((cp, i) => (
          <li key={i}>
            Point {i + 1}: PDF ({cp.pdfNorm.x.toFixed(3)}, {cp.pdfNorm.y.toFixed(3)}) ↔ World (
            {cp.worldXZ.x.toFixed(2)}, {cp.worldXZ.z.toFixed(2)})
          </li>
        ))}
      </ul>
    </EnterpriseSlideOver>
  );
}
