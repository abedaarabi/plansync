"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  CircleAlert,
  ClipboardList,
  Crosshair,
  Eye,
  Filter,
  Home,
  ScanSearch,
  Sparkles,
  TableProperties,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api-url";
import {
  fetchBimQuantityIndexSummaryWithCache,
  fetchBimQuantityIndexWithCache,
  fetchBimSavedViews,
  fetchBimStatus,
  createBimSavedView,
  deleteBimSavedView,
  triggerBimConversion,
} from "@/lib/api-client/bim-viewer";
import type {
  BimLoqReport,
  BimQuantityEntry,
  BimQuantityIndex,
  BimSavedViewRecord,
} from "@/lib/bim/types";
import {
  BimEngine,
  type BimCameraMode,
  type BimLoadedModel,
  type BimSelection,
  type BimTool,
  type BimVisibilityGroup,
} from "./bimEngine";

import { BimWalkChrome } from "./BimWalkChrome";
import { BimSplitViewPane } from "./BimSplitViewPane";
import { BimBuildingTreePanel } from "./BimBuildingTreePanel";
import { BimLevelPlanView } from "./BimLevelPlanView";
import type { BuildingLevel } from "@/lib/api-client/locations";
import { useBuildingAssetsQuery, useBuildingLevelsQuery } from "@/lib/locations/useBuildingQueries";
import { writeBuildingLastView } from "@/lib/locations/buildingPublish";
import { buildWorkspaceHref, type BuildingWorkspaceMode } from "@/lib/locations/workspaceHref";
import dynamic from "next/dynamic";
import { AlignCoordinatesPanel } from "./AlignCoordinatesPanel";
import { BimContextMenu } from "./BimContextMenu";
import { BimIssueMarkersOverlay } from "./BimIssueMarkersOverlay";
import { BimClashDockContent } from "./BimClashDockContent";
import { ifcTypeCountsForModel, modelIdFromSet } from "@/lib/bim/clash/clashSets";
import { BimIssueCommentDialog } from "./BimIssueCommentDialog";
import { BimBreadcrumbChip } from "./BimBreadcrumbChip";
import { BimIconRail } from "./BimIconRail";
import { BimGlassDock } from "./BimGlassDock";
import { BimBottomToolBar, type BimBottomFlyout } from "./BimBottomToolBar";
import { BimPlanMinimap } from "./BimPlanMinimap";
import { BimShortcutsOverlay } from "./BimShortcutsOverlay";
import { useBimClashSession } from "@/lib/bim/clash/useBimClashSession";
import { patchClash } from "@/lib/api-client/bim-clash";
import { authClient } from "@/lib/auth-client";
import { EnterpriseBottomSheet } from "@/components/mobile/EnterpriseBottomSheet";
import type { BimClashStatus } from "@plansync/shared/bimClashTypes";
import {
  readSavedWalkPlanSize,
  writeSavedWalkPlanSize,
  type BimWalkPlanSize,
} from "@/lib/bim/walkPlanSize";
import { BimLeftDockContent, type BimLeftDockId } from "./BimLeftDockContent";
import { BimInspectDockContent, type BimInspectTab } from "./BimInspectDockContent";
import { BimTakeoffViewsDockContent } from "./BimTakeoffViewsDockContent";
import { fetchIssuesForFileVersion, patchIssue } from "@/lib/api-client/core-issues-takeoff";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { fetchIssue } from "@/lib/api-client";
import { compareBimQuantities } from "@/lib/api-client/bim-viewer";
import { rollupBimQuantities, type BimModelQuantityRollup } from "@/lib/bim/modelQuantity";
import { mergeViewportAppearance, type BimViewportAppearance } from "@/lib/bim/viewportAppearance";
import type { BimQualityState } from "@/lib/bim/renderQuality";
import {
  readSavedViewportAppearance,
  writeSavedViewportAppearance,
} from "@/lib/bim/viewportAppearanceStorage";
import {
  buildModelId,
  collapseLoadedModelsByMember,
  mergeFederatedQuantityIndices,
  syncFederationViewerUrl,
  type BimFederationMember,
} from "@/lib/bim/federation";
import { loadFederationMember, resolveFederationMember } from "@/lib/bim/loadFederationModel";
import type { CloudFile } from "@/types/projects";
import { BimMarkupOverlay } from "./BimMarkupOverlay";
import { BimIssuesDockContent } from "./BimIssuesDockContent";
import { IssueFormSlider } from "@/components/pdf-viewer/IssueFormSlider";
import { BimAssetFormSlider } from "./BimAssetFormSlider";
import { BimAssetInfoPanel } from "./BimAssetInfoPanel";
import { focusBimIssueInViewer } from "@/lib/bim/focusBimIssue";
import type { IssueBimAnchor } from "@/lib/api-client/core-issues-takeoff";
import { selectionToBimAnchor } from "@/lib/bim/bimIssueAnchor";
import {
  assetDraftFromBimSelection,
  bimAnchorFromSelection,
  BIM_ASSET_SOFT_FIT_SCALE,
} from "@/lib/bim/omAssetFromSelection";
import { findOmAssetByGuid } from "@/lib/bim/findOmAssetByGuid";
import type { AssetFormDraft } from "@/components/enterprise/OmAssetFormFields";
import {
  fetchOmAssets,
  type OmAssetBimAnchor,
  type OmAssetRow,
} from "@/lib/api-client/operations-maintenance-assets";
import { fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import {
  clashGroupIssueDescription,
  clashGroupIssueTitle,
  clashIssueDescription,
  clashIssuePriority,
  clashIssueTitle,
} from "@/lib/bim/clash/clashLabels";
import type { BimClashRow } from "@/lib/api-client/bim-clash";
import { compositeBimMarkupSnapshot, dataUrlToFile } from "@/lib/bim/bimMarkupSnapshot";
import { projectAnnotationsForDisplay } from "@/lib/bim/bimMarkupWorld";
import {
  hydrateBimMarkupViewerState,
  persistBimMarkupsNow,
  scheduleBimMarkupPersist,
} from "@/lib/bim/bimMarkupSync";
import { useBimMarkupStore } from "@/store/bimMarkupStore";
import {
  EMPTY_BIM_FILTER_STATE,
  hasActiveFilter,
  parseFilterState,
  ruleFromPropertyRow,
  type BimFilterState,
} from "@/lib/bim/bimFilters";
import { BimFiltersPanel, useBimFilterPreview } from "./BimFiltersPanel";
import { BimLoadingOverlay } from "./BimLoadingOverlay";
import { overallLoadFraction } from "@/lib/bim/bimLoadingSteps";
import { readModelThumbnailDataUrl } from "@/lib/bim/bimThumbnailCache";
import { BimLoadAbortedError } from "@/lib/bim/loadFetch";
import { disposeModelThumbnailService, peekModelThumbnail } from "@/lib/bim/modelThumbnail";
import {
  fetchBimSyncContext,
  fetchDrawingLevelMaps,
  type BimModelLevelDraft,
  type BimSyncContext,
  type DrawingMapRecord,
} from "@/lib/api-client/bim-publish";
import type { DrawingCoordTransform } from "@/lib/bim/drawingCoordBridge";
import {
  buildCoordTransformFromLocationCalibration,
  isLocationCalibration,
} from "@/lib/locations/locationMappingCoordBridge";
import type { BimChartSegment } from "@/lib/bim/chartStats";

const MatchingWindowClient = dynamic(
  () =>
    import("@/components/enterprise/locations/MatchingWindowClient").then(
      (m) => m.MatchingWindowClient,
    ),
  { ssr: false },
);

const UnmappedDrawingPreview = dynamic(
  () =>
    import("@/components/enterprise/locations/UnmappedDrawingPreview").then(
      (m) => m.UnmappedDrawingPreview,
    ),
  { ssr: false },
);

type PlanPanelMode = "minimap" | "drawingSync";

type BimDockId = BimLeftDockId | "properties" | "takeoffViews" | "issues" | "filters" | "clashes";

type Phase =
  | { kind: "resolving" }
  | {
      kind: "downloading";
      label?: string;
      index?: number;
      total?: number;
      fraction?: number;
      bytesTotal?: number;
    }
  | {
      kind: "converting";
      fraction: number;
      label?: string;
      index?: number;
      total?: number;
    }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type GeometryStreamProgress = {
  label?: string;
  index: number;
  total: number;
  /** 0–1 progress within the current model. */
  fraction: number;
};

const TOOL_HINTS: Record<BimTool, string | null> = {
  select: null,
  clip: "Drag green (top) or blue (side) arrow inward · Fits selection when elements are selected · Esc exits",
  length: "Click two points to measure length · Esc cancels",
  area: "Click corners, double-click to finish · Esc cancels",
  angle: "Click three points for angle · Esc cancels",
  markup: "Draw on the model view — markups stay with this camera angle · Right-drag to orbit",
};

// fallow-ignore-next-line complexity
export function BimViewerShell(props: {
  fileId: string;
  fileName: string;
  projectId: string | null;
  version: string | null;
  fileVersionId: string | null;
  initialGuid?: string | null;
  issueId?: string | null;
  /** Focus an O&M asset linked to a BIM element (`?omAssetId=`). */
  omAssetId?: string | null;
  compareFileVersionId?: string | null;
  federationMembers: BimFederationMember[];
  collabEnabled?: boolean;
  /** When set with a workspace mode, opens the building BIM workspace. */
  buildingId?: string | null;
  locationId?: string | null;
  /** `edit` = mapping setup; `work` = full tools (default when buildingId is set). */
  workspaceMode?: BuildingWorkspaceMode | null;
  initialLevelId?: string | null;
  initialView?: "3d" | "plan" | null;
  alignLevelId?: string | null;
  alignAssetId?: string | null;
  /** Preview an unmapped PDF before matching (`previewAssetId` query). */
  previewAssetId?: string | null;
  /** Open a dock on first ready (e.g. `clashes` from building hub). */
  initialPanel?: string | null;
  /** Deep-link into a clash test / clash after load. */
  initialClashTestId?: string | null;
  initialClashId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const engineRef = useRef<BimEngine | null>(null);
  const [activeEngine, setActiveEngine] = useState<BimEngine | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "resolving" });
  const [loadExiting, setLoadExiting] = useState(false);
  const [loadPreviewUrl, setLoadPreviewUrl] = useState<string | null>(null);
  /** `convert` only after client IFC conversion starts; reopen uses fast fragments path. */
  const [loadPath, setLoadPath] = useState<"fast" | "convert">("fast");
  const [loadRetryNonce, setLoadRetryNonce] = useState(0);
  const [geometryStream, setGeometryStream] = useState<GeometryStreamProgress | null>(null);
  const lastLoadPhaseRef = useRef<Exclude<Phase, { kind: "ready" } | { kind: "error" }>>({
    kind: "resolving",
  });
  if (phase.kind !== "ready" && phase.kind !== "error") {
    lastLoadPhaseRef.current = phase;
  }
  const [tool, setTool] = useState<BimTool>("select");
  const [cameraMode, setCameraMode] = useState<BimCameraMode>("orbit");
  const [selection, setSelection] = useState<BimSelection | null>(null);
  /** Latest pick — context-menu actions can run before React re-renders selection. */
  const selectionRef = useRef<BimSelection | null>(null);
  const [storeys, setStoreys] = useState<BimVisibilityGroup[]>([]);
  const [categories, setCategories] = useState<BimVisibilityGroup[]>([]);
  const [activeDock, setActiveDock] = useState<BimDockId | null>(null);
  const initialPanelApplied = useRef(false);
  const [inspectTab, setInspectTab] = useState<BimInspectTab>("properties");
  const [activeFlyout, setActiveFlyout] = useState<BimBottomFlyout>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [qualityState, setQualityState] = useState<BimQualityState | null>(null);
  const [resolvedFileVersionId, setResolvedFileVersionId] = useState<string | null>(
    props.fileVersionId,
  );
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(props.projectId);
  const [quantityIndex, setQuantityIndex] = useState<BimQuantityIndex | null>(null);
  const [clashDockOpen, setClashDockOpen] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  const [loq, setLoq] = useState<BimLoqReport | null>(null);
  const [conversionStatus, setConversionStatus] = useState("pending");
  const [quantityIndexError, setQuantityIndexError] = useState<string | null>(null);
  const [selectedGuids, setSelectedGuids] = useState<Set<string>>(new Set());

  const [loadedModels, setLoadedModels] = useState<BimLoadedModel[]>([]);
  const [federationMembers, setFederationMembers] = useState<BimFederationMember[]>(
    props.federationMembers,
  );
  const [addingFileVersionId, setAddingFileVersionId] = useState<string | null>(null);
  const initialMembersRef = useRef(props.federationMembers);
  const [appearance, setAppearance] = useState<BimViewportAppearance>(() =>
    readSavedViewportAppearance(),
  );
  const [savedViews, setSavedViews] = useState<BimSavedViewRecord[]>([]);
  const [filterState, setFilterState] = useState<BimFilterState>(EMPTY_BIM_FILTER_STATE);
  const { matches: filterMatches, legend: filterLegend } = useBimFilterPreview(
    quantityIndex,
    filterState,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsNarrowViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setClashDockOpen(activeDock === "clashes");
  }, [activeDock]);

  useEffect(() => {
    if (initialPanelApplied.current) return;
    if (phase.kind !== "ready") return;
    if (props.initialPanel !== "clashes") return;
    if (props.workspaceMode === "edit") return;
    initialPanelApplied.current = true;
    setActiveDock("clashes");
  }, [phase.kind, props.initialPanel, props.workspaceMode]);

  const logicalLoadedModels = useMemo(
    () => collapseLoadedModelsByMember(loadedModels),
    [loadedModels],
  );

  const clashModels = useMemo(
    () => logicalLoadedModels.map((m) => ({ modelId: m.modelId, name: m.name })),
    [logicalLoadedModels],
  );

  const clash = useBimClashSession({
    projectId: resolvedProjectId,
    fileVersionId: resolvedFileVersionId,
    quantityIndex,
    engine: activeEngine,
    // Stay active while reviewing even if Filters/Properties is open.
    active: Boolean(resolvedProjectId) && phase.kind === "ready",
    models: clashModels,
    initialTestId: props.initialClashTestId,
    initialClashId: props.initialClashId,
  });

  const prevActiveDockRef = useRef<BimDockId | null>(null);
  useEffect(() => {
    const prev = prevActiveDockRef.current;
    prevActiveDockRef.current = activeDock;
    // Returning to Clashes after Filters/other docks — restore green/red + gap marker.
    if (activeDock === "clashes" && prev !== "clashes" && clash.selectedClashId) {
      void clash.reapplyClashPresentation();
    }
  }, [activeDock, clash.selectedClashId, clash.reapplyClashPresentation]);

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(resolvedProjectId ?? ""),
    queryFn: () => fetchProjectSession(resolvedProjectId!),
    enabled: Boolean(resolvedProjectId),
    staleTime: 60_000,
  });
  const canCreateOmAsset = Boolean(
    projectSession &&
    !projectSession.isExternal &&
    projectSession.operationsMode &&
    projectSession.settings.modules.omAssets,
  );

  const { data: omAssetsList, refetch: refetchOmAssets } = useQuery({
    queryKey: qk.omAssets(resolvedProjectId ?? ""),
    queryFn: () => fetchOmAssets(resolvedProjectId!),
    enabled: Boolean(
      resolvedProjectId && phase.kind === "ready" && (canCreateOmAsset || props.omAssetId?.trim()),
    ),
    staleTime: 30_000,
  });

  const linkedAssetForSelection = useMemo(
    () => findOmAssetByGuid(omAssetsList, selection?.ifcGuid),
    [omAssetsList, selection?.ifcGuid],
  );

  const mobileAssigneeDefaulted = useRef(false);
  useEffect(() => {
    if (activeDock !== "clashes" || !isNarrowViewport || mobileAssigneeDefaulted.current) return;
    mobileAssigneeDefaulted.current = true;
    clash.setAssigneeMe(true);
  }, [activeDock, isNarrowViewport, clash.setAssigneeMe]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    hasSelection: boolean;
  } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [walkPlanSize, setWalkPlanSize] = useState<BimWalkPlanSize>(() => readSavedWalkPlanSize());
  const lastWalkPlanSizeRef = useRef<Exclude<BimWalkPlanSize, "off">>(
    readSavedWalkPlanSize() === "big" ? "big" : "mini",
  );
  const [planPanelMode, setPlanPanelMode] = useState<PlanPanelMode>("minimap");
  const [drawingMaps, setDrawingMaps] = useState<DrawingMapRecord[]>([]);
  const [publishedLevels, setPublishedLevels] = useState<BimModelLevelDraft[]>([]);
  const [syncContext, setSyncContext] = useState<BimSyncContext | null>(null);
  const [alignMap, setAlignMap] = useState<DrawingMapRecord | null>(null);
  const [alignOpen, setAlignOpen] = useState(false);
  const [clusterByType, setClusterByType] = useState(false);
  const [planMinimapStorey, setPlanMinimapStorey] = useState<string | null>(null);
  const workspaceActive = Boolean(props.buildingId);
  const [workspaceView, setWorkspaceView] = useState<"3d" | "plan">("3d");
  const [workspaceLevel, setWorkspaceLevel] = useState<BuildingLevel | null>(null);
  const [treeMobileOpen, setTreeMobileOpen] = useState(false);

  const alignActive = Boolean(
    props.alignLevelId && props.alignAssetId && props.buildingId && props.locationId,
  );
  /** Mapping setup: levels tree + cut/PDF; no rail / bottom tools. */
  const mappingEditActive = workspaceActive && (props.workspaceMode === "edit" || alignActive);
  const previewActive = Boolean(
    props.previewAssetId && props.buildingId && props.locationId && !alignActive,
  );

  const { data: buildingLevels = [] } = useBuildingLevelsQuery(
    props.buildingId ?? "",
    workspaceActive && phase.kind === "ready",
  );
  const { data: buildingAssetsData } = useBuildingAssetsQuery(props.buildingId ?? "", {
    typeFilter: "ALL",
    disciplineFilter: "ALL",
  });
  const previewAsset = previewActive
    ? (buildingAssetsData?.assets.find((a) => a.id === props.previewAssetId && a.type === "PDF") ??
      null)
    : null;

  const syncWorkspaceUrl = useCallback(
    (patch: {
      levelId?: string | null;
      view?: "3d" | "plan" | null;
      mode?: BuildingWorkspaceMode | null;
      alignLevelId?: string | null;
      alignAssetId?: string | null;
      previewAssetId?: string | null;
    }) => {
      if (!props.buildingId || !props.locationId || !resolvedProjectId) return;
      const extraModels = federationMembers.slice(1);
      const href = buildWorkspaceHref({
        fileId: props.fileId,
        fileName: props.fileName,
        projectId: resolvedProjectId,
        buildingId: props.buildingId,
        locationId: props.locationId,
        fileVersionId: resolvedFileVersionId,
        levelId: patch.levelId === undefined ? props.initialLevelId : patch.levelId,
        view:
          patch.view === undefined ? (props.initialView ?? undefined) : (patch.view ?? undefined),
        mode:
          patch.mode === undefined ? (props.workspaceMode ?? undefined) : (patch.mode ?? undefined),
        alignLevelId: patch.alignLevelId === undefined ? props.alignLevelId : patch.alignLevelId,
        alignAssetId: patch.alignAssetId === undefined ? props.alignAssetId : patch.alignAssetId,
        previewAssetId:
          patch.previewAssetId === undefined ? props.previewAssetId : patch.previewAssetId,
        models: extraModels.length > 0 ? extraModels : null,
        panel: searchParams.get("panel"),
      });
      router.replace(href, { scroll: false });
    },
    [
      props.fileId,
      props.fileName,
      props.buildingId,
      props.locationId,
      props.workspaceMode,
      props.initialLevelId,
      props.initialView,
      props.alignLevelId,
      props.alignAssetId,
      props.previewAssetId,
      resolvedProjectId,
      resolvedFileVersionId,
      federationMembers,
      searchParams,
      router,
    ],
  );

  const onMatchDrawing = useCallback(
    (levelId: string, assetId: string) => {
      syncWorkspaceUrl({
        alignLevelId: levelId,
        alignAssetId: assetId,
        previewAssetId: null,
      });
    },
    [syncWorkspaceUrl],
  );

  const onPreviewDrawing = useCallback(
    (assetId: string) => {
      syncWorkspaceUrl({
        previewAssetId: assetId,
        alignLevelId: null,
        alignAssetId: null,
      });
      setTreeMobileOpen(false);
    },
    [syncWorkspaceUrl],
  );

  const onPreviewClose = useCallback(() => {
    syncWorkspaceUrl({ previewAssetId: null });
  }, [syncWorkspaceUrl]);

  const onAlignSaved = useCallback(
    (ctx: { levelId: string; levelName: string; assetId: string; remainingUnmapped: number }) => {
      const level = buildingLevels.find((l) => l.id === ctx.levelId) ?? null;
      if (level) {
        setWorkspaceLevel(level);
        setWorkspaceView("plan");
      }
      if (props.buildingId) {
        writeBuildingLastView(props.buildingId, { levelId: ctx.levelId, view: "plan" });
      }
      syncWorkspaceUrl({
        alignLevelId: null,
        alignAssetId: null,
        previewAssetId: null,
        levelId: ctx.levelId,
        view: "plan",
      });
      if (ctx.remainingUnmapped > 0) {
        toast.message(`Mapped to ${ctx.levelName}`, {
          description: `${ctx.remainingUnmapped} drawing${ctx.remainingUnmapped === 1 ? "" : "s"} still unmapped — drag the next PDF onto a level.`,
        });
      } else {
        toast.success(`All drawings mapped — publish from the building page when ready.`);
      }
    },
    [buildingLevels, syncWorkspaceUrl, props.buildingId],
  );

  const onAlignCancel = useCallback(() => {
    syncWorkspaceUrl({ alignLevelId: null, alignAssetId: null, previewAssetId: null });
  }, [syncWorkspaceUrl]);

  const onSelectWorkspaceLevel = useCallback(
    (level: BuildingLevel) => {
      setWorkspaceLevel(level);
      setWorkspaceView("plan");
      setTreeMobileOpen(false);
      if (props.buildingId) {
        writeBuildingLastView(props.buildingId, { levelId: level.id, view: "plan" });
      }
      syncWorkspaceUrl({
        levelId: level.id,
        view: "plan",
        alignLevelId: null,
        alignAssetId: null,
      });
    },
    [syncWorkspaceUrl, props.buildingId],
  );

  const onShowWorkspaceModel = useCallback(() => {
    setWorkspaceView("3d");
    setWorkspaceLevel(null);
    if (props.buildingId) {
      writeBuildingLastView(props.buildingId, { levelId: null, view: "3d" });
    }
    syncWorkspaceUrl({ levelId: null, view: "3d", alignLevelId: null, alignAssetId: null });
  }, [syncWorkspaceUrl, props.buildingId]);

  useEffect(() => {
    if (!props.initialLevelId || buildingLevels.length === 0 || alignActive) return;
    const level = buildingLevels.find((l) => l.id === props.initialLevelId);
    if (!level) return;
    setWorkspaceLevel(level);
    setWorkspaceView(props.initialView ?? "plan");
  }, [props.initialLevelId, props.initialView, buildingLevels, alignActive]);

  useEffect(() => {
    const prev = document.title;
    const federated = federationMembers.length > 1 ? ` · ${federationMembers.length} models` : "";
    document.title = `${props.fileName}${federated} · PlanSync`;
    return () => {
      document.title = prev;
    };
  }, [props.fileName, federationMembers.length]);

  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [compareDeltas, setCompareDeltas] = useState<{
    baseVersion: number;
    compareVersion: number;
    deltas: {
      ifcType: string;
      countDelta: number;
      areaDelta: number | null;
      volumeDelta: number | null;
    }[];
  } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const issueFocusConsumedRef = useRef<string | null>(null);
  const filterZoomTimerRef = useRef<number | null>(null);
  const filterApplyGenRef = useRef(0);
  /** Skip one filter zoom after clash review ends (restore Ghost without yanking camera). */
  const skipFilterZoomOnceRef = useRef(false);
  /** Last applied visualize — mode-only toggles should not re-zoom. */
  const filterVisualizeRef = useRef(filterState.visualize);

  const markupAnnotations = useBimMarkupStore((s) => s.annotations);
  const markupSelectedIds = useBimMarkupStore((s) => s.selectedIds);
  const markupShape = useBimMarkupStore((s) => s.markupShape);
  const markupMode = useBimMarkupStore((s) => s.markupMode);
  const strokeColor = useBimMarkupStore((s) => s.strokeColor);
  const strokeWidth = useBimMarkupStore((s) => s.strokeWidth);
  const markupHydrated = useBimMarkupStore((s) => s.viewerStateHydrated);
  const setMarkupShape = useBimMarkupStore((s) => s.setMarkupShape);
  const setMarkupMode = useBimMarkupStore((s) => s.setMarkupMode);
  const setStrokeColor = useBimMarkupStore((s) => s.setStrokeColor);
  const setStrokeWidth = useBimMarkupStore((s) => s.setStrokeWidth);
  const setMarkupSelectedIds = useBimMarkupStore((s) => s.setSelectedIds);
  const removeMarkupAnnotations = useBimMarkupStore((s) => s.removeAnnotations);
  const linkMarkupsToIssue = useBimMarkupStore((s) => s.linkMarkupsToIssue);

  const [issueCreateDraft, setIssueCreateDraft] = useState<{
    bimAnchor?: IssueBimAnchor;
    initialLinkedMarkupIds?: string[];
    pendingReferencePhoto?: File;
    initialTitle?: string;
    initialDescription?: string;
    initialPriority?: string;
    sourceClashIds?: string[];
  } | null>(null);
  const [assetCreateDraft, setAssetCreateDraft] = useState<{
    bimAnchor: OmAssetBimAnchor;
    initialDraft: AssetFormDraft;
    pendingPhoto?: File;
  } | null>(null);
  const [focusedOmAsset, setFocusedOmAsset] = useState<OmAssetRow | null>(null);
  const [editingOmAsset, setEditingOmAsset] = useState<OmAssetRow | null>(null);
  const [clashIssuePreparing, setClashIssuePreparing] = useState(false);
  const [issuePlacementActive, setIssuePlacementActive] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [editIssue, setEditIssue] = useState<IssueRow | null>(null);
  const [commentDialogIssue, setCommentDialogIssue] = useState<IssueRow | null>(null);

  const onViewportRef = useCallback((node: HTMLDivElement | null) => {
    if (viewportRef.current === node) return;
    viewportRef.current = node;
    setViewportEl(node);
  }, []);

  useEffect(() => {
    if (phase.kind !== "ready") {
      setLoadExiting(false);
      return;
    }
    setLoadExiting(true);
    const timer = window.setTimeout(() => setLoadExiting(false), 300);
    return () => window.clearTimeout(timer);
  }, [phase.kind]);

  useEffect(() => {
    if (loadPreviewUrl || !resolvedFileVersionId) return;
    if (phase.kind === "ready" || phase.kind === "error") return;
    let cancelled = false;
    void readModelThumbnailDataUrl(resolvedFileVersionId).then((url) => {
      if (!cancelled && url) setLoadPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPreviewUrl, resolvedFileVersionId, phase.kind]);

  useEffect(() => {
    if (!viewportEl) return;

    let cancelled = false;
    let becameReady = false;
    const abort = new AbortController();
    disposeModelThumbnailService();
    setPhase({ kind: "resolving" });
    setLoadPath("fast");
    setLoadPreviewUrl(null);
    setGeometryStream(null);

    // Last-resort: if nothing reaches ready/error, surface Retry instead of spinning forever.
    const loadWatchdog = window.setTimeout(() => {
      if (cancelled || becameReady) return;
      cancelled = true;
      abort.abort();
      setGeometryStream(null);
      setPhase({
        kind: "error",
        message: "Loading is taking too long. Check your connection and try again.",
      });
    }, 10 * 60_000);

    // fallow-ignore-next-line complexity
    void (async () => {
      try {
        // Never await full-fragment thumbnail generation here — it can hang the
        // entire load on Preparing. Memory + IDB only; overlay also loads IDB itself.
        const fvId = props.fileVersionId;
        if (fvId) {
          const peek = peekModelThumbnail(fvId);
          if (peek) setLoadPreviewUrl(peek);
          else {
            void readModelThumbnailDataUrl(fvId).then((preview) => {
              if (!cancelled && preview) setLoadPreviewUrl(preview);
            });
          }
        }
        disposeModelThumbnailService();
        if (cancelled) return;

        const engine = new BimEngine({
          onSelection: (sel) => {
            if (cancelled) return;
            selectionRef.current = sel;
            setSelection(sel);
            // Clash review keeps green/red colors. Don't steal the Clashes dock
            // (issue deep-links and clash results live there); inspect via the clash panel.
            if (sel && engineRef.current?.isClashReviewActive()) {
              setInspectTab("properties");
              setActiveDock((prev) => (prev === "clashes" ? prev : "properties"));
            }
          },
          onGroupsChanged: (groups) => {
            if (cancelled) return;
            setStoreys(groups.storeys);
            setCategories(groups.categories);
          },
          onContextMenu: (pos) => {
            setContextMenu(pos);
          },
          onMultiSelection: (guids) => {
            if (cancelled) return;
            setSelectedGuids(new Set(guids));
          },
          onToolChange: (next) => {
            if (cancelled) return;
            setTool(next);
            if (next === "markup") setActiveFlyout("markup");
            else setActiveFlyout(null);
          },
          onQualityChanged: (state) => {
            if (!cancelled) setQualityState(state);
          },
          onCopyViewLink: () => {
            void navigator.clipboard.writeText(window.location.href).then(
              () => toast.success("View link copied"),
              () => toast.error("Could not copy link"),
            );
          },
        });
        engineRef.current = engine;
        setActiveEngine(engine);

        await engine.init(viewportEl);
        if (cancelled) return;
        await engine.setViewportAppearance(readSavedViewportAppearance());

        const resolvedMembers: BimFederationMember[] = [];
        for (const member of initialMembersRef.current) {
          if (cancelled) return;
          const resolved = member.fileVersionId
            ? member
            : await resolveFederationMember(member, props.projectId);
          resolvedMembers.push(resolved);
        }
        if (cancelled) return;

        const primary = resolvedMembers[0];
        setResolvedFileVersionId(primary?.fileVersionId ?? null);
        setResolvedProjectId(props.projectId);

        const memberTotal = resolvedMembers.length;
        /** Dismiss overlay immediately; camera fit must never block ready/tile load. */
        const markReadySoon = () => {
          if (cancelled || becameReady) return;
          becameReady = true;
          window.clearTimeout(loadWatchdog);
          setPhase({ kind: "ready" });
          void Promise.race([
            (async () => {
              await engine.fitToView();
              await engine.resizeViewport();
            })(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 2_500);
            }),
          ]).catch(() => undefined);
        };

        const reportProgress = (
          kind: "downloading" | "converting",
          i: number,
          member: BimFederationMember,
          fraction: number | null,
          bytesTotal?: number | null,
        ) => {
          if (cancelled) return;
          const local = fraction != null && Number.isFinite(fraction) ? fraction : null;
          if (becameReady) {
            setGeometryStream({
              label: member.name,
              index: i,
              total: memberTotal,
              fraction: local ?? 0,
            });
            return;
          }
          if (kind === "converting") {
            setLoadPath("convert");
            setPhase({
              kind: "converting",
              fraction: local ?? 0,
              label: member.name,
              index: i,
              total: memberTotal,
            });
            return;
          }
          setPhase({
            kind: "downloading",
            label: member.name,
            index: i,
            total: memberTotal,
            ...(local != null ? { fraction: local } : {}),
            ...(bytesTotal != null ? { bytesTotal } : {}),
          });
        };

        for (let i = 0; i < resolvedMembers.length; i++) {
          const member = resolvedMembers[i]!;
          if (cancelled) return;
          let lastLocalFraction = 0;
          const trackAndReport = (
            kind: "downloading" | "converting",
            fraction: number | null,
            bytesTotal?: number | null,
          ) => {
            if (fraction != null && Number.isFinite(fraction)) {
              lastLocalFraction = Math.min(1, Math.max(0, fraction));
            }
            reportProgress(kind, i, member, fraction, bytesTotal);
          };
          if (!becameReady) {
            setPhase({
              kind: "downloading",
              label: member.name,
              index: i,
              total: memberTotal,
            });
          } else {
            setGeometryStream({
              label: member.name,
              index: i,
              total: memberTotal,
              fraction: 0,
            });
          }
          await loadFederationMember(engine, member, {
            fitView: false,
            signal: abort.signal,
            onPreparing: (fraction) => {
              trackAndReport("downloading", fraction);
            },
            onDownloading: (fraction, bytesTotal) => {
              trackAndReport("downloading", fraction, bytesTotal);
            },
            onConverting: (fraction) => {
              trackAndReport("converting", fraction);
            },
            onFirstGeometry: () => {
              if (i === 0) {
                markReadySoon();
                // Keep a percent chip while remaining tiles / federated models stream.
                if (!cancelled) {
                  setGeometryStream({
                    label: member.name,
                    index: i,
                    total: memberTotal,
                    fraction: Math.max(lastLocalFraction, 0.05),
                  });
                }
              } else if (!cancelled) {
                setLoadedModels(engine.getLoadedModels());
              }
            },
          });
          if (!cancelled) setLoadedModels(engine.getLoadedModels());
        }

        if (cancelled) return;
        if (!becameReady) {
          markReadySoon();
        }
        setGeometryStream(null);
      } catch (e) {
        window.clearTimeout(loadWatchdog);
        if (cancelled || e instanceof BimLoadAbortedError) return;
        setGeometryStream(null);
        setPhase({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not load the model.",
        });
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(loadWatchdog);
      abort.abort();
      setGeometryStream(null);
      const engine = engineRef.current;
      engineRef.current = null;
      setActiveEngine(null);
      setClusterByType(false);
      engine?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one engine per primary model session
  }, [
    viewportEl,
    props.fileId,
    props.fileVersionId,
    props.fileName,
    props.projectId,
    loadRetryNonce,
  ]);

  useEffect(() => {
    const members = federationMembers.filter((m) => m.fileVersionId);
    if (members.length === 0 || phase.kind !== "ready") return;
    let cancelled = false;
    let timer: number | undefined;

    // fallow-ignore-next-line complexity
    const poll = async () => {
      try {
        const sources = [];
        let anyFailed = false;
        let anyPending = false;

        for (const member of members) {
          const status = await fetchBimStatus(member.fileVersionId);
          if (cancelled) return;
          if (status.conversionStatus === "failed") anyFailed = true;
          if (status.quantityIndexReady) {
            const index = await fetchBimQuantityIndexWithCache(member.fileVersionId);
            if (cancelled) return;
            sources.push({
              fileVersionId: member.fileVersionId,
              modelId: buildModelId(member),
              label: member.name,
              index,
            });
          } else if (status.quantityIndexSummaryReady) {
            const index = await fetchBimQuantityIndexSummaryWithCache(member.fileVersionId);
            if (cancelled) return;
            sources.push({
              fileVersionId: member.fileVersionId,
              modelId: buildModelId(member),
              label: member.name,
              index,
            });
            anyPending = true;
          } else {
            anyPending = true;
          }
          if (member.fileVersionId === resolvedFileVersionId) {
            setConversionStatus(status.conversionStatus);
            setLoq(status.loq);
          }
        }

        if (sources.length > 0) {
          const merged = mergeFederatedQuantityIndices(sources);
          if (merged) {
            setQuantityIndex(merged);
            setQuantityIndexError(null);
            engineRef.current?.setQuantityIndex(merged);
          }
        }

        if (anyPending) {
          setQuantityIndexError(
            anyFailed
              ? "Quantity index build failed for one or more models. Open Quality to rebuild."
              : null,
          );
          const enrichingOnly = sources.length > 0 && anyPending;
          timer = window.setTimeout(poll, enrichingOnly ? 12_000 : anyFailed ? 4000 : 2500);
          return;
        }

        if (anyFailed && sources.length === 0) {
          setQuantityIndexError("Quantity index build failed. Open the Quality tab to rebuild.");
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not load quantity index status.";
        setQuantityIndexError(msg);
        timer = window.setTimeout(poll, 4000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [federationMembers, phase.kind, resolvedFileVersionId]);

  useEffect(() => {
    const fvId = resolvedFileVersionId;
    if (!fvId || phase.kind !== "ready") return;
    void fetchBimSavedViews(fvId)
      .then((res) => setSavedViews(res.views))
      .catch(() => undefined);
  }, [resolvedFileVersionId, phase.kind]);

  useEffect(() => {
    const members = federationMembers.filter((m) => m.fileVersionId);
    if (members.length === 0 || phase.kind !== "ready") return;
    let cancelled = false;
    void Promise.all(members.map((m) => fetchIssuesForFileVersion(m.fileVersionId)))
      // fallow-ignore-next-line complexity
      .then((rows) => {
        if (cancelled) return;
        const byId = new Map<string, IssueRow>();
        for (const list of rows) {
          for (const row of list) {
            if (row.bimAnchor?.ifcGuid || row.bimAnchor?.position) {
              byId.set(row.id, row);
            }
          }
        }
        setIssues([...byId.values()]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [federationMembers, phase.kind]);

  const reloadIssues = useCallback(() => {
    const members = federationMembers.filter((m) => m.fileVersionId);
    if (members.length === 0) return;
    void Promise.all(members.map((m) => fetchIssuesForFileVersion(m.fileVersionId)))
      // fallow-ignore-next-line complexity
      .then((rows) => {
        const byId = new Map<string, IssueRow>();
        for (const list of rows) {
          for (const row of list) {
            if (row.bimAnchor?.ifcGuid || row.bimAnchor?.position) {
              byId.set(row.id, row);
            }
          }
        }
        setIssues([...byId.values()]);
      })
      .catch(() => undefined);
  }, [federationMembers]);

  useEffect(() => {
    const fvId = resolvedFileVersionId;
    if (!fvId || phase.kind !== "ready") return;
    void hydrateBimMarkupViewerState(fvId);
  }, [resolvedFileVersionId, phase.kind]);

  useEffect(() => {
    if (!useBimMarkupStore.getState().viewerStateHydrated) return;
    scheduleBimMarkupPersist();
  }, [markupAnnotations]);

  useEffect(() => {
    const fvId = resolvedFileVersionId;
    const otherId = props.compareFileVersionId;
    if (!fvId || !otherId || phase.kind !== "ready") return;
    void compareBimQuantities(fvId, otherId)
      .then(setCompareDeltas)
      .catch(() => undefined);
  }, [resolvedFileVersionId, props.compareFileVersionId, phase.kind]);

  useEffect(() => {
    const fvId = resolvedFileVersionId;
    const projectId = resolvedProjectId;
    if (!fvId || !projectId || phase.kind !== "ready") return;
    void fetchDrawingLevelMaps(projectId, fvId)
      .then((data) => {
        setDrawingMaps(data.maps);
        setPublishedLevels(data.levels);
      })
      .catch(() => {
        setDrawingMaps([]);
        setPublishedLevels([]);
      });
  }, [resolvedFileVersionId, resolvedProjectId, phase.kind]);

  useEffect(() => {
    if (searchParams.get("align") === "1" && drawingMaps.length > 0) {
      setAlignMap(drawingMaps[0] ?? null);
      setAlignOpen(true);
    }
  }, [searchParams, drawingMaps]);

  // fallow-ignore-next-line complexity
  useEffect(() => {
    if (planMinimapStorey || !activeEngine) return;
    const fromPublished = publishedLevels[0];
    const fromMap = drawingMaps[0]?.level;
    const candidate =
      fromPublished?.sourceName ??
      fromPublished?.displayName ??
      fromMap?.sourceName ??
      fromMap?.displayName ??
      storeys[0]?.name ??
      null;
    const resolved = activeEngine.resolveStoreyName(candidate) ?? candidate;
    if (resolved) setPlanMinimapStorey(resolved);
  }, [planMinimapStorey, storeys, drawingMaps, publishedLevels, activeEngine]);

  // fallow-ignore-next-line complexity
  const planStoreyOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    const add = (value: string | null | undefined, label: string | null | undefined) => {
      const v = value?.trim();
      const l = label?.trim();
      if (!v || !l || seen.has(v)) return;
      seen.add(v);
      options.push({ value: v, label: l });
    };

    for (const level of publishedLevels) {
      const resolved =
        activeEngine?.resolveStoreyName(level.sourceName) ??
        activeEngine?.resolveStoreyName(level.displayName) ??
        level.sourceName;
      add(resolved, level.displayName || level.sourceName);
    }

    for (const map of drawingMaps) {
      const src = map.level?.sourceName;
      const disp = map.level?.displayName;
      const resolved =
        activeEngine?.resolveStoreyName(src) ??
        activeEngine?.resolveStoreyName(disp) ??
        src ??
        disp;
      add(resolved, disp ?? src);
    }

    for (const storey of storeys) {
      add(storey.name, storey.name);
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [publishedLevels, drawingMaps, storeys, activeEngine]);

  // fallow-ignore-next-line complexity
  const activeLevelMap = useMemo(() => {
    if (drawingMaps.length === 0) return null;
    if (!planMinimapStorey) return drawingMaps[0] ?? null;
    return (
      // fallow-ignore-next-line complexity
      drawingMaps.find((m) => {
        const src = m.level?.sourceName;
        const disp = m.level?.displayName;
        if (src === planMinimapStorey || disp === planMinimapStorey) return true;
        const resolvedSrc = activeEngine?.resolveStoreyName(src);
        const resolvedDisp = activeEngine?.resolveStoreyName(disp);
        return (
          resolvedSrc === planMinimapStorey ||
          resolvedDisp === planMinimapStorey ||
          activeEngine?.resolveStoreyName(planMinimapStorey) === resolvedSrc
        );
      }) ?? drawingMaps[0]
    );
  }, [drawingMaps, planMinimapStorey, activeEngine]);

  const locationCalibration = isLocationCalibration(activeLevelMap?.calibrationJson)
    ? activeLevelMap.calibrationJson
    : null;

  const alignedCoordTransform =
    activeLevelMap?.coordTransformJson?.version === 1
      ? (activeLevelMap.coordTransformJson as DrawingCoordTransform)
      : null;

  const derivedCoordTransform = useMemo((): DrawingCoordTransform | null => {
    if (alignedCoordTransform || !locationCalibration || !activeEngine) return null;
    const state = activeEngine.getPlanMinimapState();
    if (!state?.bounds) return null;
    const pageWidthPt = syncContext?.pageWidthPt ?? locationCalibration.pageWidth ?? 612;
    const pageHeightPt = syncContext?.pageHeightPt ?? locationCalibration.pageHeight ?? 792;
    try {
      return buildCoordTransformFromLocationCalibration(
        locationCalibration,
        state.bounds,
        pageWidthPt,
        pageHeightPt,
      );
    } catch {
      return null;
    }
  }, [
    alignedCoordTransform,
    locationCalibration,
    activeEngine,
    syncContext?.pageWidthPt,
    syncContext?.pageHeightPt,
    planMinimapStorey,
  ]);

  const effectiveCoordTransform = alignedCoordTransform ?? derivedCoordTransform;

  const canDrawingSync = Boolean(effectiveCoordTransform && activeLevelMap);

  const effectiveSyncContext = useMemo((): BimSyncContext | null => {
    if (!effectiveCoordTransform || !activeLevelMap) return null;
    if (syncContext) {
      return { ...syncContext, coordTransform: effectiveCoordTransform };
    }
    const pdfFv =
      activeLevelMap.resolvedPdfFileVersionId ??
      activeLevelMap.pdfFileVersionId ??
      activeLevelMap.latestPdfFileVersionId ??
      null;
    if (!pdfFv) return null;
    return {
      levelId: activeLevelMap.bimModelLevelId,
      levelDisplayName: activeLevelMap.level?.displayName ?? "Level",
      levelSourceName: activeLevelMap.level?.sourceName ?? "",
      elevationMeters: activeLevelMap.level?.elevationMeters ?? null,
      pdfFileId: activeLevelMap.pdfFileId,
      pdfFileVersionId: pdfFv,
      pageIndex: activeLevelMap.pageIndex,
      pageWidthPt: locationCalibration?.pageWidth ?? 612,
      pageHeightPt: locationCalibration?.pageHeight ?? 792,
      mmPerPdfUnit: effectiveCoordTransform.mmPerPdfUnit,
      coordTransform: effectiveCoordTransform,
      drawingMapId: activeLevelMap.id,
    };
  }, [
    syncContext,
    effectiveCoordTransform,
    activeLevelMap,
    locationCalibration?.pageWidth,
    locationCalibration?.pageHeight,
  ]);

  useEffect(() => {
    const fvId = resolvedFileVersionId;
    if (!fvId || !activeLevelMap) {
      setSyncContext(null);
      return;
    }
    void fetchBimSyncContext(fvId, activeLevelMap.bimModelLevelId)
      .then(setSyncContext)
      .catch(() => {
        setSyncContext(null);
        if (planPanelMode === "drawingSync") {
          toast.error("Could not load drawing sync for this level.");
        }
      });
  }, [resolvedFileVersionId, activeLevelMap, planPanelMode]);

  useEffect(() => {
    if (!canDrawingSync) {
      if (planPanelMode === "drawingSync") setPlanPanelMode("minimap");
      return;
    }
    // Drawing sync lives in the big split pane only.
    if (
      cameraMode === "walk" &&
      walkPlanSize === "big" &&
      locationCalibration &&
      !alignedCoordTransform
    ) {
      setPlanPanelMode("drawingSync");
    }
  }, [
    canDrawingSync,
    planPanelMode,
    cameraMode,
    walkPlanSize,
    locationCalibration,
    alignedCoordTransform,
  ]);

  useEffect(() => {
    if (!activeEngine) return;
    void activeEngine.setPlanMinimapStorey(planMinimapStorey);
  }, [activeEngine, planMinimapStorey]);

  const onWalkPlanSizeChange = useCallback((size: BimWalkPlanSize) => {
    if (size !== "off") lastWalkPlanSizeRef.current = size;
    setWalkPlanSize(size);
    writeSavedWalkPlanSize(size);
  }, []);

  const onToggleWalkPlan = useCallback(() => {
    setWalkPlanSize((current) => {
      const next = current === "off" ? lastWalkPlanSizeRef.current : ("off" as const);
      if (next !== "off") lastWalkPlanSizeRef.current = next;
      writeSavedWalkPlanSize(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const guid = props.initialGuid;
    if (props.issueId?.trim()) return;
    if (!guid || phase.kind !== "ready") return;
    const soft = Boolean(props.omAssetId?.trim());
    void engineRef.current?.selectByGuids([guid], false).then(() => {
      void engineRef.current?.zoomToSelection(
        soft ? { fitScale: BIM_ASSET_SOFT_FIT_SCALE } : undefined,
      );
    });
  }, [props.initialGuid, props.issueId, props.omAssetId, phase.kind, quantityIndex]);

  useEffect(() => {
    const id = props.omAssetId?.trim();
    if (!id || !omAssetsList) return;
    setEditingOmAsset(null);
    setFocusedOmAsset(omAssetsList.find((a) => a.id === id) ?? null);
  }, [props.omAssetId, omAssetsList]);

  useEffect(() => {
    issueFocusConsumedRef.current = null;
  }, [props.issueId]);

  useEffect(() => {
    const issueId = props.issueId?.trim();
    if (!issueId || phase.kind !== "ready") return;
    if (issueFocusConsumedRef.current === issueId) return;

    let cancelled = false;
    // fallow-ignore-next-line complexity
    void (async () => {
      try {
        const issue = await fetchIssue(issueId);
        if (cancelled) return;

        const fvId = issue.fileVersionId;
        const matchesLoadedModel = (id: string | null | undefined) =>
          Boolean(
            id &&
            (id === props.fileVersionId ||
              id === resolvedFileVersionId ||
              federationMembers.some((m) => m.fileVersionId === id)),
          );
        if (!matchesLoadedModel(fvId)) {
          toast.error("This issue is linked to a different model revision.");
          issueFocusConsumedRef.current = issueId;
          return;
        }

        const engine = engineRef.current;
        if (!engine) return;

        const partnerFv = issue.bimAnchor?.fileVersionIdB?.trim() || "";
        const needClashPair = Boolean(issue.bimAnchor?.ifcGuidB?.trim());
        const partnerExpected = Boolean(
          partnerFv && federationMembers.some((m) => m.fileVersionId === partnerFv),
        );
        const partnerLoaded = () =>
          !partnerExpected || engine.getLoadedModels().some((m) => m.fileVersionId === partnerFv);

        // Primary marks ready on first geometry; wait for the clash partner model next.
        if (needClashPair && partnerExpected && !partnerLoaded()) {
          const waitUntil = Date.now() + 90_000;
          while (!cancelled && Date.now() < waitUntil && !partnerLoaded()) {
            await new Promise<void>((r) => window.setTimeout(r, 350));
          }
          if (cancelled) return;
          if (!partnerLoaded()) {
            // Still streaming — retry when loadedModels updates.
            return;
          }
        }

        // Clash issues store both guids on bimAnchor → ghost + green/red (no clash-test fetch).
        const focused = await focusBimIssueInViewer(engine, issue, {
          retryMs: needClashPair ? 20_000 : 15_000,
        });
        if (cancelled) return;

        const pairReady = !needClashPair || engine.hasBothClashPartnerColors();
        // Partner still streaming after a partial green paint — retry on next load.
        if (needClashPair && !pairReady && !partnerLoaded()) {
          return;
        }

        if (!focused && !pairReady) {
          toast.info("Could not locate the linked element — showing the full model.");
        }

        setSelectedIssueId(issue.id);
        setActiveDock("issues");
        setEditIssue(issue);
        issueFocusConsumedRef.current = issueId;
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not open issue.");
          issueFocusConsumedRef.current = issueId;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    props.issueId,
    props.fileVersionId,
    federationMembers,
    phase.kind,
    resolvedFileVersionId,
    loadedModels,
  ]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (phase.kind !== "ready") return;
    const resize = () => engineRef.current?.resizeViewport();
    resize();
    requestAnimationFrame(resize);
    const t = window.setTimeout(resize, 150);
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", resize);
    };
  }, [phase.kind, activeDock]);

  useEffect(() => {
    const body: { fileVersionId?: string; version?: number } = {};
    if (props.fileVersionId) body.fileVersionId = props.fileVersionId;
    if (props.version) {
      const n = Number(props.version);
      if (!Number.isNaN(n)) body.version = n;
    }
    void fetch(apiUrl(`/api/v1/files/${encodeURIComponent(props.fileId)}/open`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }, [props.fileId, props.version, props.fileVersionId]);

  const selectTool = useCallback((next: BimTool) => {
    setTool(next);
    if (next === "markup") {
      setActiveFlyout("markup");
    } else {
      setActiveFlyout(null);
    }
    engineRef.current?.setTool(next);
  }, []);

  const selectCameraMode = useCallback(
    async (next: BimCameraMode) => {
      const engine = engineRef.current;
      if (!engine) return;
      setActiveFlyout(null);
      try {
        await engine.setCameraMode(next, {
          preferredStorey: planMinimapStorey,
        });
        setCameraMode(engine.getCameraMode());
        if (next === "walk") {
          const landed = engine.getPlanMinimapStorey();
          if (landed) setPlanMinimapStorey(landed);
        }
      } catch {
        toast.error("Could not switch camera mode.");
        setCameraMode(engine.getCameraMode());
      }
    },
    [planMinimapStorey],
  );

  const fitToView = useCallback(() => {
    setActiveFlyout(null);
    void engineRef.current?.fitToView();
  }, []);

  const onShowAll = useCallback(() => {
    setActiveFlyout(null);
    setFilterState(EMPTY_BIM_FILTER_STATE);
    void engineRef.current?.showAllElements();
  }, []);

  const onToggleClusterByType = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setActiveFlyout(null);
    const next = !engine.isClusterByTypeActive();
    const toastId = toast.loading(next ? "Clustering by type…" : "Restoring layout…");
    void engine
      .setClusterByType(next)
      .then(() => {
        setClusterByType(engine.isClusterByTypeActive());
        toast.success(
          engine.isClusterByTypeActive()
            ? "Clustered by type — click again to restore."
            : "Model layout restored.",
          { id: toastId, duration: 2500 },
        );
      })
      .catch((err: unknown) => {
        setClusterByType(engine.isClusterByTypeActive());
        toast.error(err instanceof Error ? err.message : "Could not cluster by type.", {
          id: toastId,
        });
      });
  }, []);

  // Keep toolbar state in sync if the engine clears clustering (e.g. model add/remove).
  useEffect(() => {
    setClusterByType(engineRef.current?.isClusterByTypeActive() ?? false);
  }, [loadedModels]);

  /** Esc = Show all objects (clears isolate/hide/section/filters + selection). */
  useEffect(() => {
    if (phase.kind !== "ready") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || issuePlacementActive) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      onShowAll();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, onShowAll, issuePlacementActive]);

  useEffect(() => {
    if (clash.selectedClashId) skipFilterZoomOnceRef.current = true;
  }, [clash.selectedClashId]);

  // fallow-ignore-next-line complexity
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase.kind !== "ready") return;
    // Clash review owns ghost/colorize — filter dock must not overwrite it.
    // Re-runs when selectedClashId clears so Ghost/colorize restore after review.
    if (engine.isClashReviewActive()) return;

    const filterActive = hasActiveFilter(filterState);
    const colorizeActive = Boolean(filterState.colorize?.enabled);
    const applyGen = ++filterApplyGenRef.current;

    if (!filterActive && !colorizeActive) {
      skipFilterZoomOnceRef.current = false;
      void engine.applyFilterPresentation({
        filterActive: false,
        visualize: "none",
        matchGuids: [],
        colorizeGroups: [],
      });
      return;
    }

    const textOnly = filterState.rules.length === 0 && filterState.textQuery.trim().length > 0;
    const zoomDelay = textOnly ? 450 : 0;

    if (filterZoomTimerRef.current != null) {
      window.clearTimeout(filterZoomTimerRef.current);
    }

    const guids = filterMatches.map((m) => m.guid);
    const legend = filterLegend;
    const visualize = filterState.visualize;
    const visualizeChanged = filterVisualizeRef.current !== visualize;
    filterVisualizeRef.current = visualize;

    filterZoomTimerRef.current = window.setTimeout(() => {
      // fallow-ignore-next-line complexity
      void (async () => {
        if (applyGen !== filterApplyGenRef.current) return;
        if (engine.isClashReviewActive()) return;

        await engine.applyFilterPresentation({
          filterActive,
          visualize,
          matchGuids: guids,
          colorizeField: filterState.colorize?.field,
          colorizeGroups:
            colorizeActive && legend.length > 0
              ? legend.map((entry, i) => ({
                  styleId: `colorize:${i}`,
                  color: entry.color,
                  guids: entry.guids,
                  value: entry.value,
                }))
              : [],
        });
        if (applyGen !== filterApplyGenRef.current) return;
        if (engine.isClashReviewActive()) return;

        // Ghost/Hide/All toggles and post-clash restores should not re-frame the camera.
        const skipZoom = skipFilterZoomOnceRef.current || visualizeChanged;
        skipFilterZoomOnceRef.current = false;
        if (!skipZoom && filterActive && guids.length > 0) {
          await engine.zoomToGuids(guids);
        }
      })();
    }, zoomDelay);

    return () => {
      if (filterZoomTimerRef.current != null) {
        window.clearTimeout(filterZoomTimerRef.current);
      }
      filterApplyGenRef.current += 1;
    };
  }, [filterState, filterMatches, filterLegend, phase.kind, clash.selectedClashId]);

  const clearMarkups = useCallback(() => {
    setActiveFlyout(null);
    engineRef.current?.deleteMeasurements();
    engineRef.current?.deleteClippingPlanes();
    useBimMarkupStore.getState().clearAnnotations();
    void persistBimMarkupsNow();
  }, []);

  const onToggleGroup = useCallback(
    (kind: "storey" | "category", name: string, visible: boolean) => {
      void engineRef.current?.setGroupVisible(kind, name, visible);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    engineRef.current?.clearSelection();
    selectionRef.current = null;
    setSelection(null);
    setSelectedGuids(new Set());
  }, []);

  const openPropertiesDock = useCallback((tab: BimInspectTab = "properties") => {
    setInspectTab(tab);
    setActiveDock("properties");
  }, []);

  const toggleDock = useCallback((id: BimDockId) => {
    setActiveDock((prev) => (prev === id ? null : id));
  }, []);

  const openIssueDetail = useCallback(
    async (issue: IssueRow, opts?: { fly?: boolean; openForm?: boolean }) => {
      setSelectedIssueId(issue.id);
      setActiveDock("issues");
      // Clash pairs (ifcGuid + ifcGuidB) → ghost + green/red from bimAnchor alone.
      const shouldFocus = opts?.fly !== false || Boolean(issue.bimAnchor?.ifcGuidB);
      if (shouldFocus) {
        const engine = engineRef.current;
        if (engine) await focusBimIssueInViewer(engine, issue, { retryMs: 8_000 });
      }
      if (opts?.openForm !== false) {
        setEditIssue(issue);
      }
    },
    [],
  );

  const focusIssueOnly = useCallback(async (issue: IssueRow) => {
    setSelectedIssueId(issue.id);
    setActiveDock("issues");
    const engine = engineRef.current;
    if (engine) await focusBimIssueInViewer(engine, issue, { retryMs: 8_000 });
  }, []);

  const toggleFlyout = useCallback((flyout: Exclude<BimBottomFlyout, null>) => {
    setActiveFlyout((prev) => {
      const next = prev === flyout ? null : flyout;
      if (flyout === "markup" && next === "markup") {
        setTool("markup");
        engineRef.current?.setTool("markup");
      }
      return next;
    });
  }, []);

  const deleteSelectedMarkups = useCallback(() => {
    const ids = useBimMarkupStore.getState().selectedIds;
    if (ids.length === 0) return;
    removeMarkupAnnotations(ids);
    setMarkupSelectedIds([]);
    scheduleBimMarkupPersist();
  }, [removeMarkupAnnotations, setMarkupSelectedIds]);

  const startIssueCreate = useCallback(
    (draft: {
      bimAnchor?: IssueBimAnchor;
      initialLinkedMarkupIds?: string[];
      pendingReferencePhoto?: File;
      initialTitle?: string;
      initialDescription?: string;
      initialPriority?: string;
      sourceClashIds?: string[];
    }) => {
      if (!resolvedFileVersionId || !resolvedProjectId) {
        toast.error(
          "Missing project or file version. Reopen this model from the project Files tab.",
        );
        return;
      }
      setIssuePlacementActive(false);
      engineRef.current?.setIssuePlacementPick(null);
      setEditIssue(null);
      setFocusedOmAsset(null);
      setEditingOmAsset(null);
      setAssetCreateDraft(null);
      setActiveDock(null);
      setIssueCreateDraft(draft);
    },
    [resolvedFileVersionId, resolvedProjectId],
  );

  const armIssuePlacement = useCallback(() => {
    if (!resolvedFileVersionId || !resolvedProjectId) {
      toast.error("Missing project or file version. Reopen this model from the project Files tab.");
      return;
    }
    setIssueCreateDraft(null);
    setEditIssue(null);
    setActiveDock(null);
    setActiveFlyout(null);
    setTool("select");
    engineRef.current?.setTool("select");
    setIssuePlacementActive(true);
    toast.message("Click the model to place the issue.", { duration: 5000 });
  }, [resolvedFileVersionId, resolvedProjectId]);

  const captureIssueSnapshotFile = useCallback(
    // fallow-ignore-next-line complexity
    async (
      focus?: { normX: number; normY: number } | { anchor: IssueBimAnchor },
    ): Promise<File | undefined> => {
      const engine = engineRef.current;
      if (!engine) return undefined;
      let dataUrl: string | null;
      if (focus && "normX" in focus) {
        dataUrl = await engine.capturePlacementSnapshot(focus.normX, focus.normY);
      } else if (focus && "anchor" in focus) {
        dataUrl = await engine.captureAnchorSnapshot(focus.anchor);
      } else {
        dataUrl = await engine.captureSnapshot();
      }
      if (!dataUrl) return undefined;
      return dataUrlToFile(dataUrl, `${props.fileName.replace(/\.[^.]+$/, "")}-issue.png`);
    },
    [props.fileName],
  );

  const clashToBimAnchor = useCallback(
    (row: BimClashRow): IssueBimAnchor => {
      const memberA = federationMembers.find((m) => m.fileVersionId === row.fileVersionAId);
      const memberB = federationMembers.find((m) => m.fileVersionId === row.fileVersionBId);
      const sameModel = Boolean(row.fileVersionAId) && row.fileVersionAId === row.fileVersionBId;
      return {
        ifcGuid: row.guidA,
        name: row.elementA?.name ?? undefined,
        ifcType: row.elementA?.ifcType ?? undefined,
        position: row.point,
        fileVersionId: row.fileVersionAId || undefined,
        fileId: memberA?.fileId,
        modelFileName: memberA?.name,
        ifcGuidB: row.guidB,
        nameB: row.elementB?.name ?? undefined,
        ifcTypeB: row.elementB?.ifcType ?? undefined,
        // Self-clash: omit partner file so reopen stays single-model.
        fileVersionIdB: sameModel ? undefined : row.fileVersionBId || undefined,
        fileIdB: sameModel ? undefined : memberB?.fileId,
        modelFileNameB: sameModel ? undefined : memberB?.name,
      };
    },
    [federationMembers],
  );

  const openLinkedClashIssue = useCallback(async (issueId: string) => {
    try {
      const issue = await fetchIssue(issueId);
      setSelectedIssueId(issue.id);
      setActiveDock("issues");
      setEditIssue(issue);
      const engine = engineRef.current;
      if (engine) void focusBimIssueInViewer(engine, issue, { retryMs: 8_000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open linked issue");
    }
  }, []);

  const focusClash = clash.focusClash;
  const linkClashesToIssue = clash.linkClashesToIssue;

  const startIssueCreateFromClash = useCallback(
    (row: BimClashRow) => {
      void (async () => {
        if (row.issueId) {
          await openLinkedClashIssue(row.issueId);
          return;
        }
        if (!resolvedFileVersionId || !resolvedProjectId) {
          toast.error(
            "Missing project or file version. Reopen this model from the project Files tab.",
          );
          return;
        }
        setClashIssuePreparing(true);
        try {
          await focusClash(row);
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 220);
          });
          const anchor = clashToBimAnchor(row);
          const pendingReferencePhoto = await captureIssueSnapshotFile({ anchor });
          startIssueCreate({
            bimAnchor: anchor,
            pendingReferencePhoto,
            initialTitle: clashIssueTitle(row),
            initialDescription: clashIssueDescription(row),
            initialPriority: clashIssuePriority(row),
            sourceClashIds: [row.id],
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not prepare issue from clash");
        } finally {
          setClashIssuePreparing(false);
        }
      })();
    },
    [
      captureIssueSnapshotFile,
      clashToBimAnchor,
      focusClash,
      openLinkedClashIssue,
      resolvedFileVersionId,
      resolvedProjectId,
      startIssueCreate,
    ],
  );

  const startIssueCreateFromClashGroup = useCallback(
    (rows: BimClashRow[]) => {
      void (async () => {
        const unlinkeds = rows.filter((c) => !c.issueId);
        if (unlinkeds.length === 0) {
          const linkedId = rows.find((c) => c.issueId)?.issueId;
          if (linkedId) await openLinkedClashIssue(linkedId);
          else toast.message("No clashes to promote.");
          return;
        }
        if (!resolvedFileVersionId || !resolvedProjectId) {
          toast.error(
            "Missing project or file version. Reopen this model from the project Files tab.",
          );
          return;
        }
        const first = unlinkeds[0]!;
        setClashIssuePreparing(true);
        try {
          await focusClash(first);
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 220);
          });
          const anchor = clashToBimAnchor(first);
          const pendingReferencePhoto = await captureIssueSnapshotFile({ anchor });
          startIssueCreate({
            bimAnchor: anchor,
            pendingReferencePhoto,
            initialTitle: clashGroupIssueTitle(unlinkeds),
            initialDescription: clashGroupIssueDescription(unlinkeds),
            initialPriority: "HIGH",
            sourceClashIds: unlinkeds.map((c) => c.id),
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not prepare group issue from clashes",
          );
        } finally {
          setClashIssuePreparing(false);
        }
      })();
    },
    [
      captureIssueSnapshotFile,
      clashToBimAnchor,
      focusClash,
      openLinkedClashIssue,
      resolvedFileVersionId,
      resolvedProjectId,
      startIssueCreate,
    ],
  );

  const startIssueCreateFromSelection = useCallback(() => {
    // fallow-ignore-next-line complexity
    void (async () => {
      const sel = selectionRef.current ?? selection;
      const anchor =
        (sel ? selectionToBimAnchor(sel) : undefined) ??
        (selectedGuids.size > 0 ? { ifcGuid: [...selectedGuids][0]! } : undefined);
      if (!anchor) {
        toast.error("Select an element in the model first.");
        return;
      }
      const pendingReferencePhoto = await captureIssueSnapshotFile({ anchor });
      startIssueCreate({ bimAnchor: anchor, pendingReferencePhoto });
    })();
  }, [captureIssueSnapshotFile, selectedGuids, selection, startIssueCreate]);

  const startAssetCreateFromSelection = useCallback(() => {
    // fallow-ignore-next-line complexity
    void (async () => {
      if (!resolvedFileVersionId || !resolvedProjectId) {
        toast.error(
          "Missing project or file version. Reopen this model from the project Files tab.",
        );
        return;
      }
      if (!canCreateOmAsset) {
        toast.error("Operations assets are not enabled for this project.");
        return;
      }
      const sel = selectionRef.current ?? selection;
      if (!sel) {
        toast.error("Select an element in the model first.");
        return;
      }
      const existing = findOmAssetByGuid(omAssetsList, sel.ifcGuid);
      if (existing) {
        setEditingOmAsset(null);
        setFocusedOmAsset(existing);
        return;
      }
      const bimAnchor = bimAnchorFromSelection(sel);
      if (!bimAnchor) {
        toast.error("Select a model element with an IFC GUID to create an asset.");
        return;
      }
      const engine = engineRef.current;
      if (engine) {
        await engine.zoomToSelection({ fitScale: BIM_ASSET_SOFT_FIT_SCALE });
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 220);
        });
      }
      // Prefer enriched details if they finished while we zoomed / snapped.
      const draftSel = selectionRef.current ?? sel;
      const issueAnchor = selectionToBimAnchor(draftSel);
      const pendingPhoto = issueAnchor
        ? await captureIssueSnapshotFile({ anchor: issueAnchor })
        : await captureIssueSnapshotFile();
      setActiveDock(null);
      setFocusedOmAsset(null);
      setEditingOmAsset(null);
      setAssetCreateDraft({
        bimAnchor: bimAnchorFromSelection(draftSel) ?? bimAnchor,
        initialDraft: assetDraftFromBimSelection(draftSel),
        pendingPhoto,
      });
    })();
  }, [
    canCreateOmAsset,
    captureIssueSnapshotFile,
    omAssetsList,
    resolvedFileVersionId,
    resolvedProjectId,
    selection,
  ]);

  const viewAssetFromSelection = useCallback(() => {
    void (async () => {
      const asset = linkedAssetForSelection ?? findOmAssetByGuid(omAssetsList, selection?.ifcGuid);
      if (!asset) {
        toast.error("No asset linked to this element.");
        return;
      }
      const engine = engineRef.current;
      if (engine) {
        await engine.zoomToSelection({ fitScale: BIM_ASSET_SOFT_FIT_SCALE });
      }
      setAssetCreateDraft(null);
      setEditingOmAsset(null);
      setActiveDock(null);
      setFocusedOmAsset(asset);
    })();
  }, [linkedAssetForSelection, omAssetsList, selection?.ifcGuid]);

  const startAssetEdit = useCallback((asset: OmAssetRow) => {
    setAssetCreateDraft(null);
    setActiveDock(null);
    setFocusedOmAsset(null);
    setEditingOmAsset(asset);
  }, []);

  // fallow-ignore-next-line complexity
  const buildMarkupBimAnchor = useCallback((): IssueBimAnchor | undefined => {
    if (selection?.ifcGuid) {
      return {
        ifcGuid: selection.ifcGuid,
        localId: selection.localId,
        name: selection.name ?? undefined,
        ifcType: selection.ifcType ?? undefined,
        spatialPath: selection.storey ? [selection.storey] : undefined,
        position: selection.position ?? undefined,
      };
    }
    const cam = engineRef.current?.getCameraState();
    const tgt = cam?.target;
    if (Array.isArray(tgt) && tgt.length === 3) {
      return {
        ifcGuid: "viewport-markup",
        position: { x: tgt[0] as number, y: tgt[1] as number, z: tgt[2] as number },
      };
    }
    return undefined;
  }, [selection]);

  const onCreateIssueFromMarkup = useCallback(() => {
    // fallow-ignore-next-line complexity
    void (async () => {
      try {
        const ids = useBimMarkupStore.getState().selectedIds;
        if (ids.length === 0) {
          toast.error("Select at least one markup first.");
          return;
        }
        const engine = engineRef.current;
        const container = viewportRef.current;
        if (!engine || !container || !resolvedFileVersionId || !resolvedProjectId) {
          toast.error("Could not prepare issue from markup.");
          return;
        }
        const baseDataUrl = await engine.captureSnapshot();
        if (!baseDataUrl) {
          toast.error("Could not capture model snapshot.");
          return;
        }
        const rect = container.getBoundingClientRect();
        const storeAnnotations = useBimMarkupStore.getState().annotations;
        const projected = projectAnnotationsForDisplay(
          engine,
          storeAnnotations,
          rect.width,
          rect.height,
        );
        const projectedById = new Map(projected.map((a) => [a.id, a]));
        const snapshotAnnotations = ids
          .map((id) => projectedById.get(id) ?? storeAnnotations.find((a) => a.id === id))
          .filter((a): a is NonNullable<typeof a> => a != null);
        const composite = await compositeBimMarkupSnapshot(
          baseDataUrl,
          snapshotAnnotations.length > 0 ? snapshotAnnotations : projected,
          { markupIds: ids, cssW: rect.width, cssH: rect.height, cropToBounds: true },
        );
        if (!composite) {
          toast.error("Could not composite markup snapshot.");
          return;
        }
        const snapshotFile = dataUrlToFile(
          composite,
          `${props.fileName.replace(/\.[^.]+$/, "")}-markup.png`,
        );
        startIssueCreate({
          initialLinkedMarkupIds: ids,
          pendingReferencePhoto: snapshotFile,
          bimAnchor: buildMarkupBimAnchor(),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not prepare issue from markup.");
      }
    })();
  }, [
    buildMarkupBimAnchor,
    props.fileName,
    resolvedFileVersionId,
    resolvedProjectId,
    startIssueCreate,
  ]);

  const quantityRollup = useMemo(() => {
    if (selectedGuids.size === 0) {
      return {
        count: 0,
        length: null,
        area: null,
        volume: null,
        entries: [] as BimQuantityEntry[],
      };
    }
    return (
      engineRef.current?.rollupSelectedQuantities() ?? {
        count: selectedGuids.size,
        length: null,
        area: null,
        volume: null,
        entries: [] as BimQuantityEntry[],
      }
    );
  }, [selection, selectedGuids]);

  // fallow-ignore-next-line complexity
  const takeoffSelectionSummary = useMemo(() => {
    if (selectedGuids.size === 0) return null;
    const entries =
      quantityRollup.entries.length > 0
        ? quantityRollup.entries
        : (quantityIndex?.elements.filter((e) => selectedGuids.has(e.guid)) ?? []);
    const ifcTypes = [...new Set(entries.map((e) => e.ifcType).filter(Boolean))];
    return {
      elementCount: selectedGuids.size,
      ifcTypes,
      sampleName: entries[0]?.name ?? null,
    };
  }, [quantityRollup.entries, quantityIndex, selectedGuids]);

  const selectedGuidsKey = useMemo(() => [...selectedGuids].sort().join("|"), [selectedGuids]);

  // fallow-ignore-next-line complexity
  const resolveModelQuantities = useCallback(async (): Promise<BimModelQuantityRollup> => {
    const guids = selectedGuidsKey ? selectedGuidsKey.split("|") : [];
    if (guids.length === 0) {
      return { count: 0, length: null, area: null, volume: null };
    }
    const engine = engineRef.current;
    if (engine) return engine.resolveQuantityRollup(guids);
    const entries = quantityIndex?.elements.filter((e) => selectedGuids.has(e.guid)) ?? [];
    return rollupBimQuantities(
      entries.map((e) => e.quantities),
      guids.length,
    );
  }, [selectedGuidsKey, quantityIndex, selectedGuids]);

  const onSelectGuids = useCallback((guids: string[], additive: boolean) => {
    void engineRef.current?.selectByGuids(guids, additive);
  }, []);

  const onSelectType = useCallback(
    (ifcType: string, additive: boolean) => {
      const guids = quantityIndex?.byType[ifcType]?.guids ?? [];
      if (guids.length) void engineRef.current?.selectByGuids(guids, additive);
    },
    [quantityIndex],
  );

  const onContextAction = useCallback(
    (action: string) => {
      // fallow-ignore-next-line complexity
      void (async () => {
        const engine = engineRef.current;
        if (!engine) return;
        await engine.flushContextMenuPick();
        switch (action) {
          case "zoom":
            await engine.zoomToSelection();
            break;
          case "isolate":
            await engine.isolateSelection();
            break;
          case "xray":
            await engine.setXRayMode(true);
            break;
          case "section":
            await engine.sectionBoxOnSelection();
            break;
          case "hide":
            await engine.hideSelection();
            break;
          case "properties":
            openPropertiesDock("properties");
            break;
          case "createIssue":
            startIssueCreateFromSelection();
            break;
          case "createAsset":
            startAssetCreateFromSelection();
            break;
          case "viewAsset":
            viewAssetFromSelection();
            break;
          case "showAll":
            await engine.showAllElements();
            break;
        }
      })();
    },
    [
      openPropertiesDock,
      startAssetCreateFromSelection,
      startIssueCreateFromSelection,
      viewAssetFromSelection,
    ],
  );

  useEffect(() => {
    const engine = activeEngine;
    if (!engine || phase.kind !== "ready") return;

    if (!issuePlacementActive) {
      engine.setIssuePlacementPick(null);
      return;
    }

    engine.setIssuePlacementPick((normX, normY) => {
      void (async () => {
        const pendingReferencePhoto = await captureIssueSnapshotFile({ normX, normY });
        const anchor = await engine.buildIssueAnchorAtNorm(normX, normY);
        if (!anchor) {
          toast.error("Could not place issue on the model.");
          return;
        }
        startIssueCreate({ bimAnchor: anchor, pendingReferencePhoto });
      })();
    });

    return () => engine.setIssuePlacementPick(null);
  }, [captureIssueSnapshotFile, issuePlacementActive, activeEngine, phase.kind, startIssueCreate]);

  useEffect(() => {
    if (!issuePlacementActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIssuePlacementActive(false);
        engineRef.current?.setIssuePlacementPick(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [issuePlacementActive]);

  // fallow-ignore-next-line complexity
  const saveCurrentView = useCallback(async () => {
    const fvId = resolvedFileVersionId;
    const engine = engineRef.current;
    if (!fvId || !engine) return;
    const name = window.prompt("Saved view name");
    if (!name?.trim()) return;
    try {
      const { view } = await createBimSavedView(fvId, {
        name: name.trim(),
        cameraJson: engine.getCameraState(),
        filtersJson: filterState as unknown as Record<string, unknown>,
        hiddenGuids: [],
        isolatedGuids: filterMatches.map((m) => m.guid),
      });
      setSavedViews((prev) => [...prev, view]);
      toast.success("View saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save view.");
    }
  }, [resolvedFileVersionId, filterState, filterMatches]);

  // fallow-ignore-next-line complexity
  const saveFilterView = useCallback(async () => {
    const fvId = resolvedFileVersionId;
    const engine = engineRef.current;
    if (!fvId || !engine) return;
    const name = window.prompt("Saved filter name");
    if (!name?.trim()) return;
    try {
      const { view } = await createBimSavedView(fvId, {
        name: name.trim(),
        cameraJson: engine.getCameraState(),
        filtersJson: filterState as unknown as Record<string, unknown>,
        hiddenGuids: [],
        isolatedGuids: filterMatches.map((m) => m.guid),
      });
      setSavedViews((prev) => [...prev, view]);
      toast.success("Filter saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save filter.");
    }
  }, [resolvedFileVersionId, filterState, filterMatches]);

  // fallow-ignore-next-line complexity
  const applySavedView = useCallback(async (view: BimSavedViewRecord) => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.applyCameraState(view.cameraJson);
    const parsed = parseFilterState(view.filtersJson);
    if (parsed) {
      setFilterState(parsed);
      return;
    }
    if (view.isolatedGuids?.length) {
      await engine.selectByGuids(view.isolatedGuids, false);
      await engine.isolateSelection();
    } else {
      setFilterState(EMPTY_BIM_FILTER_STATE);
      await engine.showAllElements();
    }
  }, []);

  const addFilterRuleFromProperty = useCallback(
    (group: string, property: string, value: string) => {
      const rule = ruleFromPropertyRow(group, property, value);
      if (!rule) return;
      setFilterState((prev) => ({
        ...prev,
        rules: [...prev.rules, rule],
      }));
      setActiveDock("filters");
      toast.success("Filter rule added.");
    },
    [],
  );

  const deleteSavedView = useCallback(async (viewId: string) => {
    try {
      await deleteBimSavedView(viewId);
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete view.");
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  const captureSnapshot = useCallback(() => {
    void (async () => {
      const dataUrl = await engineRef.current?.captureSnapshot();
      if (!dataUrl) {
        toast.error("Could not capture snapshot.");
        return;
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${props.fileName.replace(/\.[^.]+$/, "")}-snapshot.png`;
      a.click();
      toast.success("Snapshot downloaded.");
    })();
  }, [props.fileName]);

  const onSelectIssue = useCallback((issue: IssueRow) => {
    setSelectedIssueId(issue.id);
  }, []);

  const onMarkerOpenDetails = useCallback(
    (issue: IssueRow) => {
      void openIssueDetail(issue, { fly: false });
    },
    [openIssueDetail],
  );

  const onMarkerLocateAsset = useCallback(
    (issue: IssueRow) => {
      void focusIssueOnly(issue);
      const guid = issue.bimAnchor?.ifcGuid;
      if (guid && guid !== "viewport-markup") {
        void engineRef.current?.selectByGuids([guid]);
      }
    },
    [focusIssueOnly],
  );

  const onMarkerOpenDocuments = useCallback(
    (issue: IssueRow) => {
      void openIssueDetail(issue, { fly: false });
    },
    [openIssueDetail],
  );

  const onMarkerAddComment = useCallback((issue: IssueRow) => {
    setCommentDialogIssue(issue);
  }, []);

  const onIssueCommentAdded = useCallback((issueId: string, commentCount: number) => {
    setIssues((prev) => prev.map((row) => (row.id === issueId ? { ...row, commentCount } : row)));
    setEditIssue((prev) => (prev?.id === issueId ? { ...prev, commentCount } : prev));
  }, []);

  const onMarkerResolveIssue = useCallback(
    (issue: IssueRow) => {
      void patchIssue(issue.id, { status: "RESOLVED" })
        .then(() => {
          toast.success("Issue resolved.");
          reloadIssues();
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not resolve issue."));
    },
    [reloadIssues],
  );

  const onAppearanceChange = useCallback((patch: Partial<BimViewportAppearance>) => {
    setAppearance((prev) => {
      const next = mergeViewportAppearance(prev, patch);
      writeSavedViewportAppearance(next);
      return next;
    });
    void engineRef.current?.setViewportAppearance(patch);
  }, []);

  const rebuildIndex = useCallback(() => {
    const members = federationMembers.filter((m) => m.fileVersionId);
    if (members.length === 0) return;
    setConversionStatus("pending");
    setQuantityIndexError(null);
    void Promise.all(members.map((m) => triggerBimConversion(m.fileVersionId)))
      .then(() =>
        toast.success(
          members.length > 1
            ? `Index rebuild queued for ${members.length} models.`
            : "Index rebuild queued.",
        ),
      )
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not rebuild index."));
  }, [federationMembers]);

  const backHref =
    props.buildingId && props.locationId && resolvedProjectId
      ? `/projects/${resolvedProjectId}/locations/${props.locationId}/buildings/${props.buildingId}`
      : resolvedProjectId
        ? `/projects/${resolvedProjectId}/files`
        : "/projects";
  const loading = phase.kind !== "ready" && phase.kind !== "error";
  const showLoadOverlay = loading || loadExiting;
  const geometryStreamPct =
    geometryStream != null
      ? Math.max(
          1,
          Math.min(
            99,
            Math.round(
              overallLoadFraction(
                geometryStream.index,
                geometryStream.total,
                geometryStream.fraction,
              ) * 100,
            ),
          ),
        )
      : null;

  const hint = TOOL_HINTS[tool];
  const toolNeedsPoint =
    tool !== "select" && tool !== "clip" && tool !== "markup" && phase.kind === "ready";
  const selectionCount = selectedGuids.size || (selection ? 1 : 0);
  const activeFileVersionId = selection?.fileVersionId ?? resolvedFileVersionId;
  const activeFileId = selection?.modelId?.split(":")[0] ?? props.fileId;
  const isFederated = federationMembers.length > 1;

  const onToggleModelVisible = useCallback((modelId: string, visible: boolean) => {
    void engineRef.current?.setModelVisible(modelId, visible).then(() => {
      setLoadedModels(engineRef.current?.getLoadedModels() ?? []);
    });
  }, []);

  const onAddFederationMember = useCallback(
    // fallow-ignore-next-line complexity
    async (file: CloudFile, fileVersionId: string, version: number) => {
      const engine = engineRef.current;
      const projectId = resolvedProjectId ?? props.projectId;
      if (!engine || phase.kind !== "ready" || !projectId) return;
      if (federationMembers.some((m) => m.fileVersionId === fileVersionId)) return;

      const member: BimFederationMember = {
        fileId: file.id,
        fileVersionId,
        version: String(version),
        name: file.name,
      };

      setAddingFileVersionId(fileVersionId);
      try {
        const resolved = await resolveFederationMember(member, projectId);
        await loadFederationMember(engine, resolved, { fitView: false });
        setFederationMembers((prev) => {
          const next = [...prev, resolved];
          syncFederationViewerUrl(projectId, next);
          return next;
        });
        setLoadedModels(engine.getLoadedModels());
        toast.success(`Added ${resolved.name} to federation.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load model.");
      } finally {
        setAddingFileVersionId(null);
      }
    },
    [federationMembers, phase.kind, props.projectId, resolvedProjectId],
  );

  const onRemoveFederationMember = useCallback(
    // fallow-ignore-next-line complexity
    async (fileVersionId: string) => {
      const engine = engineRef.current;
      const projectId = resolvedProjectId ?? props.projectId;
      if (!engine || phase.kind !== "ready" || !projectId) return;

      const member = federationMembers.find((m) => m.fileVersionId === fileVersionId);
      if (!member || federationMembers.length <= 1) return;

      const modelId = buildModelId(member);
      try {
        await engine.removeModel(modelId);
        setFederationMembers((prev) => {
          const next = prev.filter((m) => m.fileVersionId !== fileVersionId);
          syncFederationViewerUrl(projectId, next);
          return next;
        });
        setLoadedModels(engine.getLoadedModels());
        setSelectedGuids((prev) => {
          const index = quantityIndex;
          if (!index) return prev;
          const removedGuids = new Set(
            index.elements
              .filter((el) => el.sourceFileVersionId === fileVersionId)
              .map((el) => el.guid),
          );
          if (removedGuids.size === 0) return prev;
          const next = new Set(prev);
          for (const guid of removedGuids) next.delete(guid);
          return next;
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove model.");
      }
    },
    [federationMembers, phase.kind, props.projectId, quantityIndex, resolvedProjectId],
  );

  useEffect(() => {
    if (!activeFlyout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveFlyout(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeFlyout]);

  const onSelectElementFromSearch = useCallback((guid: string) => {
    setActiveFlyout(null);
    void engineRef.current?.selectByGuids([guid], false).then(() => {
      void engineRef.current?.zoomToSelection();
    });
  }, []);

  const onSelectChartSegment = useCallback((segment: BimChartSegment) => {
    if (segment.guids.length === 0) return;
    void engineRef.current?.selectByGuids(segment.guids, false).then(() => {
      void engineRef.current?.zoomToSelection();
    });
  }, []);

  const closeElementSearch = useCallback(() => {
    setActiveFlyout(null);
  }, []);

  const closeAnalytics = useCallback(() => {
    setActiveFlyout(null);
  }, []);

  const railSections = useMemo(
    // fallow-ignore-next-line complexity
    () => [
      [
        {
          id: "issues",
          label: "Issues",
          icon: CircleAlert,
          badge: issues.length > 0 ? issues.length : undefined,
        },
        {
          id: "clashes",
          label: "Clashes",
          icon: Crosshair,
          badge: clash.openCount > 0 ? clash.openCount : undefined,
        },
        {
          id: "properties",
          label: "Properties",
          icon: TableProperties,
          badge: selectionCount > 0 ? selectionCount : undefined,
        },
        {
          id: "filters",
          label: "Filters",
          icon: Filter,
          badge:
            hasActiveFilter(filterState) || filterState.colorize?.enabled
              ? filterMatches.length
              : undefined,
        },
        { id: "takeoffViews", label: "Takeoff and views", icon: ClipboardList },
      ],
      [
        { id: "objects", label: "Objects", icon: ScanSearch },
        {
          id: "models",
          label: "Models",
          icon: Boxes,
          badge: isFederated ? federationMembers.length : undefined,
        },
        { id: "visibility", label: "Visibility", icon: Eye },
        { id: "quality", label: "Quality", icon: Sparkles },
      ],
    ],
    [
      isFederated,
      issues.length,
      clash.openCount,
      federationMembers.length,
      selectionCount,
      filterState,
      filterMatches.length,
    ],
  );

  const dockMeta: Record<BimDockId, { title: string; subtitle: string }> = {
    objects: { title: "Objects", subtitle: "Browse and search IFC elements" },
    models: { title: "Models", subtitle: "Federation and loaded files" },
    visibility: { title: "Visibility", subtitle: "Levels and disciplines" },
    quality: { title: "Quality", subtitle: "LOQ and viewport appearance" },
    properties: {
      title: "Properties",
      subtitle:
        selectionCount > 0
          ? `${selectionCount} element${selectionCount === 1 ? "" : "s"} selected`
          : "IFC element data",
    },
    filters: {
      title: "Filters",
      subtitle:
        hasActiveFilter(filterState) || filterState.colorize?.enabled
          ? `${filterMatches.length.toLocaleString()} elements`
          : "Search, isolate, and colorize",
    },
    takeoffViews: {
      title: "Takeoff & views",
      subtitle: "Quantities, export, and saved cameras",
    },
    issues: { title: "Issues", subtitle: `${issues.length} on this model` },
    clashes: {
      title: "Clash detection",
      subtitle: clash.activeTest
        ? `${clash.openCount} open · ${clash.activeTest.name}`
        : "Setup sets, run tests, review results",
    },
  };

  const isBrowserDock = (dock: BimDockId): dock is BimLeftDockId =>
    dock === "objects" || dock === "models" || dock === "visibility" || dock === "quality";

  const walkPlanReady = !mappingEditActive && cameraMode === "walk" && phase.kind === "ready";
  const splitViewActive = walkPlanReady && walkPlanSize === "big";
  const miniPlanActive = walkPlanReady && walkPlanSize === "mini";
  const workspaceReady = workspaceActive && phase.kind === "ready";
  const mappingUiReady =
    mappingEditActive && phase.kind === "ready" && Boolean(props.locationId && resolvedProjectId);
  const workChromeReady = phase.kind === "ready" && !mappingEditActive;

  const clashTypeOptionsA = useMemo(
    () => ifcTypeCountsForModel(quantityIndex, modelIdFromSet(clash.setA)),
    [quantityIndex, clash.setA],
  );
  const clashTypeOptionsB = useMemo(
    () => ifcTypeCountsForModel(quantityIndex, modelIdFromSet(clash.setB)),
    [quantityIndex, clash.setB],
  );

  const clashModelNameByFv = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of logicalLoadedModels) {
      const fv = m.modelId.includes(":") ? m.modelId.split(":").pop() : m.modelId;
      if (fv) out[fv] = m.name;
    }
    return out;
  }, [logicalLoadedModels]);

  const clashDockBody =
    workChromeReady && activeDock === "clashes" ? (
      <BimClashDockContent
        test={clash.activeTest}
        tests={clash.tests}
        clashes={clash.clashes}
        selectedClashId={clash.selectedClashId}
        statusFilter={clash.statusFilter}
        typeFilter={clash.typeFilter}
        assigneeMe={clash.assigneeMe}
        grouped={clash.grouped}
        contextMode={clash.contextMode}
        runStats={clash.runStats}
        lastRunTruncated={clash.lastRunTruncated}
        currentUserId={currentUserId}
        creatingIssue={clashIssuePreparing}
        modelNameByFileVersionId={clashModelNameByFv}
        setup={{
          setA: clash.setA,
          setB: clash.setB,
          setACount: clash.setCounts.a,
          setBCount: clash.setCounts.b,
          models: logicalLoadedModels.map((m) => ({
            modelId: m.modelId,
            name: m.name,
            visible: m.visible,
          })),
          typeOptionsA: clashTypeOptionsA,
          typeOptionsB: clashTypeOptionsB,
          levels: clash.levels,
          clearanceEnabled: clash.clearanceEnabled,
          clearanceMm: clash.clearanceMm,
          runMode: clash.runMode,
          running: clash.running,
          progress: clash.progress,
          runAgainstModelIds: clash.runAgainstModelIds,
          onChangeSetA: clash.setSetA,
          onChangeSetB: clash.setSetB,
          onToggleModelVisible: onToggleModelVisible,
          onRunModeChange: clash.setRunMode,
          onClearanceMmChange: clash.setClearanceMm,
          onToggleRunAgainst: clash.toggleRunAgainst,
          onRun: () => void clash.runTest(),
          onCancel: clash.cancelRun,
        }}
        onStatusFilterChange={clash.setStatusFilter}
        onTypeFilterChange={clash.setTypeFilter}
        onSelectTest={(t) => void clash.selectTest(t)}
        onAssigneeMeChange={clash.setAssigneeMe}
        onGroupedChange={clash.setGrouped}
        onContextModeChange={clash.setContextMode}
        onSelectClash={(c) => void clash.focusClash(c)}
        onClashesChange={clash.setClashes}
        onCreateIssue={startIssueCreateFromClash}
        onBulkCreateIssue={startIssueCreateFromClashGroup}
        onDeleteClash={(c) => void clash.deleteClashById(c)}
        onResetResults={() => void clash.resetClashResults()}
        onInspectClashItem={(c, item) => {
          void clash.inspectClashItem(c, item);
          openPropertiesDock("properties");
        }}
      />
    ) : null;

  /** Close the panel only — keep selected clash so Filters → Clashes can restore colors. */
  const closeClashDock = () => {
    setActiveDock(null);
  };
  const workspaceStorey = workspaceLevel
    ? (activeEngine?.resolveStoreyName(workspaceLevel.sourceName) ??
      activeEngine?.resolveStoreyName(workspaceLevel.name) ??
      workspaceLevel.sourceName)
    : null;

  useEffect(() => {
    if (!workChromeReady) return;
    // fallow-ignore-next-line complexity
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      // "?" is Shift+/ on US keyboards; also accept explicit "?".
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }

      // Clash shortcuts stay active while reviewing, even if Properties dock is open.
      if (activeDock !== "clashes" && !clash.selectedClashId) return;
      const list = clash.clashes.filter((c) => clash.filteredIds.has(c.id));
      const idx = list.findIndex((c) => c.id === clash.selectedClashId);

      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = list[idx < 0 || idx >= list.length - 1 ? 0 : idx + 1];
        if (next) void clash.focusClash(next);
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = list[idx <= 0 ? list.length - 1 : idx - 1];
        if (prev) void clash.focusClash(prev);
        return;
      }
      if (e.key === "Escape" && clash.selectedClashId) {
        e.preventDefault();
        void clash.clearFocusMode();
        return;
      }
      const statusMap: Record<string, BimClashStatus> = {
        "1": "NEW",
        "2": "ACTIVE",
        "3": "RESOLVED",
        "4": "IGNORED",
      };
      const status = statusMap[e.key];
      if (status && clash.selectedClash) {
        e.preventDefault();
        void patchClash(clash.selectedClash.id, { status }).then((updated) => {
          clash.setClashes(clash.clashes.map((c) => (c.id === updated.id ? updated : c)));
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workChromeReady, activeDock, clash]);

  return (
    <div ref={shellRef} className="bim-viewer fixed inset-0 z-40 overflow-hidden">
      {mappingUiReady && props.buildingId && props.locationId && resolvedProjectId ? (
        <>
          <aside className="bim-workspace-tree">
            <BimBuildingTreePanel
              projectId={resolvedProjectId}
              locationId={props.locationId}
              buildingId={props.buildingId}
              activeLevelId={workspaceView === "plan" ? (workspaceLevel?.id ?? null) : null}
              onSelectLevel={onSelectWorkspaceLevel}
              onShowModel={onShowWorkspaceModel}
              onMatchDrawing={onMatchDrawing}
              onPreviewDrawing={onPreviewDrawing}
            />
          </aside>

          <button
            type="button"
            className="bim-glass-surface absolute left-3 top-1/2 z-[26] flex -translate-y-1/2 items-center justify-center rounded-full p-2.5 text-[var(--bim-text)] md:hidden"
            aria-label="Open building tree"
            onClick={() => setTreeMobileOpen(true)}
          >
            <TableProperties className="h-5 w-5" aria-hidden />
          </button>

          {treeMobileOpen ? (
            <div className="absolute inset-0 z-[40] md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                aria-label="Close building tree"
                onClick={() => setTreeMobileOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 w-[min(360px,85%)] shadow-xl">
                <BimBuildingTreePanel
                  projectId={resolvedProjectId}
                  locationId={props.locationId}
                  buildingId={props.buildingId}
                  activeLevelId={workspaceView === "plan" ? (workspaceLevel?.id ?? null) : null}
                  onSelectLevel={onSelectWorkspaceLevel}
                  onShowModel={() => {
                    onShowWorkspaceModel();
                    setTreeMobileOpen(false);
                  }}
                  onMatchDrawing={(levelId, assetId) => {
                    onMatchDrawing(levelId, assetId);
                    setTreeMobileOpen(false);
                  }}
                  onPreviewDrawing={onPreviewDrawing}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div
        className={`bim-canvas-full${splitViewActive ? " bim-canvas-full--split" : ""}${mappingUiReady ? " bim-canvas-full--workspace" : ""}`}
      >
        <div
          ref={onViewportRef}
          data-issue-placement={issuePlacementActive ? "true" : undefined}
          className={`touch-none${splitViewActive ? " bim-viewport-pane" : " relative h-full w-full"}${issuePlacementActive ? " bim-viewport--issue-placement" : ""}`}
        >
          {workChromeReady ? (
            <BimMarkupOverlay
              interactive={tool === "markup" && markupHydrated}
              engine={activeEngine}
              container={viewportEl}
            />
          ) : null}

          {workChromeReady && cameraMode === "walk" ? (
            <BimWalkChrome
              onJoystickChange={(forward, strafe) =>
                engineRef.current?.setWalkInput(forward, strafe)
              }
            />
          ) : null}

          {miniPlanActive ? (
            <BimPlanMinimap
              variant="floating"
              engine={activeEngine}
              storeys={planStoreyOptions.map((o) => o.value)}
              storeyOptions={planStoreyOptions}
              selectedStorey={planMinimapStorey}
              onSelectStorey={setPlanMinimapStorey}
              planSize={walkPlanSize}
              onPlanSizeChange={onWalkPlanSizeChange}
            />
          ) : null}
        </div>

        {workspaceReady && workspaceView === "plan" && workspaceLevel && !alignActive ? (
          <BimLevelPlanView
            engine={activeEngine}
            storey={workspaceStorey}
            level={workspaceLevel}
            onShowModel={onShowWorkspaceModel}
          />
        ) : null}

        {mappingUiReady && alignActive ? (
          <div className="bim-workspace-align absolute inset-0 z-[30] overflow-hidden">
            <MatchingWindowClient
              shell="workspace"
              projectId={resolvedProjectId!}
              locationId={props.locationId!}
              buildingId={props.buildingId!}
              levelId={props.alignLevelId!}
              assetId={props.alignAssetId!}
              onSaved={onAlignSaved}
              onCancel={onAlignCancel}
            />
          </div>
        ) : null}

        {mappingUiReady && previewActive && previewAsset ? (
          <UnmappedDrawingPreview
            asset={previewAsset}
            levels={buildingLevels}
            onClose={onPreviewClose}
            onMatchToLevel={(levelId) => onMatchDrawing(levelId, previewAsset.id)}
          />
        ) : null}

        <BimBreadcrumbChip
          onBack={() => router.push(backHref)}
          fileName={props.fileName}
          federatedLabel={
            workChromeReady && isFederated ? `Federated · ${federationMembers.length} models` : null
          }
        />

        {workChromeReady ? (
          <BimIconRail
            side="right"
            sections={railSections}
            activeId={activeDock}
            onSelect={(id) => toggleDock(id as BimDockId)}
            ariaLabel="Viewer panels"
            header={
              <button
                type="button"
                onClick={fitToView}
                aria-label="Fit model to view"
                title="Fit model to view"
                className="bim-rail-btn mobile-touch-target"
              >
                <Home className="h-[18px] w-[18px]" aria-hidden />
              </button>
            }
          />
        ) : null}

        {workChromeReady && activeDock && isBrowserDock(activeDock) ? (
          <BimGlassDock
            side="right"
            open
            title={dockMeta[activeDock].title}
            subtitle={dockMeta[activeDock].subtitle}
            onClose={() => setActiveDock(null)}
          >
            <BimLeftDockContent
              dock={activeDock}
              anchorFileId={props.fileId}
              storeys={storeys}
              categories={categories}
              onToggleGroup={onToggleGroup}
              onShowAll={onShowAll}
              quantityIndex={quantityIndex}
              quantityIndexError={quantityIndexError}
              conversionStatus={conversionStatus}
              selectedGuids={selectedGuids}
              onSelectGuids={onSelectGuids}
              onSelectType={onSelectType}
              loq={loq}
              onRebuildIndex={rebuildIndex}
              appearance={appearance}
              qualityState={qualityState}
              onAppearanceChange={onAppearanceChange}
              projectId={resolvedProjectId}
              federationMembers={federationMembers}
              loadedModels={logicalLoadedModels}
              addingFileVersionId={addingFileVersionId}
              onAddFederationMember={onAddFederationMember}
              onRemoveFederationMember={onRemoveFederationMember}
              onToggleModelVisible={onToggleModelVisible}
            />
          </BimGlassDock>
        ) : null}

        {workChromeReady && activeDock === "properties" ? (
          <BimGlassDock
            side="right"
            open
            title={dockMeta.properties.title}
            subtitle={dockMeta.properties.subtitle}
            closeOnOutsideClick={false}
            onClose={() => setActiveDock(null)}
          >
            <BimInspectDockContent
              key={inspectTab}
              selection={selection}
              selectionCount={selectionCount}
              quantityIndex={quantityIndex}
              fileId={activeFileId}
              fileVersionId={activeFileVersionId}
              projectId={resolvedProjectId}
              onClearSelection={clearSelection}
              quantityRollup={quantityRollup}
              takeoffSelectionSummary={takeoffSelectionSummary}
              initialTab={inspectTab}
              onStartCreateIssue={(anchor) => startIssueCreate({ bimAnchor: anchor })}
              onAddFilterRule={addFilterRuleFromProperty}
            />
          </BimGlassDock>
        ) : null}

        {workChromeReady && activeDock === "filters" ? (
          <BimGlassDock
            side="right"
            open
            title={dockMeta.filters.title}
            subtitle={dockMeta.filters.subtitle}
            onClose={() => setActiveDock(null)}
          >
            <BimFiltersPanel
              index={quantityIndex}
              filterState={filterState}
              onFilterStateChange={setFilterState}
              matchCount={filterMatches.length}
              legend={filterLegend}
              savedViews={savedViews}
              onSaveFilter={() => void saveFilterView()}
              onApplySavedView={(v) => void applySavedView(v)}
              onDeleteSavedView={(id) => void deleteSavedView(id)}
            />
          </BimGlassDock>
        ) : null}

        {workChromeReady && activeDock === "takeoffViews" ? (
          <BimGlassDock
            side="right"
            open
            title={dockMeta.takeoffViews.title}
            subtitle={dockMeta.takeoffViews.subtitle}
            onClose={() => setActiveDock(null)}
          >
            <BimTakeoffViewsDockContent
              fileVersionId={activeFileVersionId}
              projectId={resolvedProjectId}
              selectedGuids={[...selectedGuids]}
              takeoffSelectionSummary={takeoffSelectionSummary}
              resolveModelQuantities={resolveModelQuantities}
              savedViews={savedViews}
              onSaveView={() => void saveCurrentView()}
              onApplyView={(v) => void applySavedView(v)}
              onDeleteView={(id) => void deleteSavedView(id)}
              compareDeltas={compareDeltas}
              markupAnnotations={markupAnnotations}
              markupSelectedIds={markupSelectedIds}
              markupEngine={activeEngine}
              onSelectMarkup={(id) => setMarkupSelectedIds([id])}
            />
          </BimGlassDock>
        ) : null}

        {workChromeReady && activeDock === "issues" ? (
          <BimGlassDock
            side="right"
            open
            title={dockMeta.issues.title}
            subtitle={dockMeta.issues.subtitle}
            onClose={() => {
              setActiveDock(null);
              setIssuePlacementActive(false);
            }}
          >
            <BimIssuesDockContent
              issues={issues}
              selectedIssueId={selectedIssueId}
              onOpenIssue={(issue) => void openIssueDetail(issue, { fly: false })}
              onFocusIssue={(issue) => void focusIssueOnly(issue)}
              onStartPlacement={armIssuePlacement}
              onStartCreateOnSelection={startIssueCreateFromSelection}
              hasSelection={selectionCount > 0}
            />
          </BimGlassDock>
        ) : null}

        {clashDockBody && isNarrowViewport ? (
          <EnterpriseBottomSheet
            open
            onClose={closeClashDock}
            ariaLabel="Clash detection"
            variant="viewer-dark"
            maxHeightClass="max-h-[min(78dvh,720px)]"
            bodyScroll={false}
            bodyClassName="p-0"
          >
            {clashDockBody}
          </EnterpriseBottomSheet>
        ) : null}

        {clashDockBody && !isNarrowViewport ? (
          <BimGlassDock
            side="right"
            open
            title={dockMeta.clashes.title}
            subtitle={dockMeta.clashes.subtitle}
            closeOnOutsideClick={false}
            onClose={closeClashDock}
          >
            {clashDockBody}
          </BimGlassDock>
        ) : null}

        {workChromeReady ? (
          <BimIssueMarkersOverlay
            engine={activeEngine}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
            onFocusIssue={(issue) => void focusIssueOnly(issue)}
            onOpenDetails={onMarkerOpenDetails}
            onLocateAsset={onMarkerLocateAsset}
            onOpenDocuments={onMarkerOpenDocuments}
            onAddComment={onMarkerAddComment}
            onResolveIssue={onMarkerResolveIssue}
          />
        ) : null}

        {issuePlacementActive && workChromeReady ? (
          <div className="bim-placement-hint bim-glass-surface pointer-events-none absolute left-1/2 z-[8] -translate-x-1/2 rounded-full px-4 py-2 text-[11px] font-medium text-[var(--bim-text)]">
            Tap or click the model to place an issue · Esc to cancel
          </div>
        ) : null}

        {workChromeReady && contextMenu ? (
          <BimContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSelection={contextMenu.hasSelection}
            canCreateAsset={canCreateOmAsset}
            linkedAssetTag={linkedAssetForSelection?.tag ?? null}
            onAction={onContextAction}
            onClose={() => setContextMenu(null)}
          />
        ) : null}

        {showLoadOverlay ? (
          <BimLoadingOverlay
            phase={lastLoadPhaseRef.current}
            fileVersionId={resolvedFileVersionId ?? props.fileVersionId}
            modelName={props.fileName}
            version={props.version}
            previewUrl={loadPreviewUrl}
            exiting={loadExiting}
            path={loadPath}
          />
        ) : null}

        {phase.kind === "error" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--bim-shell)]">
            <p className="text-[14px] font-medium text-[var(--bim-text)]">
              Could not open this model
            </p>
            <p className="max-w-sm text-center text-[12px] text-[var(--bim-text-muted)]">
              {phase.message}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPhase({ kind: "resolving" });
                  setLoadRetryNonce((n) => n + 1);
                }}
                className="bim-focus-ring rounded-md bg-[var(--bim-accent)] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[var(--bim-accent-hover)]"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="bim-focus-ring rounded-md border border-[var(--bim-border)] bg-transparent px-4 py-2 text-[13px] font-medium text-[var(--bim-text)] transition-colors duration-150 hover:bg-[var(--bim-panel)]"
              >
                Back to files
              </button>
            </div>
          </div>
        ) : null}

        {geometryStream && geometryStreamPct != null && phase.kind === "ready" ? (
          <div
            className="pointer-events-none absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-[var(--bim-border)] bg-[var(--bim-panel)]/95 px-3 py-2 shadow-sm backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-label={`Loading remaining geometry ${geometryStreamPct}%`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--bim-text-muted)]">
              <span className="min-w-0 truncate">
                {geometryStream.total > 1
                  ? `Loading model ${geometryStream.index + 1} of ${geometryStream.total}`
                  : "Loading remaining geometry"}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--bim-text)]">
                {geometryStreamPct}%
              </span>
            </div>
            <div className="bim-loading-progress__track">
              <div
                className="bim-loading-progress__fill"
                style={{ width: `${geometryStreamPct}%` }}
              />
            </div>
          </div>
        ) : null}

        {workChromeReady ? (
          <BimBottomToolBar
            tool={tool}
            cameraMode={cameraMode}
            activeFlyout={activeFlyout}
            fullscreen={fullscreen}
            toolHint={hint}
            showPlacePoint={toolNeedsPoint}
            quantityIndex={quantityIndex}
            conversionStatus={conversionStatus}
            selectedGuids={selectedGuids}
            onSelectTool={selectTool}
            onSelectCameraMode={selectCameraMode}
            onToggleFlyout={toggleFlyout}
            onFitToView={fitToView}
            onShowAll={onShowAll}
            onToggleProjection={() => {
              setActiveFlyout(null);
              void engineRef.current?.toggleProjection();
            }}
            onClearMarkups={clearMarkups}
            onSnapshot={captureSnapshot}
            onToggleFullscreen={toggleFullscreen}
            onPlacePoint={() => engineRef.current?.measureConfirmPoint()}
            walkPlanSize={walkPlanSize}
            onToggleWalkPlan={onToggleWalkPlan}
            clusterByType={clusterByType}
            onToggleClusterByType={onToggleClusterByType}
            onSelectElement={onSelectElementFromSearch}
            onSelectChartSegment={onSelectChartSegment}
            onCloseSearch={closeElementSearch}
            onCloseAnalytics={closeAnalytics}
            markupShape={markupShape}
            markupMode={markupMode}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            markupSelectionCount={markupSelectedIds.length}
            onSetMarkupShape={setMarkupShape}
            onSetMarkupMode={setMarkupMode}
            onSetStrokeColor={setStrokeColor}
            onSetStrokeWidth={setStrokeWidth}
            onDeleteSelectedMarkups={deleteSelectedMarkups}
            onCreateIssueFromMarkup={onCreateIssueFromMarkup}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        ) : null}

        {workChromeReady ? (
          <BimShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        ) : null}

        {workChromeReady && assetCreateDraft && resolvedFileVersionId && resolvedProjectId ? (
          <BimAssetFormSlider
            mode="create"
            open
            projectId={resolvedProjectId}
            fileId={props.fileId}
            fileVersionId={resolvedFileVersionId}
            modelName={props.fileName}
            bimAnchor={assetCreateDraft.bimAnchor}
            initialDraft={assetCreateDraft.initialDraft}
            pendingPhoto={assetCreateDraft.pendingPhoto}
            onClose={() => setAssetCreateDraft(null)}
            onCreated={(asset) => {
              setAssetCreateDraft(null);
              setFocusedOmAsset(asset);
              void refetchOmAssets();
            }}
          />
        ) : null}

        {workChromeReady && editingOmAsset && resolvedProjectId ? (
          <BimAssetFormSlider
            mode="edit"
            open
            projectId={resolvedProjectId}
            modelName={props.fileName}
            asset={editingOmAsset}
            onClose={() => {
              setFocusedOmAsset(editingOmAsset);
              setEditingOmAsset(null);
            }}
            onSaved={(asset) => {
              setEditingOmAsset(null);
              setFocusedOmAsset(asset);
              void refetchOmAssets();
            }}
          />
        ) : null}

        {workChromeReady &&
        focusedOmAsset &&
        resolvedProjectId &&
        !assetCreateDraft &&
        !editingOmAsset &&
        !issueCreateDraft &&
        !editIssue ? (
          <BimAssetInfoPanel
            asset={focusedOmAsset}
            projectId={resolvedProjectId}
            modelName={props.fileName}
            onClose={() => setFocusedOmAsset(null)}
            onEdit={canCreateOmAsset ? () => startAssetEdit(focusedOmAsset) : undefined}
          />
        ) : null}

        {workChromeReady && issueCreateDraft && resolvedFileVersionId && resolvedProjectId ? (
          <BimGlassDock
            side="right"
            open
            title={projectSession?.operationsMode ? "New work order" : "New issue"}
            subtitle={
              issueCreateDraft.bimAnchor?.name ||
              issueCreateDraft.bimAnchor?.ifcType ||
              props.fileName
            }
            onClose={() => setIssueCreateDraft(null)}
            closeOnOutsideClick={false}
          >
            <IssueFormSlider
              variant="create"
              open
              annotationId={null}
              layout="docked"
              embedded
              bimContext={{
                // Clash issues prefer set-A's model so reopen loads the right primary + partner.
                fileId:
                  issueCreateDraft.bimAnchor?.fileId && issueCreateDraft.bimAnchor?.fileVersionId
                    ? issueCreateDraft.bimAnchor.fileId
                    : props.fileId,
                fileVersionId:
                  issueCreateDraft.bimAnchor?.fileId && issueCreateDraft.bimAnchor?.fileVersionId
                    ? issueCreateDraft.bimAnchor.fileVersionId
                    : resolvedFileVersionId,
                projectId: resolvedProjectId,
                bimAnchor: issueCreateDraft.bimAnchor,
                modelName: issueCreateDraft.bimAnchor?.modelFileName ?? props.fileName,
              }}
              initialLinkedMarkupIds={issueCreateDraft.initialLinkedMarkupIds}
              pendingReferencePhoto={issueCreateDraft.pendingReferencePhoto}
              initialTitle={issueCreateDraft.initialTitle}
              initialDescription={issueCreateDraft.initialDescription}
              initialPriority={issueCreateDraft.initialPriority}
              onClose={() => setIssueCreateDraft(null)}
              onCreated={(issue) => {
                const markupIds = issueCreateDraft.initialLinkedMarkupIds ?? [];
                if (markupIds.length > 0) {
                  linkMarkupsToIssue(markupIds, {
                    id: issue.id,
                    title: issue.title,
                    status: issue.status,
                  });
                  scheduleBimMarkupPersist();
                }
                const clashIds = issueCreateDraft.sourceClashIds ?? [];
                if (clashIds.length > 0) {
                  void linkClashesToIssue(clashIds, issue.id).catch((err) => {
                    toast.error(
                      err instanceof Error ? err.message : "Issue created but could not link clash",
                    );
                  });
                }
                setIssueCreateDraft(null);
                setSelectedIssueId(issue.id);
                setActiveDock("issues");
                setEditIssue(issue);
                reloadIssues();
              }}
            />
          </BimGlassDock>
        ) : null}

        {workChromeReady && editIssue ? (
          <BimGlassDock
            side="right"
            open
            title={projectSession?.operationsMode ? "Edit work order" : "Edit issue"}
            subtitle={editIssue.title}
            onClose={() => {
              setEditIssue(null);
              reloadIssues();
            }}
            closeOnOutsideClick={false}
          >
            <IssueFormSlider
              variant="edit"
              open
              issue={editIssue}
              layout="docked"
              embedded
              bimContext={
                resolvedFileVersionId && resolvedProjectId
                  ? {
                      fileId: editIssue.fileId ?? props.fileId,
                      fileVersionId: editIssue.fileVersionId ?? resolvedFileVersionId,
                      projectId: resolvedProjectId,
                    }
                  : undefined
              }
              onClose={() => {
                setEditIssue(null);
                reloadIssues();
              }}
            />
          </BimGlassDock>
        ) : null}

        {splitViewActive ? (
          <BimSplitViewPane
            planPanelMode={planPanelMode}
            onPlanPanelModeChange={setPlanPanelMode}
            canDrawingSync={canDrawingSync}
            engine={activeEngine}
            storeys={planStoreyOptions.map((o) => o.value)}
            storeyOptions={planStoreyOptions}
            planMinimapStorey={planMinimapStorey}
            onSelectStorey={setPlanMinimapStorey}
            syncContext={effectiveSyncContext}
            activeLevelMap={activeLevelMap}
            drawingTransform={effectiveCoordTransform}
            onAlign={() => {
              setAlignMap(activeLevelMap);
              setAlignOpen(true);
            }}
            hasDrawingMaps={drawingMaps.length > 0}
            walkPlanSize={walkPlanSize}
            onWalkPlanSizeChange={onWalkPlanSizeChange}
          />
        ) : null}

        {workChromeReady && alignOpen && alignMap && activeEngine && resolvedFileVersionId ? (
          <AlignCoordinatesPanel
            open={alignOpen}
            onClose={() => setAlignOpen(false)}
            engine={activeEngine}
            map={alignMap}
            ifcFileVersionId={resolvedFileVersionId}
            onSaved={() => {
              const fvId = resolvedFileVersionId;
              const projectId = resolvedProjectId;
              if (fvId && projectId) {
                void fetchDrawingLevelMaps(projectId, fvId)
                  .then((data) => setDrawingMaps(data.maps))
                  .catch(() => undefined);
              }
            }}
          />
        ) : null}
      </div>

      <BimIssueCommentDialog
        open={Boolean(commentDialogIssue)}
        issue={commentDialogIssue}
        onClose={() => setCommentDialogIssue(null)}
        onCommentAdded={onIssueCommentAdded}
      />
    </div>
  );
}
