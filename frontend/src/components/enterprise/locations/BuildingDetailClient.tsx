"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, FileText, PanelsTopLeft, Pencil, Plus, Rocket, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { BuildingAsset, BuildingPublishStatus } from "@/lib/api-client/locations";
import { buildingTypeLabel } from "@/lib/locations/buildingLabels";
import { hasProcessingAssets } from "@/lib/locations/buildingQueryUtils";
import {
  buildingStatusLabel,
  canPublishBuilding,
  readBuildingLastView,
} from "@/lib/locations/buildingPublish";
import {
  useBuildingAssetsQuery,
  useBuildingBimJobSync,
  useBuildingLevelsQuery,
  useBuildingQuery,
  useDeleteBuildingAssetMutation,
} from "@/lib/locations/useBuildingQueries";
import { useBimJobTracker, type BimJobPhase } from "@/lib/bim/bimJobTracker";
import { openBimViewer } from "@/lib/bim/openBimViewer";
import { workspaceHrefFromIfcAsset } from "@/lib/locations/workspaceHref";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { BimPipelineProgress } from "../BimPipelineProgress";
import { BuildingFilesList } from "./BuildingFilesList";
import { BuildingPublishChecklist } from "./BuildingPublishChecklist";
import { BuildingPublishDialog } from "./BuildingPublishDialog";
import { DeleteBuildingAssetDialog } from "./DeleteBuildingAssetDialog";

const BuildingFileBrowser = dynamic(
  () => import("./file-browser").then((m) => m.BuildingFileBrowser),
  { ssr: false },
);

type Props = {
  projectId: string;
  locationId: string;
  buildingId: string;
  workspaceId: string;
};

function phaseFromStatus(status: BuildingAsset["status"]): BimJobPhase {
  if (status === "FAILED") return "failed";
  if (status === "READY") return "published";
  if (status === "PROCESSING") return "indexing";
  return "registering";
}

function statusBadgeClass(status: BuildingPublishStatus): string {
  if (status === "ready") return "enterprise-badge-success";
  if (status === "needs_update") return "enterprise-badge-warning";
  return "enterprise-badge-neutral";
}

const BTN_SECONDARY =
  "enterprise-btn-secondary mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium";
const BTN_GHOST =
  "mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]";
const BTN_PRIMARY =
  "enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold";
const BTN_WARNING =
  "mobile-touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] px-3 py-1.5 text-sm font-medium text-[var(--enterprise-semantic-warning-text)] transition hover:opacity-90";

// fallow-ignore-next-line complexity
export function BuildingDetailClient({ projectId, locationId, buildingId, workspaceId }: Props) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<BuildingAsset | null>(null);

  useBuildingBimJobSync(buildingId, locationId, projectId);

  const { data: building, isPending: buildingPending } = useBuildingQuery(buildingId);
  const { data: assetsData, isPending: assetsPending } = useBuildingAssetsQuery(buildingId, {
    typeFilter: "ALL",
    disciplineFilter: "ALL",
  });
  const assets = useMemo(() => assetsData?.assets ?? [], [assetsData]);
  const ifcAssets = useMemo(() => assets.filter((a) => a.type === "IFC"), [assets]);
  const readyIfc = useMemo(() => ifcAssets.filter((a) => a.status === "READY"), [ifcAssets]);
  const processingIfc = useMemo(
    () => ifcAssets.filter((a) => a.status === "PENDING" || a.status === "PROCESSING"),
    [ifcAssets],
  );

  const pollLevels = hasProcessingAssets(assets) || ifcAssets.length > 0;
  const { data: levels = [] } = useBuildingLevelsQuery(buildingId, pollLevels);
  const unmapped = assetsData?.unmapped ?? [];
  const deleteMut = useDeleteBuildingAssetMutation(buildingId, locationId);

  const jobs = useBimJobTracker((s) => s.jobs);

  const primaryReadyIfc = readyIfc[0] ?? null;
  const publishStatus = building?.publishStatus ?? "setup";
  const checklist = building?.checklist ?? {
    ifcReady: readyIfc.length > 0,
    levelCount: levels.length,
    mappedLevelCount: levels.filter((l) => l.mappedDrawingCount > 0).length,
    levelsWithoutDrawing: levels.filter((l) => l.mappedDrawingCount === 0).length,
    pdfCount: assets.filter((a) => a.type === "PDF").length,
    unmappedPdfCount: unmapped.length,
  };

  const openWorkspace = (mode: "view" | "edit") => {
    if (!primaryReadyIfc) return;
    const last = mode === "view" ? readBuildingLastView(buildingId) : null;
    const href = workspaceHrefFromIfcAsset(
      primaryReadyIfc,
      projectId,
      buildingId,
      locationId,
      mode === "view"
        ? {
            mode: "work",
            view: last?.view ?? "3d",
            levelId: last?.view === "plan" ? last.levelId : null,
          }
        : { mode: "edit", view: "3d", levelId: null },
    );
    openBimViewer(href);
  };

  const wasProcessing = useRef(false);
  useEffect(() => {
    if (processingIfc.length > 0) {
      wasProcessing.current = true;
      return;
    }
    if (wasProcessing.current && primaryReadyIfc && publishStatus === "setup") {
      wasProcessing.current = false;
      openWorkspace("edit");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when processing ends
  }, [processingIfc.length, primaryReadyIfc, publishStatus]);

  const confirmDeleteAsset = () => {
    if (!assetToDelete) return;
    const name = assetToDelete.fileName;
    deleteMut.mutate(assetToDelete.id, {
      onSuccess: () => {
        toast.success(`Removed ${name}`);
        setAssetToDelete(null);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not remove file.");
      },
    });
  };

  if ((buildingPending && !building) || (assetsPending && !assetsData)) {
    return <EnterpriseLoadingState label="Loading building…" />;
  }

  const isReady = publishStatus === "ready";
  const needsUpdate = publishStatus === "needs_update";
  const canPublish = canPublishBuilding(checklist);

  const metaParts = [
    `${levels.length} level${levels.length === 1 ? "" : "s"}`,
    `${assets.length} file${assets.length === 1 ? "" : "s"}`,
  ];
  if (unmapped.length > 0) {
    metaParts.push(`${unmapped.length} unmapped`);
  }

  const identityParts = [
    buildingTypeLabel(building?.buildingType),
    building?.floorsApprox != null ? `~${building.floorsApprox} floors` : null,
  ].filter(Boolean);

  const statusLine = isReady
    ? "Published — open 3D or edit mappings anytime."
    : needsUpdate
      ? "Mappings changed since last publish."
      : "Upload an IFC, match drawings, then publish.";

  return (
    <div className="enterprise-animate-in space-y-4 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]"
            aria-hidden
          >
            <Building2 className="h-5 w-5 text-[var(--enterprise-primary)]" />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Building</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                {building?.name}
              </h1>
              {building?.code ? (
                <span className="rounded-md bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)]">
                  {building.code}
                </span>
              ) : null}
              <span
                className={`${statusBadgeClass(publishStatus)} inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold`}
              >
                {buildingStatusLabel(publishStatus)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              {identityParts.length > 0 ? `${identityParts.join(" · ")} · ` : ""}
              {statusLine}
            </p>
            {assets.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                {metaParts.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        {assets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <button type="button" className={BTN_GHOST} onClick={() => setBrowserOpen(true)}>
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Add files
            </button>
            {primaryReadyIfc && (isReady || needsUpdate) ? (
              <>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => openWorkspace("edit")}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit mappings
                </button>
                <button type="button" className={BTN_PRIMARY} onClick={() => openWorkspace("view")}>
                  <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden />
                  Open 3D
                </button>
              </>
            ) : primaryReadyIfc ? (
              <>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => openWorkspace("edit")}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Continue setup
                </button>
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={!canPublish}
                  onClick={() => setPublishOpen(true)}
                >
                  <Rocket className="h-3.5 w-3.5" aria-hidden />
                  Publish
                </button>
              </>
            ) : null}
            {needsUpdate && primaryReadyIfc ? (
              <button type="button" className={BTN_WARNING} onClick={() => setPublishOpen(true)}>
                <Rocket className="h-3.5 w-3.5" aria-hidden />
                Publish update
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {assets.length === 0 ? (
        <div className="enterprise-card flex flex-col items-center gap-3 rounded-xl px-5 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]">
            <Upload className="h-6 w-6 text-[var(--enterprise-primary)]" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
              Add your first files
            </h2>
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Upload an IFC model and PDF drawings. Setup opens when the model is ready.
            </p>
          </div>
          <button type="button" className={BTN_PRIMARY} onClick={() => setBrowserOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add files
          </button>
        </div>
      ) : processingIfc.length > 0 ? (
        <div className="space-y-3">
          {processingIfc.map((asset) => {
            const job = asset.fileVersionId ? jobs[asset.fileVersionId] : undefined;
            return (
              <BimPipelineProgress
                key={asset.id}
                phase={job?.phase ?? phaseFromStatus(asset.status)}
                uploadPct={job?.uploadPct}
                indexProgress={job?.indexProgress ?? null}
                indexPhase={job?.indexPhase ?? null}
                variant="upload"
                fileName={asset.fileName}
                title="Preparing your model"
              />
            );
          })}
          <p className="text-center text-xs text-[var(--enterprise-text-muted)]">
            You can leave this page — processing continues in the background.
          </p>
        </div>
      ) : (
        <>
          {primaryReadyIfc ? (
            <section className="enterprise-card space-y-3 rounded-xl p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
                    {isReady ? "Published checklist" : "Setup checklist"}
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
                    {isReady
                      ? "Edit mappings if drawings change."
                      : "Complete setup, then publish to unlock Open 3D."}
                  </p>
                </div>
                {unmapped.length > 0 ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
                    onClick={() => openWorkspace("edit")}
                  >
                    Match next drawing →
                  </button>
                ) : null}
              </div>
              <BuildingPublishChecklist checklist={checklist} />
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[var(--enterprise-text)]">Files</h2>
                <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
                  {readyIfc.length > 0
                    ? "IFC and PDF assets for this building."
                    : "Upload an IFC model to unlock setup."}
                </p>
              </div>
              <button type="button" className={BTN_GHOST} onClick={() => setBrowserOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            </div>
            <BuildingFilesList
              assets={assets}
              onDelete={setAssetToDelete}
              deletingId={deleteMut.isPending ? (assetToDelete?.id ?? null) : null}
            />
            {assets.every((a) => a.type !== "IFC") ? (
              <p className="flex items-start gap-1.5 text-xs text-[var(--enterprise-text-muted)]">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Add an IFC model to extract levels and open the 3D workspace.
              </p>
            ) : null}
          </section>
        </>
      )}

      <BuildingFileBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        buildingId={buildingId}
        buildingName={building?.name ?? "Building"}
        projectId={projectId}
        locationId={locationId}
        workspaceId={workspaceId}
      />

      {building?.checklist ? (
        <BuildingPublishDialog
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          buildingId={buildingId}
          locationId={locationId}
          checklist={building.checklist}
        />
      ) : null}

      <DeleteBuildingAssetDialog
        open={Boolean(assetToDelete)}
        asset={assetToDelete}
        onConfirm={confirmDeleteAsset}
        onCancel={() => {
          if (!deleteMut.isPending) setAssetToDelete(null);
        }}
        isDeleting={deleteMut.isPending}
      />
    </div>
  );
}
