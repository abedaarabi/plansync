"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Layers3, Loader2 } from "lucide-react";
import { BimEngine } from "@/components/bim-viewer/bimEngine";
import { BimLoadingOverlay } from "@/components/bim-viewer/BimLoadingOverlay";
import { loadFederationMember } from "@/lib/bim/loadFederationModel";
import { PLAN_REGISTRATION_BAKE_PX } from "@/lib/canvasRenderQuality";
import type { CutDisplayRotation } from "@/lib/locations/calibrationMath";
import type { CanvasPoint } from "./CalibrationCanvas";
import { PdfPickPane } from "./matching/PdfPickPane";
import { PlanPickPane } from "./matching/PlanPickPane";
import { OverlayPreviewPane } from "./matching/OverlayPreviewPane";

type Phase =
  | { kind: "loading"; label: string; fraction?: number; bytesTotal?: number }
  | { kind: "converting"; fraction: number; label: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type MatchAlignment = {
  pdfFileId: string | null;
  pdfFileVersionId: string | null;
  pdfPageIndex?: number;
  levelName: string;
  pdfPoints: CanvasPoint[];
  planPoints: CanvasPoint[];
  pdfPickActive: boolean;
  planPickActive: boolean;
  onPdfPick: (pt: CanvasPoint) => void;
  onPlanPick: (pt: CanvasPoint) => void;
  onPageSizePt?: (widthPt: number, heightPt: number) => void;
  transform: { offsetX: number; offsetY: number; scale: number; rotationDeg: number };
  overlayOpacity: number;
  cutRotationDeg: CutDisplayRotation;
  onCutRotate: (deg: CutDisplayRotation) => void;
};

type Props = {
  fileId: string;
  fileVersionId: string;
  fileName: string;
  levelSourceName: string | null;
  levelDisplayName: string | null;
  alignment: MatchAlignment;
  overlayControls?: ReactNode;
  screen: "points" | "review";
};

type RightTab = "overlay" | "3d";

async function applyLevelStorey(
  engine: BimEngine,
  sourceName: string | null,
  displayName: string | null,
): Promise<void> {
  const candidates = [sourceName, displayName].filter((name): name is string =>
    Boolean(name?.trim()),
  );
  for (const candidate of candidates) {
    const resolved = engine.resolveStoreyName(candidate);
    if (resolved) {
      await engine.setPlanMinimapStorey(resolved);
      return;
    }
  }
  if (candidates[0]) {
    await engine.setPlanMinimapStorey(candidates[0]);
  }
}

async function waitForPlanSilhouette(engine: BimEngine, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = engine.getPlanMinimapState();
    if (state?.silhouette && !state.baking) return;
    await new Promise((r) => window.setTimeout(r, 120));
  }
}

function RegistrationReviewPane({
  alignment,
  overlayControls,
  engine,
  planLoading,
  phase,
  fileVersionId,
  fileName,
  rightTab,
  onRightTab,
  show3d,
}: {
  alignment: MatchAlignment;
  overlayControls?: ReactNode;
  engine: BimEngine | null;
  planLoading: boolean;
  phase: Phase;
  fileVersionId: string;
  fileName: string;
  rightTab: RightTab;
  onRightTab: (tab: RightTab) => void;
  show3d: boolean;
}) {
  return (
    <div
      className={`relative z-10 m-1.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--enterprise-border)] ${show3d ? "pointer-events-none" : ""}`}
    >
      <div className="registration-pane-header pointer-events-auto">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
          Overlay
        </p>
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] p-0.5">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition ${
              rightTab === "overlay"
                ? "bg-[var(--enterprise-primary)] text-white"
                : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
            }`}
            onClick={() => onRightTab("overlay")}
          >
            <Layers3 className="h-3 w-3" aria-hidden />
            Overlay
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition ${
              rightTab === "3d"
                ? "bg-[var(--enterprise-primary)] text-white"
                : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
            }`}
            onClick={() => onRightTab("3d")}
          >
            <Box className="h-3 w-3" aria-hidden />
            3D
          </button>
        </div>
      </div>

      <div
        className={`relative min-h-0 flex-1 ${
          rightTab === "3d"
            ? "bg-transparent"
            : "registration-preview-viewport bg-[var(--enterprise-surface)]"
        }`}
      >
        {rightTab === "overlay" ? (
          <OverlayPreviewPane
            engine={engine}
            planLoading={planLoading}
            pdfFileId={alignment.pdfFileId}
            pdfFileVersionId={alignment.pdfFileVersionId}
            pdfPageIndex={alignment.pdfPageIndex}
            pdfPoints={alignment.pdfPoints}
            planPoints={alignment.planPoints}
            transform={alignment.transform}
            overlayOpacity={alignment.overlayOpacity}
            onPageSizePt={alignment.onPageSizePt}
            controls={overlayControls}
            cutRotationDeg={alignment.cutRotationDeg}
          />
        ) : null}

        {rightTab === "3d" && (phase.kind === "loading" || phase.kind === "converting") ? (
          <BimLoadingOverlay
            phase={
              phase.kind === "converting"
                ? { kind: "converting", fraction: phase.fraction, label: phase.label }
                : {
                    kind: "downloading",
                    label: phase.label,
                    fraction: phase.fraction,
                    bytesTotal: phase.bytesTotal,
                  }
            }
            fileVersionId={fileVersionId}
            modelName={fileName}
          />
        ) : null}

        {rightTab === "3d" && phase.kind === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--enterprise-surface)]/95 p-6 text-center">
            <p className="text-sm font-medium text-[var(--enterprise-semantic-danger-text)]">
              {phase.message}
            </p>
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              Confirm the IFC finished processing on the building page.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RegistrationWorkspace({
  fileId,
  fileVersionId,
  fileName,
  levelSourceName,
  levelDisplayName,
  alignment,
  overlayControls,
  screen,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BimEngine | null>(null);
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const [engine, setEngine] = useState<BimEngine | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: fileName });
  const [rightTab, setRightTab] = useState<RightTab>("overlay");

  const onViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    setViewportEl(node);
  }, []);

  useEffect(() => {
    if (!viewportEl) return;

    let cancelled = false;
    setPhase({ kind: "loading", label: fileName });
    setEngine(null);

    const bimEngine = new BimEngine({
      onSelection: () => undefined,
      onGroupsChanged: () => undefined,
    });
    engineRef.current = bimEngine;

    void (async () => {
      try {
        await bimEngine.init(viewportEl);
        if (cancelled) return;

        await loadFederationMember(
          bimEngine,
          { fileId, fileVersionId, name: fileName },
          {
            fitView: false,
            onDownloading: (fraction, bytesTotal) => {
              if (!cancelled) {
                setPhase({
                  kind: "loading",
                  label: fileName,
                  fraction,
                  bytesTotal: bytesTotal ?? undefined,
                });
              }
            },
            onConverting: (fraction) => {
              if (!cancelled) setPhase({ kind: "converting", fraction, label: fileName });
            },
          },
        );
        if (cancelled) return;

        setEngine(bimEngine);
        bimEngine.setPlanBakeResolution(PLAN_REGISTRATION_BAKE_PX);

        await applyLevelStorey(bimEngine, levelSourceName, levelDisplayName);
        if (cancelled) return;

        await waitForPlanSilhouette(bimEngine);
        if (cancelled) return;

        await bimEngine.fitToView();
        await bimEngine.resizeViewport();
        if (!cancelled) setPhase({ kind: "ready" });
      } catch (e) {
        if (!cancelled) {
          setPhase({
            kind: "error",
            message: e instanceof Error ? e.message : "Could not load 3D model.",
          });
        }
      }
    })();

    const ro = new ResizeObserver(() => {
      void bimEngine.resizeViewport();
    });
    ro.observe(viewportEl);

    return () => {
      cancelled = true;
      ro.disconnect();
      engineRef.current = null;
      setEngine(null);
      bimEngine.dispose();
    };
  }, [viewportEl, fileId, fileVersionId, fileName, levelSourceName, levelDisplayName]);

  useEffect(() => {
    if (screen === "review" && rightTab === "3d") void engineRef.current?.resizeViewport();
  }, [rightTab, screen]);

  const planLoading =
    phase.kind === "loading" ||
    phase.kind === "converting" ||
    (Boolean(engine) && phase.kind !== "ready" && phase.kind !== "error");

  const show3d = screen === "review" && rightTab === "3d";

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={onViewportRef}
        className={
          show3d
            ? "bim-viewer absolute inset-0 z-0 h-full w-full"
            : "bim-viewer pointer-events-none invisible absolute h-px w-px overflow-hidden"
        }
      />

      {screen === "points" ? (
        <div className="relative z-10 grid h-full min-h-0 grid-cols-1 gap-1.5 p-1.5 md:grid-cols-2">
          <PdfPickPane
            pdfFileId={alignment.pdfFileId}
            pdfFileVersionId={alignment.pdfFileVersionId}
            pdfPageIndex={alignment.pdfPageIndex}
            pdfPoints={alignment.pdfPoints}
            pdfPickActive={alignment.pdfPickActive}
            onPdfPick={alignment.onPdfPick}
            onPageSizePt={alignment.onPageSizePt}
          />
          <PlanPickPane
            engine={engine}
            planLoading={planLoading}
            planPoints={alignment.planPoints}
            planPickActive={alignment.planPickActive}
            onPlanPick={alignment.onPlanPick}
            cutRotationDeg={alignment.cutRotationDeg}
            onCutRotate={alignment.onCutRotate}
          />
        </div>
      ) : (
        <RegistrationReviewPane
          alignment={alignment}
          overlayControls={overlayControls}
          engine={engine}
          planLoading={planLoading}
          phase={phase}
          fileVersionId={fileVersionId}
          fileName={fileName}
          rightTab={rightTab}
          onRightTab={setRightTab}
          show3d={show3d}
        />
      )}
    </div>
  );
}
