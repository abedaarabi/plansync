"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Crosshair,
  FileText,
  FolderOpen,
  PanelsTopLeft,
  Pencil,
  Plus,
  Rocket,
  Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { fetchBuildingClashSummary } from "@/lib/api-client/bim-clash";
import { ProRequiredError } from "@/lib/api-client/errors";
import type { BuildingAsset, BuildingPublishStatus } from "@/lib/api-client/locations";
import {
  readBuildingFederationSelection,
  writeBuildingFederationSelection,
} from "@/lib/locations/buildingFederationSelection";
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
import {
  workspaceHrefFromIfcAsset,
  workspaceHrefFromIfcAssets,
} from "@/lib/locations/workspaceHref";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "../EnterpriseWorkspaceContext";
import { PlanUpgradeCallout } from "../PlanUpgradeCallout";
import { BimPipelineProgress } from "../BimPipelineProgress";
import { BuildingClashHealth } from "./BuildingClashHealth";
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
  "enterprise-btn-secondary mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium";
const BTN_GHOST =
  "mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]";
const BTN_PRIMARY =
  "enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold";
const BTN_WARNING =
  "mobile-touch-target inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] px-3 py-1.5 text-sm font-medium text-[var(--enterprise-semantic-warning-text)] transition hover:opacity-90";

type BuildingTab = "overview" | "clashes";

// fallow-ignore-next-line complexity
export function BuildingDetailClient({ projectId, locationId, buildingId, workspaceId }: Props) {
  const { primary, loading: workspaceLoading } = useEnterpriseWorkspace();
  const isProPlus = isWorkspaceProPlusClient(primary?.workspace);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<BuildingAsset | null>(null);
  const [selectedIfcIds, setSelectedIfcIds] = useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = useState<BuildingTab>("overview");
  const fedSelectionHydrated = useRef(false);

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

  const readyIfcIds = useMemo(() => new Set(readyIfc.map((a) => a.id)), [readyIfc]);

  useEffect(() => {
    if (readyIfc.length === 0) {
      setSelectedIfcIds(new Set());
      fedSelectionHydrated.current = false;
      return;
    }
    if (!fedSelectionHydrated.current) {
      fedSelectionHydrated.current = true;
      const saved = readBuildingFederationSelection(buildingId).filter((id) => readyIfcIds.has(id));
      if (saved.length > 0) {
        setSelectedIfcIds(new Set(saved));
        return;
      }
      if (readyIfc.length <= 2) {
        setSelectedIfcIds(new Set(readyIfc.map((a) => a.id)));
      } else {
        setSelectedIfcIds(new Set([readyIfc[0]!.id]));
      }
      return;
    }
    setSelectedIfcIds((prev) => {
      const next = new Set([...prev].filter((id) => readyIfcIds.has(id)));
      if (next.size === 0 && readyIfc[0]) next.add(readyIfc[0].id);
      return next;
    });
  }, [buildingId, readyIfc, readyIfcIds]);

  useEffect(() => {
    if (!fedSelectionHydrated.current || selectedIfcIds.size === 0) return;
    writeBuildingFederationSelection(buildingId, [...selectedIfcIds]);
  }, [buildingId, selectedIfcIds]);

  const selectedReadyIfc = useMemo(
    () => readyIfc.filter((a) => selectedIfcIds.has(a.id)),
    [readyIfc, selectedIfcIds],
  );
  const primaryReadyIfc = selectedReadyIfc[0] ?? readyIfc[0] ?? null;
  const publishStatus = building?.publishStatus ?? "setup";
  const checklist = building?.checklist ?? {
    ifcReady: readyIfc.length > 0,
    levelCount: levels.length,
    mappedLevelCount: levels.filter((l) => l.mappedDrawingCount > 0).length,
    levelsWithoutDrawing: levels.filter((l) => l.mappedDrawingCount === 0).length,
    pdfCount: assets.filter((a) => a.type === "PDF").length,
    unmappedPdfCount: unmapped.length,
  };

  const resolveOpenAssets = (mode: "view" | "edit"): BuildingAsset[] | null => {
    if (readyIfc.length === 0) return null;
    if (selectedReadyIfc.length > 0) return selectedReadyIfc;
    if (mode === "edit") return [readyIfc[0]!];
    if (readyIfc.length <= 2) return readyIfc;
    toast.message("Select which models to open", {
      description: "Choose one or more READY IFC files below, then open again.",
    });
    return null;
  };

  // fallow-ignore-next-line complexity
  const openWorkspace = (
    mode: "view" | "edit",
    opts?: {
      panel?: string | null;
      testId?: string | null;
      clashId?: string | null;
      /** Prefer these file version ids when opening a specific clash/test. */
      partnerFileVersionIds?: string[];
    },
  ) => {
    if (!isProPlus) {
      toast.error("BIM requires Pro. Upgrade under Organization → Billing.");
      return;
    }
    let chosen = resolveOpenAssets(mode);
    if (!chosen?.length) return;
    const partners = opts?.partnerFileVersionIds?.filter(Boolean) ?? [];
    if (partners.length > 0 && mode === "view") {
      const byFv = new Map(
        readyIfc.filter((a) => a.fileVersionId).map((a) => [a.fileVersionId!, a]),
      );
      const partnerAssets = partners
        .map((fv) => byFv.get(fv))
        .filter((a): a is BuildingAsset => Boolean(a));
      if (partnerAssets.length > 0) {
        // Keep any already-selected extras that aren't the pair.
        const extra = chosen.filter((a) => a.fileVersionId && !partners.includes(a.fileVersionId));
        chosen = [...partnerAssets, ...extra];
      }
    }
    const last = mode === "view" ? readBuildingLastView(buildingId) : null;
    const href = workspaceHrefFromIfcAssets(
      chosen,
      projectId,
      buildingId,
      locationId,
      mode === "view"
        ? {
            mode: "work",
            view: last?.view ?? "3d",
            levelId: last?.view === "plan" ? last.levelId : null,
            panel: opts?.panel ?? null,
            testId: opts?.testId ?? null,
            clashId: opts?.clashId ?? null,
          }
        : { mode: "edit", view: "3d", levelId: null },
    );
    if (href) openBimViewer(href);
  };

  const openPdfMapping = (asset: BuildingAsset) => {
    if (!isProPlus) {
      toast.error("BIM requires Pro. Upgrade under Organization → Billing.");
      return;
    }
    if (!primaryReadyIfc) {
      toast.error("Upload a READY IFC before matching drawings.");
      return;
    }
    if (asset.mappingId && asset.mappedLevelId) {
      const href = workspaceHrefFromIfcAsset(primaryReadyIfc, projectId, buildingId, locationId, {
        mode: "edit",
        view: "3d",
        alignLevelId: asset.mappedLevelId,
        alignAssetId: asset.id,
      });
      openBimViewer(href);
      return;
    }
    const href = workspaceHrefFromIfcAsset(primaryReadyIfc, projectId, buildingId, locationId, {
      mode: "edit",
      view: "3d",
      previewAssetId: asset.id,
    });
    openBimViewer(href);
  };

  const toggleIfcSelection = (assetId: string) => {
    setSelectedIfcIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        if (next.size <= 1) return prev;
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
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

  const showClashHub = publishStatus === "ready" || publishStatus === "needs_update";
  const { data: clashSummary } = useQuery({
    queryKey: qk.buildingClashSummary(buildingId),
    queryFn: () => fetchBuildingClashSummary(buildingId),
    enabled: showClashHub && isProPlus,
    staleTime: 30_000,
    retry: (count, err) => (err instanceof ProRequiredError ? false : count < 2),
  });
  const openClashCount = clashSummary?.openCount ?? 0;

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

  if (workspaceLoading || (buildingPending && !building) || (assetsPending && !assetsData)) {
    return <EnterpriseLoadingState label="Loading building…" />;
  }

  if (!isProPlus) {
    return (
      <PlanUpgradeCallout
        feature="BIM & clash detection"
        detail="Upgrade to Pro to upload IFC models, publish buildings, and run clash detection."
      />
    );
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
      <header className="mb-1 flex flex-col gap-3 border-b border-[var(--enterprise-border)] pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
            aria-hidden
          >
            <Building2 className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label">Building</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="enterprise-type-title truncate">{building?.name}</h1>
              {building?.code ? (
                <span className="enterprise-badge-neutral rounded px-1.5 py-0.5 text-xs font-semibold">
                  {building.code}
                </span>
              ) : null}
              <span
                className={`${statusBadgeClass(publishStatus)} inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold`}
              >
                {buildingStatusLabel(publishStatus)}
              </span>
              {openClashCount > 0 ? (
                <button
                  type="button"
                  className="enterprise-badge-warning inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold transition hover:opacity-90"
                  onClick={() => setActiveTab("clashes")}
                >
                  {openClashCount} open clash{openClashCount === 1 ? "" : "es"}
                </button>
              ) : null}
            </div>
            <p className="enterprise-type-subtitle mt-1">
              {identityParts.length > 0 ? `${identityParts.join(" · ")} · ` : ""}
              {statusLine}
            </p>
            {assets.length > 0 ? (
              <p className="enterprise-type-caption mt-1">{metaParts.join(" · ")}</p>
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
                  {selectedReadyIfc.length >= 2
                    ? `Open federated (${selectedReadyIfc.length})`
                    : "Open 3D"}
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
        <div className="enterprise-card flex flex-col items-center gap-3 px-5 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
            <Upload
              className="h-4 w-4 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="max-w-sm space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
              Add your first files
            </h2>
            <p className="enterprise-type-subtitle text-[0.9375rem] leading-relaxed">
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
          {showClashHub ? (
            <nav
              aria-label="Building sections"
              role="tablist"
              className="grid w-full grid-cols-2 gap-0.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] p-0.5"
            >
              {(
                [
                  { id: "overview" as const, label: "Overview", icon: FolderOpen },
                  { id: "clashes" as const, label: "Clashes", icon: Crosshair },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    id={`building-tab-${tab.id}`}
                    aria-controls={`building-panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={
                      active
                        ? "flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors duration-150"
                        : "flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-[var(--enterprise-text-muted)] transition-colors duration-150 hover:bg-[var(--enterprise-surface)] hover:text-[var(--enterprise-text)]"
                    }
                    style={active ? { backgroundColor: "var(--enterprise-primary)" } : undefined}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "opacity-70"}`}
                      strokeWidth={active ? 2 : 1.75}
                      aria-hidden
                    />
                    <span>{tab.label}</span>
                    {tab.id === "clashes" && openClashCount > 0 ? (
                      <span
                        className={`rounded-md px-1.5 py-px text-xs font-bold tabular-nums ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]"
                        }`}
                      >
                        {openClashCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          ) : null}

          {(!showClashHub || activeTab === "overview") && (
            <div
              id="building-panel-overview"
              role={showClashHub ? "tabpanel" : undefined}
              aria-labelledby={showClashHub ? "building-tab-overview" : undefined}
              className="space-y-4"
            >
              {primaryReadyIfc ? (
                <section className="enterprise-card space-y-3 p-4">
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
                      {readyIfc.length > 1
                        ? "Select models to open together, or click a matched PDF to edit its mapping."
                        : readyIfc.length > 0
                          ? "Click a matched PDF to edit its mapping."
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
                  selectedIfcIds={selectedIfcIds}
                  onToggleIfc={readyIfc.length > 1 ? toggleIfcSelection : undefined}
                  onOpenPdf={primaryReadyIfc ? openPdfMapping : undefined}
                />
                {assets.every((a) => a.type !== "IFC") ? (
                  <p className="flex items-start gap-1.5 text-xs text-[var(--enterprise-text-muted)]">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Add an IFC model to extract levels and open the 3D workspace.
                  </p>
                ) : null}
              </section>
            </div>
          )}

          {showClashHub && activeTab === "clashes" ? (
            <div id="building-panel-clashes" role="tabpanel" aria-labelledby="building-tab-clashes">
              <BuildingClashHealth
                buildingId={buildingId}
                onReviewIn3d={() => openWorkspace("view", { panel: "clashes" })}
                onOpenTest={(testId) => openWorkspace("view", { panel: "clashes", testId })}
                onOpenClash={({ testId, clash }) =>
                  openWorkspace("view", {
                    panel: "clashes",
                    testId,
                    clashId: clash.id,
                    partnerFileVersionIds: [clash.fileVersionAId, clash.fileVersionBId],
                  })
                }
              />
            </div>
          ) : null}
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
