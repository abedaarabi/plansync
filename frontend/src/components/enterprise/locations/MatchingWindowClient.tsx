"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  MousePointerClick,
  PanelsTopLeft,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createLevelMapping,
  deleteLevelMapping,
  fetchBuildingAssets,
  fetchBuildingLevels,
  fetchLevelMappings,
  updateLevelMapping,
  type CalibrationInput,
} from "@/lib/api-client/locations";
import { openBimViewer } from "@/lib/bim/openBimViewer";
import {
  bakeTransformIntoCalibration,
  computeTransformFromCalibration,
} from "@/lib/locations/calibrationMath";
import { remainingUnmappedDrawings } from "@/lib/locations/matchNextDrawing";
import { invalidateBuildingQueries } from "@/lib/locations/useBuildingQueries";
import { buildWorkspaceHref } from "@/lib/locations/workspaceHref";
import { qk } from "@/lib/queryKeys";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import type { CanvasPoint } from "./CalibrationCanvas";
import { PdfPickPane } from "./matching/PdfPickPane";
import { PlanPickPane } from "./matching/PlanPickPane";
import { RotationDial } from "./RotationDial";
import { TransformNudgeControls } from "./TransformNudgeControls";

const RegistrationWorkspace = dynamic(
  () => import("./RegistrationWorkspace").then((m) => m.RegistrationWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="col-span-full flex min-h-[min(42dvh,380px)] flex-1 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--enterprise-text-muted)]" aria-hidden />
      </div>
    ),
  },
);

type SaveSuccessContext = {
  levelId: string;
  levelName: string;
  assetId: string;
  remainingUnmapped: number;
};

type Props = {
  projectId: string;
  locationId: string;
  buildingId: string;
  levelId: string;
  assetId: string;
  mode?: "calibrate" | "view";
  /** `workspace` embeds inside the BIM viewer; `page` is the standalone match route. */
  shell?: "page" | "workspace";
  onSaved?: (ctx: SaveSuccessContext) => void;
  onCancel?: () => void;
};

type CalStep = "pdf1" | "plan1" | "pdf2" | "plan2" | "done";

const STEPS: { id: CalStep; label: string }[] = [
  { id: "pdf1", label: "Point 1 · PDF" },
  { id: "plan1", label: "Point 1 · Plan" },
  { id: "pdf2", label: "Point 2 · PDF" },
  { id: "plan2", label: "Point 2 · Plan" },
];

function stepIndex(step: CalStep): number {
  if (step === "pdf1") return 0;
  if (step === "plan1") return 1;
  if (step === "pdf2") return 2;
  if (step === "plan2") return 3;
  return 4;
}

// fallow-ignore-next-line complexity
export function MatchingWindowClient({
  projectId,
  locationId,
  buildingId,
  levelId,
  assetId,
  mode = "calibrate",
  shell = "page",
  onSaved,
  onCancel,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<CalStep>("pdf1");
  const [pdfPoints, setPdfPoints] = useState<CanvasPoint[]>([]);
  const [planPoints, setPlanPoints] = useState<CanvasPoint[]>([]);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [manualTransform, setManualTransform] = useState(false);
  const [pageSizePt, setPageSizePt] = useState<{ width: number; height: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<SaveSuccessContext | null>(null);
  const [transform, setTransform] = useState({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotationDeg: 0,
  });

  const { data: levels = [], isLoading: levelsLoading } = useQuery({
    queryKey: qk.buildingLevels(buildingId),
    queryFn: () => fetchBuildingLevels(buildingId),
  });
  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: qk.buildingAssets(buildingId, "all"),
    queryFn: () => fetchBuildingAssets(buildingId),
  });
  const { data: levelMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: qk.levelMappings(levelId),
    queryFn: () => fetchLevelMappings(levelId),
  });

  const level = levels.find((l) => l.id === levelId);
  const asset = assetsData?.assets.find((a) => a.id === assetId);
  const levelMapping = useMemo(() => {
    if (assetId) {
      return levelMappings.find((m) => m.pdfFileId === assetId) ?? levelMappings[0] ?? null;
    }
    return levelMappings[0] ?? null;
  }, [levelMappings, assetId]);

  const pdfSource = useMemo(() => {
    if (asset?.id) {
      return {
        fileId: asset.id,
        fileVersionId: asset.fileVersionId ?? levelMapping?.pdfFileVersionId ?? null,
        fileName: asset.fileName,
        pageIndex: levelMapping?.pageIndex ?? 0,
      };
    }
    if (levelMapping) {
      return {
        fileId: levelMapping.pdfFileId,
        fileVersionId: levelMapping.pdfFileVersionId,
        fileName: levelMapping.pdfFileName,
        pageIndex: levelMapping.pageIndex,
      };
    }
    return null;
  }, [asset, levelMapping]);

  const ifcAsset = useMemo(() => {
    const ifcs = (assetsData?.assets ?? []).filter((a) => a.type === "IFC");
    if (level?.ifcFileVersionId) {
      return ifcs.find((a) => a.fileVersionId === level.ifcFileVersionId) ?? ifcs[0] ?? null;
    }
    return ifcs[0] ?? null;
  }, [assetsData?.assets, level?.ifcFileVersionId]);

  const existingMappingId = levelMapping?.id ?? null;
  const isUpdate = Boolean(existingMappingId);

  useEffect(() => {
    if (!levelMapping) return;
    const cal = levelMapping.calibrationJson;
    if (cal?.pointPairs) {
      setPdfPoints(cal.pointPairs.map((p) => p.pdf));
      setPlanPoints(cal.pointPairs.map((p) => p.plan));
      setStep("done");
    }
    if (
      levelMapping.offsetX != null &&
      levelMapping.offsetY != null &&
      levelMapping.scale != null &&
      levelMapping.rotationDeg != null
    ) {
      setTransform({
        offsetX: levelMapping.offsetX,
        offsetY: levelMapping.offsetY,
        scale: levelMapping.scale,
        rotationDeg: levelMapping.rotationDeg,
      });
      setManualTransform(true);
    } else if (cal) {
      setTransform(computeTransformFromCalibration(cal));
    }
  }, [levelMapping]);

  const pageExtras = useMemo(
    () => ({
      pageIndex: pdfSource?.pageIndex,
      ...(pageSizePt ? { pageWidth: pageSizePt.width, pageHeight: pageSizePt.height } : {}),
    }),
    [pdfSource?.pageIndex, pageSizePt],
  );

  /** Point-pair calibration used to auto-derive the overlay (before manual fine-tune). */
  const pointCalibration: CalibrationInput | null = useMemo(() => {
    if (pdfPoints.length < 2 || planPoints.length < 2) return null;
    return {
      pointPairs: [
        { pdf: pdfPoints[0]!, plan: planPoints[0]! },
        { pdf: pdfPoints[1]!, plan: planPoints[1]! },
      ],
      ...pageExtras,
    };
  }, [pdfPoints, planPoints, pageExtras]);

  /**
   * Saved calibration bakes dial/nudge into plan points so viewer sync
   * recovers the fine-tuned registration (including sheet vs cut rotation).
   */
  const calibration: CalibrationInput | null = useMemo(() => {
    if (pdfPoints.length < 2 || planPoints.length < 2) return null;
    if (manualTransform) {
      return bakeTransformIntoCalibration([pdfPoints[0]!, pdfPoints[1]!], transform, pageExtras);
    }
    return pointCalibration;
  }, [pdfPoints, planPoints, manualTransform, transform, pageExtras, pointCalibration]);

  useEffect(() => {
    if (pointCalibration && !manualTransform) {
      setTransform(computeTransformFromCalibration(pointCalibration));
    }
  }, [pointCalibration, manualTransform]);

  const handleSaveSuccess = async (updated: boolean) => {
    invalidateBuildingQueries(qc, buildingId, locationId);
    void qc.invalidateQueries({ queryKey: qk.levelMappings(levelId) });

    const unmapped = remainingUnmappedDrawings(assetsData?.unmapped ?? [], assetId);
    const ctx: SaveSuccessContext = {
      levelId,
      levelName: level?.name ?? "Level",
      assetId,
      remainingUnmapped: unmapped.length,
    };

    toast.success(
      updated
        ? `Registration updated for ${ctx.levelName}`
        : `Drawing registered to ${ctx.levelName}`,
    );

    if (shell === "workspace") {
      onSaved?.(ctx);
      return;
    }

    setSaveSuccess(ctx);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      if (!calibration) throw new Error("Complete calibration first");
      if (existingMappingId) {
        return updateLevelMapping(existingMappingId, { calibration });
      }
      return createLevelMapping(levelId, {
        fileAssetId: pdfSource?.fileId ?? assetId,
        calibration,
        ifcFileVersionId: level?.ifcFileVersionId ?? undefined,
        pageIndex: pdfSource?.pageIndex,
      });
    },
    onSuccess: () => void handleSaveSuccess(isUpdate),
    onError: (e: Error) => toast.error(e.message),
  });

  const unmapMut = useMutation({
    mutationFn: () => {
      if (!existingMappingId) throw new Error("No mapping to remove");
      return deleteLevelMapping(existingMappingId);
    },
    onSuccess: () => {
      invalidateBuildingQueries(qc, buildingId, locationId);
      void qc.invalidateQueries({ queryKey: qk.levelMappings(levelId) });
      toast.success("Drawing unmapped from level");
      setPdfPoints([]);
      setPlanPoints([]);
      setStep("pdf1");
      setManualTransform(false);
      onCancel?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const workspaceHref =
    ifcAsset && saveSuccess
      ? buildWorkspaceHref({
          fileId: ifcAsset.id,
          fileName: ifcAsset.fileName,
          projectId,
          buildingId,
          locationId,
          fileVersionId: ifcAsset.fileVersionId,
          mode: "edit",
          levelId: saveSuccess.levelId,
          view: "plan",
        })
      : null;

  const continueMatchingHref = useMemo(() => {
    if (!ifcAsset || !saveSuccess || saveSuccess.remainingUnmapped <= 0) return null;
    const next = remainingUnmappedDrawings(assetsData?.unmapped ?? [], saveSuccess.assetId)[0];
    if (!next) return null;
    const nextLevelId = levels.find((l) => l.mappedDrawingCount === 0)?.id ?? saveSuccess.levelId;
    return buildWorkspaceHref({
      fileId: ifcAsset.id,
      fileName: ifcAsset.fileName,
      projectId,
      buildingId,
      locationId,
      fileVersionId: ifcAsset.fileVersionId,
      mode: "edit",
      alignLevelId: nextLevelId,
      alignAssetId: next.id,
    });
  }, [ifcAsset, saveSuccess, assetsData?.unmapped, levels, projectId, buildingId, locationId]);

  const instruction =
    step === "pdf1"
      ? "Tap a known point on your PDF."
      : step === "plan1"
        ? "Tap the same point on the IFC cut below."
        : step === "pdf2"
          ? "Tap a second point on your PDF — pick a spot far from the first."
          : step === "plan2"
            ? "Tap the matching second point on the IFC cut."
            : "Fine-tune offset, scale, and rotation so the straight PDF sheet follows the IFC cut direction.";

  const handlePdfPick = (pt: CanvasPoint) => {
    if (mode === "view") return;
    if (step === "pdf1") {
      setPdfPoints([pt]);
      setStep("plan1");
    } else if (step === "pdf2") {
      setPdfPoints((p) => [p[0]!, pt]);
      setStep("plan2");
    }
  };

  const handlePlanPick = (pt: CanvasPoint) => {
    if (mode === "view") return;
    if (step === "plan1") {
      setPlanPoints([pt]);
      setStep("pdf2");
    } else if (step === "plan2") {
      setPlanPoints((p) => [p[0]!, pt]);
      setStep("done");
    }
  };

  const readOnly = mode === "view";
  const currentStepIdx = stepIndex(step);
  const pdfPickActive = !readOnly && (step === "pdf1" || step === "pdf2");
  const planPickActive = !readOnly && (step === "plan1" || step === "plan2");

  const alignmentProps = {
    pdfFileId: pdfSource?.fileId ?? null,
    pdfFileVersionId: pdfSource?.fileVersionId ?? null,
    pdfPageIndex: pdfSource?.pageIndex ?? 0,
    levelName: level?.name ?? "Level",
    pdfPoints,
    planPoints,
    pdfPickActive,
    planPickActive,
    onPdfPick: handlePdfPick,
    onPlanPick: handlePlanPick,
    onPageSizePt: (widthPt: number, heightPt: number) => {
      setPageSizePt((prev) =>
        prev && prev.width === widthPt && prev.height === heightPt
          ? prev
          : { width: widthPt, height: heightPt },
      );
    },
    transform,
    overlayOpacity,
  };

  const overlayControls =
    !readOnly && step === "done" ? (
      <>
        <TransformNudgeControls
          compact
          transform={transform}
          onChange={(t) => {
            setManualTransform(true);
            setTransform(t);
          }}
        />
        <RotationDial
          compact
          rotationDeg={transform.rotationDeg}
          onChange={(rotationDeg) => {
            setManualTransform(true);
            setTransform((t) => ({ ...t, rotationDeg }));
          }}
        />
      </>
    ) : null;

  if (levelsLoading || assetsLoading || mappingsLoading) {
    return (
      <div className="registration-workspace flex h-full min-h-0 items-center justify-center">
        <p className="text-sm text-[var(--enterprise-text-muted)]">Loading registration…</p>
      </div>
    );
  }

  if (saveSuccess && shell === "page") {
    return (
      <SaveSuccessPanel
        levelName={saveSuccess.levelName}
        remainingUnmapped={saveSuccess.remainingUnmapped}
        workspaceHref={workspaceHref}
        continueMatchingHref={continueMatchingHref}
        buildingHref={`/projects/${projectId}/locations/${locationId}/buildings/${buildingId}`}
      />
    );
  }

  if (!pdfSource && !readOnly) {
    return (
      <div className="registration-workspace flex h-full min-h-0 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-[var(--enterprise-text-muted)]">Drawing not found.</p>
        {shell === "workspace" && onCancel ? (
          <button
            type="button"
            className="text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
            onClick={onCancel}
          >
            Back to workspace
          </button>
        ) : (
          <Link
            href={`/projects/${projectId}/locations/${locationId}/buildings/${buildingId}`}
            className="text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            Back to building
          </Link>
        )}
      </div>
    );
  }

  if (!pdfSource && readOnly) {
    return (
      <div className="registration-workspace flex h-full min-h-0 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          No registered drawing on this level yet.
        </p>
        <Link
          href={`/projects/${projectId}/locations/${locationId}/buildings/${buildingId}`}
          className="text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
        >
          Back to building
        </Link>
      </div>
    );
  }

  return (
    <div className="registration-workspace flex h-full min-h-0 flex-col overflow-hidden">
      {!readOnly ? (
        <header className="z-10 shrink-0 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/95 px-2.5 py-1">
          <div className="mb-1 flex items-center gap-2">
            {shell === "workspace" && onCancel ? (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-0.5 text-xs font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                onClick={onCancel}
              >
                <X className="h-3 w-3" aria-hidden />
                Cancel
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {STEPS.map((s, i) => {
                const done = currentStepIdx > i;
                const active = step === s.id;
                return (
                  <div key={s.id} className="flex items-center gap-1.5">
                    {i > 0 ? (
                      <span
                        className={`hidden h-px w-2 sm:block ${done || active ? "bg-[var(--enterprise-primary)]/35" : "bg-[var(--enterprise-border)]"}`}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-medium ${
                        active
                          ? "bg-[var(--enterprise-primary)] text-white shadow-sm"
                          : done
                            ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary-deep)]"
                            : "bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-primary)]/85"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" aria-hidden />
                      ) : (
                        <Circle className="h-2.5 w-2.5 shrink-0" aria-hidden />
                      )}
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 shadow-sm">
            <MousePointerClick
              className={`h-3 w-3 shrink-0 ${pdfPickActive || planPickActive ? "text-[var(--enterprise-primary)]" : "text-[var(--enterprise-primary)]/65"}`}
              aria-hidden
            />
            <p className="text-xs leading-snug text-[var(--enterprise-text)]">{instruction}</p>
          </div>
        </header>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {ifcAsset?.fileVersionId ? (
          <RegistrationWorkspace
            fileId={ifcAsset.id}
            fileVersionId={ifcAsset.fileVersionId}
            fileName={ifcAsset.fileName}
            levelSourceName={level?.sourceName ?? null}
            levelDisplayName={level?.name ?? null}
            alignment={alignmentProps}
            overlayControls={overlayControls}
          />
        ) : (
          <div className="grid h-full min-h-0 flex-1 gap-1.5 p-1.5 md:grid-cols-2">
            <div className="grid min-h-0 grid-rows-2 gap-1.5">
              <PdfPickPane
                pdfFileId={alignmentProps.pdfFileId}
                pdfFileVersionId={alignmentProps.pdfFileVersionId}
                pdfPageIndex={alignmentProps.pdfPageIndex}
                pdfPoints={alignmentProps.pdfPoints}
                pdfPickActive={alignmentProps.pdfPickActive}
                onPdfPick={alignmentProps.onPdfPick}
              />
              <PlanPickPane
                engine={null}
                planLoading={false}
                planPoints={alignmentProps.planPoints}
                planPickActive={alignmentProps.planPickActive}
                onPlanPick={alignmentProps.onPlanPick}
              />
            </div>
            <div className="flex min-h-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 text-center shadow-sm">
              <p className="text-sm font-medium text-[var(--enterprise-text)]">No IFC model yet</p>
              <p className="max-w-xs text-xs text-[var(--enterprise-text-muted)]">
                Upload an IFC for this building to extract the level plan.
              </p>
            </div>
          </div>
        )}
      </div>

      {!readOnly ? (
        <footer className="z-10 shrink-0 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/95 px-2.5 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-5xl flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-[var(--enterprise-text-muted)]">
              <span className="shrink-0 whitespace-nowrap">PDF opacity</span>
              <input
                type="range"
                className="h-1.5 min-w-0 flex-1 accent-[var(--enterprise-primary)]"
                min={0.15}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              />
              <span className="w-7 shrink-0 text-right text-xs tabular-nums text-[var(--enterprise-text)]">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </label>

            <div className="flex shrink-0 justify-end gap-1.5">
              {existingMappingId ? (
                <button
                  type="button"
                  className="rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-xs font-medium text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-semantic-danger-bg)] disabled:opacity-50"
                  disabled={unmapMut.isPending || saveMut.isPending}
                  onClick={() => unmapMut.mutate()}
                >
                  {unmapMut.isPending ? "Unmapping…" : "Unmap"}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-xs font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                onClick={() => {
                  setPdfPoints([]);
                  setPlanPoints([]);
                  setStep("pdf1");
                  setManualTransform(false);
                }}
              >
                Reset points
              </button>
              <EnterpriseButton
                type="button"
                size="sm"
                className="px-2.5 text-xs"
                loading={saveMut.isPending}
                disabled={!calibration || unmapMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? "Saving…" : isUpdate ? "Save updates" : "Save registration"}
              </EnterpriseButton>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function SaveSuccessPanel({
  levelName,
  remainingUnmapped,
  workspaceHref,
  continueMatchingHref,
  buildingHref,
}: {
  levelName: string;
  remainingUnmapped: number;
  workspaceHref: string | null;
  continueMatchingHref: string | null;
  buildingHref: string;
}) {
  return (
    <div className="registration-workspace flex h-full min-h-0 flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[var(--enterprise-primary-soft)]">
        <CheckCircle2 className="h-7 w-7 text-[var(--enterprise-primary)]" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Drawing registered</h2>
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          <span className="font-medium text-[var(--enterprise-text)]">{levelName}</span> is ready.
          Open the 3D workspace to explore the matched floor plan.
        </p>
        {remainingUnmapped > 0 ? (
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            {remainingUnmapped} drawing{remainingUnmapped === 1 ? "" : "s"} still need matching.
          </p>
        ) : null}
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {workspaceHref ? (
          <EnterpriseButton type="button" size="md" onClick={() => openBimViewer(workspaceHref)}>
            <PanelsTopLeft className="h-4 w-4" aria-hidden />
            Open in 3D workspace
          </EnterpriseButton>
        ) : null}
        {continueMatchingHref ? (
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="md"
            onClick={() => openBimViewer(continueMatchingHref)}
          >
            Match next drawing
            <ArrowRight className="h-4 w-4" aria-hidden />
          </EnterpriseButton>
        ) : null}
        <Link
          href={buildingHref}
          className="text-sm text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-primary)]"
        >
          Back to building
        </Link>
      </div>
    </div>
  );
}
