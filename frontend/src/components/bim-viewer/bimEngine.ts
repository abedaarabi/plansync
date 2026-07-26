import type { BimElementQuantities, BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";
import {
  mergeElementQuantities,
  parseQuantitiesFromPropertyRows,
  rollupBimQuantities,
  type BimModelQuantityRollup,
} from "@/lib/bim/modelQuantity";
import { compositeIssuePlacementSnapshot } from "@/lib/bim/bimIssueSnapshot";
import {
  applyRenderOrderToModel,
  applySpaceDisplayToModelMeshes,
  buildMaterialItemContext,
  buildSpaceItemIds,
  buildSpaceMaterialIds,
  BimRenderTier,
  replaceMaterialReferences,
  resolveElementColor,
  resolveSpaceColor,
  upgradeLambertToStandard,
} from "@/lib/bim/materialColor";
import { COLORIZE_HIGHLIGHT_OPACITY } from "@/lib/bim/colorizePalette";
import {
  BIM_ACCENT,
  BIM_SELECTION,
  BIM_SPACE_MATERIAL,
  BIM_VIEWPORT,
  configureLod500Importer,
  createBimSkyTexture,
  fogDistanceScales,
  getViewportColors,
  resolveFogColor,
} from "@/lib/bim/renderingProfile";
import {
  DEFAULT_BIM_VIEWPORT_APPEARANCE,
  mergeViewportAppearance,
  type BimViewportAppearance,
} from "@/lib/bim/viewportAppearance";
import { buildModelId, type BimFederationMember } from "@/lib/bim/federation";
import { bimViewportPixelRatio } from "@/lib/bim/viewportPixelRatio";
import { ROTATE_SENSITIVITY, ViewCubeOverlay } from "@/lib/bim/viewCube";
import type { PlanMinimapBounds, PlanMinimapPose, PlanMinimapState } from "@/lib/bim/planMinimap";
import {
  bakePlanFromSlice,
  boundsFromBox3,
  filterPlanCategories,
  PLAN_GEOMETRY_ITEM_CAP,
} from "@/lib/bim/planMinimapSlice";
import {
  applyTransformOffsets,
  backupGlobalTransforms,
  computeClusterCameraPose,
  computeTightClusterOffsets,
  mapItemsToTransformIds,
  restoreGlobalTransforms,
  shouldClusterType,
  type ClusterCategoryPack,
  type ClusterPackUnit,
  type ClusterTransformBackup,
  type ClusterTypeLabel,
} from "@/lib/bim/clusterByType";
import {
  hideClipPlaneFace,
  SectionBoxController,
} from "@/components/bim-viewer/sectionBoxController";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";

/** Served from `public/bim/` — see docs/bim-viewer.md for how to update. */
const WEB_IFC_WASM_PATH = "/bim/";
const FRAGMENTS_WORKER_URL = "/bim/fragments-worker.mjs";

/** Minimum canvas size before we trust a resize (avoids 0×0 WebGL init). */
const MIN_CANVAS_PX = 2;
/** Ignore tiny hand jitter when distinguishing click vs drag. */
const POINTER_CLICK_THRESHOLD_PX = 8;
/** Forward collision distance for walk mode (metres). */
const WALK_COLLISION_DISTANCE = 0.9;
const WALK_SPEED = 2.4; // m/s
const WALK_COLLISION_POLL_MS = 120;
/** Light engineering viewport — matches `--bim-canvas-*` tokens. */
const VIEWPORT_BG = BIM_VIEWPORT.container;
/** App accent — markup tools and element selection. */
const MARKUP_ACCENT = BIM_ACCENT;
const SELECTION_ACCENT = BIM_SELECTION.fill;
const HOVER_ACCENT = BIM_SELECTION.hover;

/** camera-controls ACTION.* (orbit tool navigation). */
const CAM_NONE = 0;
const CAM_ROTATE = 1;
const CAM_TRUCK = 2;
const CAM_DOLLY = 16;
const CAM_TOUCH_ROTATE = 64;
const CAM_TOUCH_DOLLY_TRUCK = 4096;

export type BimTool = "select" | "clip" | "length" | "area" | "angle" | "markup";
export type BimCameraMode = "orbit" | "walk";

export type BimSelection = {
  modelId: string;
  fileVersionId: string | null;
  sourceLabel: string | null;
  localId: number;
  ifcGuid: string | null;
  name: string | null;
  ifcType: string | null;
  storey: string | null;
  position: { x: number; y: number; z: number } | null;
  attributes: { label: string; value: string }[];
  psets: { name: string; props: { label: string; value: string }[] }[];
  /** True while property sets are still loading in the background. */
  detailsPending?: boolean;
  /** Multi-select: all selected elements. */
  items?: {
    modelId: string;
    localId: number;
    ifcGuid: string | null;
    name?: string | null;
    ifcType?: string | null;
  }[];
  count?: number;
};

export type BimVisibilityGroup = { name: string; visible: boolean };

export type BimLoadedModel = BimFederationMember & {
  modelId: string;
  visible: boolean;
};

function modelLocalKey(modelId: string, localId: number): string {
  return `${modelId}:${localId}`;
}

export type BimEngineEvents = {
  onSelection: (sel: BimSelection | null) => void;
  onGroupsChanged: (groups: {
    storeys: BimVisibilityGroup[];
    categories: BimVisibilityGroup[];
  }) => void;
  /** Cursor position in model space (metres), when available. */
  onCursorPosition?: (pos: { x: number; y: number; z: number } | null) => void;
  onMultiSelection?: (guids: string[]) => void;
  onContextMenu?: (pos: { x: number; y: number; hasSelection: boolean }) => void;
  onToolChange?: (tool: BimTool) => void;
};

const STOREY_CLASSIFICATION = "PlanSyncLevels";
const CATEGORY_CLASSIFICATION = "PlanSyncCategories";

// fallow-ignore-next-line complexity
function formatAttrValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") {
    const s = String(value).trim();
    return s === "" ? null : s;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) return formatAttrValue(obj.value);
    if ("wrappedValue" in obj) return formatAttrValue(obj.wrappedValue);
    if ("Name" in obj && typeof obj.Name === "string") return obj.Name;
  }
  return null;
}

function attrValue(item: FRAGS.ItemData, key: string): string | null {
  const raw = item[key];
  if (!raw || Array.isArray(raw)) return null;
  return formatAttrValue((raw as FRAGS.ItemAttribute).value);
}

function isItemDataArray(
  v: FRAGS.ItemAttribute | FRAGS.ItemData[] | undefined,
): v is FRAGS.ItemData[] {
  return Array.isArray(v);
}

/** Flattens direct (non-relation) attributes of an item into label/value rows. */
// fallow-ignore-next-line complexity
function flattenAttributes(item: FRAGS.ItemData): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const [key, v] of Object.entries(item)) {
    if (Array.isArray(v)) continue;
    const value = (v as FRAGS.ItemAttribute).value;
    if (value == null || typeof value === "object") continue;
    const s = String(value).trim();
    if (s === "") continue;
    rows.push({ label: key, value: s });
  }
  return rows;
}

/** Extracts IFC property sets from an item's IsDefinedBy relations. */
// fallow-ignore-next-line complexity
function extractPsets(
  item: FRAGS.ItemData,
): { name: string; props: { label: string; value: string }[] }[] {
  const rel = item.IsDefinedBy;
  if (!isItemDataArray(rel)) return [];
  const out: { name: string; props: { label: string; value: string }[] }[] = [];
  for (const pset of rel) {
    const name = attrValue(pset, "Name") ?? "Property set";
    const props: { label: string; value: string }[] = [];
    const hasProps = pset.HasProperties;
    if (isItemDataArray(hasProps)) {
      for (const p of hasProps) {
        const label = attrValue(p, "Name");
        const value =
          attrValue(p, "NominalValue") ??
          attrValue(p, "Value") ??
          attrValue(p, "EnumerationValues");
        if (label && value != null) props.push({ label, value });
      }
    }
    // Quantity sets (IfcElementQuantity → Quantities)
    const quantities = pset.Quantities;
    if (isItemDataArray(quantities)) {
      for (const q of quantities) {
        const label = attrValue(q, "Name");
        const value =
          attrValue(q, "LengthValue") ??
          attrValue(q, "AreaValue") ??
          attrValue(q, "VolumeValue") ??
          attrValue(q, "CountValue") ??
          attrValue(q, "WeightValue");
        if (label && value != null) props.push({ label, value });
      }
    }
    if (props.length > 0) out.push({ name, props });
  }
  return out;
}

export class BimEngine {
  private components: OBC.Components | null = null;
  private world: OBC.SimpleWorld<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBF.RendererWith2D
  > | null = null;
  private container: HTMLElement | null = null;
  private model: FRAGS.FragmentsModel | null = null;
  private events: BimEngineEvents;

  private tool: BimTool = "select";
  private cameraMode: BimCameraMode = "orbit";

  /** name → ModelIdMap resolved once after classification. */
  private storeyMaps = new Map<string, OBC.ModelIdMap>();
  private categoryMaps = new Map<string, OBC.ModelIdMap>();
  private storeyVisible = new Map<string, boolean>();
  private categoryVisible = new Map<string, boolean>();
  /** localId → storey name, keyed by `${modelId}:${localId}`. */
  private storeyByModelLocalId = new Map<string, string>();

  private modelRegistry = new Map<
    string,
    BimFederationMember & { model: FRAGS.FragmentsModel; visible: boolean }
  >();
  private guidIndex = new Map<
    string,
    { modelId: string; localId: number; fileVersionId: string; sourceLabel: string }
  >();

  private walkKeys = new Set<string>();
  private walkJoystick = { forward: 0, strafe: 0 };
  private walkRaf: number | null = null;
  private walkLastTime = 0;
  private walkBlockedUntilDistance: number | null = null;
  private walkLastCollisionPoll = 0;
  private resizeObserver: ResizeObserver | null = null;
  private pointerDown = { x: 0, y: 0 };
  private pointerMoved = false;
  private disposed = false;
  private rimLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private viewportBackground: THREE.Texture | null = null;
  private appearance: BimViewportAppearance = { ...DEFAULT_BIM_VIEWPORT_APPEARANCE };
  /** Cancels stale property loads when the user clicks another element quickly. */
  private selectionLoadId = 0;
  private quantityIndex: BimQuantityIndex | null = null;
  private selectedGuids = new Set<string>();
  private issueAnchors: {
    ifcGuid?: string;
    localId?: number;
    fileVersionId?: string | null;
    position?: { x: number; y: number; z: number };
  }[] = [];
  private issueWorldByGuid = new Map<string, THREE.Vector3>();
  private issueAnchorRefreshTimer: number | null = null;
  private issueAnchorRefreshInFlight = false;
  private materialSyncTimer: number | null = null;
  private lastAtmosphereRefresh = 0;
  /** When set, the next click on the model invokes this instead of changing selection. */
  private issuePlacementPick: ((normX: number, normY: number) => void) | null = null;
  private xRayActive = false;
  private lastClickTime = 0;
  private modelId = "";
  private primaryModelId = "";
  private viewCube: ViewCubeOverlay | null = null;
  private onViewportOverlayAfterUpdate: (() => void) | null = null;
  /** Fallback when GUID is not in the quantity index yet. */
  private lastPickMap: OBC.ModelIdMap | null = null;
  /** Model id from the most recent click pick (for properties panel in federations). */
  private lastPickedModelId: string | null = null;
  private static readonly GUID_SYNC_CHUNK = 1000;
  private contextMenuPickPromise: Promise<boolean> | null = null;
  private sectionBox: SectionBoxController | null = null;
  /** Active colorize highlighter style ids (filter visualization). */
  private colorizeStyleIds: string[] = [];
  private static readonly FILTER_GHOST_STYLE = "filter:ghost";
  /** Persisted filter highlight state so material sync / plan bake can restore tints. */
  private activeFilterGhostMap: OBC.ModelIdMap | null = null;
  private activeFilterGhostOpacity = 0.18;
  private activeColorizeGroups: { styleId: string; color: string; map: OBC.ModelIdMap }[] = [];
  private materialSyncInProgress = false;
  /** Serialize fragment highlight paints — parallel reset/highlight races wipe tints. */
  private highlightPaintInFlight: Promise<void> | null = null;
  private highlightPaintQueued = false;
  /** Material sync deferred while selection/filter overlays are active. */
  private pendingMaterialSync = false;
  private planSilhouette: ImageBitmap | null = null;
  private planSilhouetteDirty = true;
  private planSilhouetteBaking = false;
  private planSilhouetteBakeTimer: number | null = null;
  /** When set, the minimap silhouette bakes only this IFC storey. */
  private planMinimapStorey: string | null = null;
  private planMinimapBoundsCache: PlanMinimapBounds | null = null;
  private planMinimapStoreyFloorY: number | null = null;
  /** Autodesk-style visual clusters (elements grouped by IFC type). */
  private clusterByTypeActive = false;
  private clusterTransformBackup: ClusterTransformBackup = new Map();
  private clusterLabelRoot: THREE.Group | null = null;

  constructor(events: BimEngineEvents) {
    this.events = events;
  }

  isClusterByTypeActive(): boolean {
    return this.clusterByTypeActive;
  }

  getLoadedModels(): BimLoadedModel[] {
    return [...this.modelRegistry.entries()].map(([modelId, entry]) => ({
      modelId,
      fileId: entry.fileId,
      fileVersionId: entry.fileVersionId,
      version: entry.version ?? null,
      name: entry.name,
      visible: entry.visible,
    }));
  }

  // fallow-ignore-next-line unused-class-member
  async setModelVisible(modelId: string, visible: boolean): Promise<void> {
    const entry = this.modelRegistry.get(modelId);
    if (!entry) return;
    entry.visible = visible;
    entry.model.object.visible = visible;
    await this.mustComponents().get(OBC.FragmentsManager).core.update(true);
    this.invalidatePlanSilhouette();
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  async removeModel(modelId: string): Promise<void> {
    if (modelId === this.primaryModelId) {
      throw new Error("Cannot remove the primary model.");
    }
    const entry = this.modelRegistry.get(modelId);
    if (!entry) return;

    if (this.clusterByTypeActive) {
      await this.clearClusterByType();
    }
    this.clearSelection();
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const model = fragments.list.get(modelId) ?? entry.model;

    try {
      await model.dispose();
    } catch {
      /* ignore */
    }
    fragments.list.delete(modelId);

    const world = this.world;
    if (world?.scene.three && model.object.parent === world.scene.three) {
      world.scene.three.remove(model.object);
    }

    this.modelRegistry.delete(modelId);
    await this.buildClassifications();
    await fragments.core.update(true);
    this.applyViewportAtmosphere(this.getModelBoundingSphere());
    this.invalidatePlanSilhouette();
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  async setViewportAppearance(patch: Partial<BimViewportAppearance>): Promise<void> {
    this.appearance = mergeViewportAppearance(this.appearance, patch);
    this.applySkyEnvironment();
    const needsMaterials = patch.colorMode != null || patch.spaceDisplay != null;
    if (needsMaterials) await this.syncViewportMaterials();
    this.applyViewportAtmosphere(this.getModelBoundingSphere());
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (fragments?.initialized) await fragments.core.update(true);
    this.bumpRender();
  }

  /** Re-sync renderer dimensions to the container — call after layout changes. */
  // fallow-ignore-next-line complexity
  resizeViewport(): void {
    if (this.disposed) return;
    const world = this.world;
    const container = this.container;
    if (!world?.renderer || !container) return;
    this.syncRendererSize(world.renderer);
  }

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const components = new OBC.Components();
    this.components = components;

    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.RendererWith2D>();
    this.world = world;

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBF.RendererWith2D(components, container, {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    world.camera = new OBC.OrthoPerspectiveCamera(components);
    this.configureRendererContainer(world.renderer, container);

    components.init();

    const sky = getViewportColors(this.appearance.environment);
    world.scene.setup({
      backgroundColor: new THREE.Color(sky.bgHaze),
      directionalLight: {
        color: new THREE.Color(sky.sun),
        intensity: sky.sunIntensity,
        position: new THREE.Vector3(48, 88, 42),
      },
      ambientLight: { color: new THREE.Color(sky.ambient), intensity: sky.ambientIntensity },
    });
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(sky.hemiSky),
      new THREE.Color(sky.hemiGround),
      sky.hemiIntensity,
    );
    world.scene.three.add(hemi);
    this.hemiLight = hemi;
    this.rimLight = new THREE.DirectionalLight(new THREE.Color(sky.rim), sky.rimIntensity);
    this.rimLight.position.set(-38, 52, -52);
    world.scene.three.add(this.rimLight);

    const renderer = world.renderer.three;
    renderer.setPixelRatio(bimViewportPixelRatio());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = sky.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const grids = components.get(OBC.Grids);
    const grid = grids.create(world);
    grid.config.color = new THREE.Color(sky.grid);
    grid.config.distance = 650;

    // Fragments engine — worker served from public/ (same-origin, offline-safe).
    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(FRAGMENTS_WORKER_URL);
    world.camera.controls.addEventListener("rest", () => {
      fragments.core.update(true);
      this.applyViewportAtmosphere(this.getModelBoundingSphere());
      void this.refreshIssueAnchorWorld();
    });
    world.camera.controls.addEventListener("update", () => {
      fragments.core.update();
      this.scheduleIssueAnchorRefresh();
      this.refreshAtmosphereIfNeeded();
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      this.attachModel(model);
    });

    // fallow-ignore-next-line complexity
    fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
      if (this.materialSyncInProgress) return;
      if (!("isLodMaterial" in material && material.isLodMaterial)) {
        material.polygonOffset = true;
        material.polygonOffsetUnits = 1;
        material.polygonOffsetFactor = Math.random();
        if ("side" in material) {
          material.side = THREE.DoubleSide;
        }
        if ("fog" in material) {
          material.fog = true;
        }
        this.scheduleMaterialSync();
      }
    });

    // Raycaster (required for section + measure tools).
    components.get(OBC.Raycasters).get(world);
    this.setupMarkupTools(world);
    this.setupViewportOverlays(container, world);
    this.applyBim360Navigation();

    // Selection highlighting (single select) — click picking is handled in
    // onCanvasPointerUp so we always raycast from the actual pointer coords.
    const highlighter = components.get(OBF.Highlighter);
    highlighter.setup({
      world,
      autoHighlightOnClick: false,
      autoUpdateFragments: false,
      selectMaterialDefinition: {
        color: new THREE.Color(SELECTION_ACCENT),
        opacity: BIM_SELECTION.fillOpacity,
        transparent: true,
        renderedFaces: 0,
        depthTest: true,
        depthWrite: false,
      },
    });
    highlighter.events.select.onHighlight.add((map) => {
      void this.handleHighlight(map);
    });
    highlighter.events.select.onClear.add(() => {
      // Fragment repaints reset the highlighter style map; keep shell selection
      // while selectedGuids / lastPickMap still represent an active pick.
      if (this.hasActiveSelectionHighlight()) return;
      this.events.onSelection(null);
    });
    this.installFilterHighlightGuard(highlighter);

    const hoverer = components.get(OBF.Hoverer);
    hoverer.world = world;
    hoverer.fade = false;
    hoverer.mode = OBF.HovererMode.MOUSE_MOVE;
    hoverer.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(HOVER_ACCENT),
      transparent: true,
      opacity: BIM_SELECTION.hoverOpacity,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    hoverer.enabled = false;

    // Clipper + measurements — configured in setupMarkupTools; clicks handled below.
    const clipper = components.get(OBC.Clipper);
    clipper.enabled = false;

    for (const m of [
      components.get(OBF.LengthMeasurement),
      components.get(OBF.AreaMeasurement),
      components.get(OBF.AngleMeasurement),
    ]) {
      m.world = world;
      m.enabled = false;
    }

    // Listen on the renderer container (not just the canvas) so clicks are
    // picked up reliably alongside camera-controls and measurement tools.
    container.addEventListener("pointerdown", this.onCanvasPointerDown, { passive: true });
    container.addEventListener("pointermove", this.onCanvasPointerMove, { passive: true });
    container.addEventListener("pointerup", this.onCanvasPointerUp);
    container.addEventListener("contextmenu", this.onCanvasContextMenu, { capture: true });
    window.addEventListener("keydown", this.onGlobalKeyDown);

    // Walk-mode keyboard state.
    window.addEventListener("keydown", this.onWalkKeyDown);
    window.addEventListener("keyup", this.onWalkKeyUp);
  }

  /**
   * Loads a Fragments buffer and registers it as a federation member.
   */
  async addFragments(
    buffer: ArrayBuffer,
    member: BimFederationMember,
    opts?: { fitView?: boolean },
  ): Promise<void> {
    const modelId = buildModelId(member);
    if (this.modelRegistry.has(modelId)) return;
    await this.prepareFederationLoad();
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const model = await fragments.core.load(buffer, { modelId });
    this.registerModel(model, member);
    await this.afterModelAdded(opts?.fitView ?? false);
  }

  /**
   * Converts raw IFC bytes client-side (web-ifc WASM) and loads the result.
   * Returns the Fragments buffer so the caller can cache it in IndexedDB.
   */
  // fallow-ignore-next-line complexity
  async addIfc(
    bytes: Uint8Array,
    member: BimFederationMember,
    opts?: { fitView?: boolean; onProgress?: (fraction: number) => void },
  ): Promise<ArrayBuffer> {
    const modelId = buildModelId(member);
    if (this.modelRegistry.has(modelId)) {
      const existing = this.modelRegistry.get(modelId);
      return existing ? existing.model.getBuffer(false) : new ArrayBuffer(0);
    }
    await this.prepareFederationLoad();
    const components = this.mustComponents();
    const ifcLoader = components.get(OBC.IfcLoader);
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: { path: WEB_IFC_WASM_PATH, absolute: true },
    });
    const model = await ifcLoader.load(bytes, true, modelId, {
      instanceCallback: configureLod500Importer,
      processData: {
        progressCallback: (progress: number) => opts?.onProgress?.(progress),
      },
    });
    this.registerModel(model, member);
    const buffer = await model.getBuffer(false);
    await this.afterModelAdded(opts?.fitView ?? false);
    return buffer;
  }

  /**
   * Align federated IFC models to a shared site origin. The first loaded model
   * defines the base; each subsequent model is translated to match it.
   */
  private async prepareFederationLoad(): Promise<void> {
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    fragments.core.settings.autoCoordinate = true;
    if (this.modelRegistry.size === 0 || fragments.core.baseCoordinates !== null) return;
    const primary = this.modelRegistry.get(this.primaryModelId);
    if (!primary) return;
    fragments.core.baseCoordinates = await primary.model.getCoordinates();
  }

  private registerModel(model: FRAGS.FragmentsModel, member: BimFederationMember): void {
    const modelId = buildModelId(member);
    this.modelRegistry.set(modelId, { ...member, model, visible: true });
    if (!this.primaryModelId) {
      this.primaryModelId = modelId;
    }
    this.modelId = this.primaryModelId;
    this.model = this.modelRegistry.get(this.primaryModelId)?.model ?? model;
  }

  // fallow-ignore-next-line complexity
  private async afterModelAdded(fitView: boolean): Promise<void> {
    if (this.clusterByTypeActive) {
      await this.clearClusterByType();
    }
    const world = this.mustWorld();
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    for (const entry of this.modelRegistry.values()) {
      this.attachModel(entry.model);
      entry.model.object.visible = entry.visible;
    }
    await fragments.core.update(true);
    await this.waitForCanvasSize();
    this.syncRendererSize(world.renderer!);
    await this.applyLod500RuntimeSettings();
    await this.buildClassifications();
    await this.syncViewportMaterials();
    this.applySkyEnvironment();
    if (fitView) await this.fitToView();
    this.applyViewportAtmosphere(this.getModelBoundingSphere());
    if (fitView) {
      requestAnimationFrame(() => {
        this.syncRendererSize(world.renderer!);
        void this.fitToView();
      });
    }
    if (this.modelRegistry.size === 1) {
      this.setupMarkupTools(world);
      this.setTool(this.tool);
    } else {
      this.setupMarkupTools(world);
    }
    this.invalidatePlanSilhouette();
  }

  /** Ensures the model is parented to the scene and wired to the active camera. */
  private attachModel(model: FRAGS.FragmentsModel): void {
    const world = this.world;
    if (!world) return;
    if (!world.scene.three.children.includes(model.object)) {
      world.scene.three.add(model.object);
    }
    model.useCamera(world.camera.three as THREE.PerspectiveCamera);
    void this.mustComponents().get(OBC.FragmentsManager).core.update(true);
  }

  // fallow-ignore-next-line complexity
  private async waitForCanvasSize(maxAttempts = 30): Promise<void> {
    const container = this.container;
    if (!container) return;
    for (let i = 0; i < maxAttempts; i++) {
      if (container.clientWidth >= MIN_CANVAS_PX && container.clientHeight >= MIN_CANVAS_PX) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  /** IFC units vary (m vs mm); widen clipping so large models are not culled. */
  private adjustCameraClipping(sphere: THREE.Sphere): void {
    const world = this.world;
    if (!world) return;
    const cam = world.camera.three;
    if (!(cam instanceof THREE.PerspectiveCamera)) return;
    const radius = Math.max(sphere.radius, 0.01);
    cam.near = Math.max(radius / 20_000, 0.01);
    cam.far = Math.max(radius * 400, 10_000);
    cam.updateProjectionMatrix();
    const controls = world.camera.controls;
    controls.minDistance = Math.max(radius * 0.02, 0.05);
    controls.maxDistance = radius * 80;
  }

  /** Always render full geometry — no distance-based wireframe LOD. */
  // fallow-ignore-next-line complexity
  private async applyLod500RuntimeSettings(): Promise<void> {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return;
    try {
      for (const [, model] of fragments.list) {
        await model.setLodMode(FRAGS.LodMode.ALL_GEOMETRY);
      }
      await fragments.core.update(true);
    } catch {
      /* Best-effort — older fragment buffers may omit LOD metadata. */
    }
  }

  /** PBR materials, IFC/discipline colors, spaces, and transparent render order. */
  // fallow-ignore-next-line complexity
  private async syncViewportMaterials(): Promise<void> {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized || this.materialSyncInProgress) return;
    if (this.hasActiveFragmentHighlights()) {
      this.pendingMaterialSync = true;
      return;
    }

    this.materialSyncInProgress = true;
    try {
      const colorOpts = {
        colorMode: this.appearance.colorMode,
        spaceDisplay: this.appearance.spaceDisplay,
      };
      const registryByMaterial = new Map<THREE.Material, number>();
      for (const [registryId, mat] of fragments.core.models.materials.list) {
        registryByMaterial.set(mat, registryId);
      }
      const processedMaterials = new Set<THREE.Material>();

      for (const [modelId, entry] of this.modelRegistry) {
        const model = entry.model;
        const storeyMap = new Map<number, string>();
        for (const [key, storey] of this.storeyByModelLocalId) {
          if (!key.startsWith(`${modelId}:`)) continue;
          const localId = Number(key.slice(modelId.length + 1));
          if (!Number.isNaN(localId)) storeyMap.set(localId, storey);
        }

        const spaceItemIds = await buildSpaceItemIds(model);
        const spaceMaterialIds = await buildSpaceMaterialIds(model, spaceItemIds);
        const contexts = await buildMaterialItemContext(model, storeyMap);
        const matIds = await model.getMaterialsIds();
        const localMatIds = new Set(matIds);
        const ifcMaterials = await model.getMaterials(matIds);

        // fallow-ignore-next-line complexity
        const resolveSpaceForMaterial = (
          materialLocalId: number | undefined,
          fallbackStorey: string | null,
        ) => {
          const ctx =
            typeof materialLocalId === "number" ? contexts.get(materialLocalId) : undefined;
          const src =
            typeof materialLocalId === "number" ? ifcMaterials.get(materialLocalId) : undefined;
          return resolveSpaceColor(
            src,
            ctx?.storey ?? fallbackStorey,
            BIM_SPACE_MATERIAL.color,
            BIM_SPACE_MATERIAL.opacity,
            colorOpts,
          );
        };

        const applyMaterial = (
          registryId: number | null,
          threeMat: THREE.Material,
          resolved: ReturnType<typeof resolveElementColor>,
          isSpace: boolean,
        ): THREE.Material => {
          if (threeMat instanceof THREE.MeshStandardMaterial) {
            this.applyResolvedShellMaterial(threeMat, resolved, isSpace);
            return threeMat;
          }
          if (!(threeMat instanceof THREE.MeshLambertMaterial)) return threeMat;

          const standard = upgradeLambertToStandard(
            threeMat,
            resolved,
            this.appearance.spaceDisplay,
          );
          standard.fog = true;
          if (registryId != null) {
            fragments.core.models.materials.list.set(
              registryId,
              standard as unknown as FRAGS.BIMMaterial,
            );
          }
          replaceMaterialReferences(model.object, threeMat, standard);
          threeMat.dispose();
          return standard;
        };

        // Fragment THREE materials are keyed by CRC hash — match via userData.localId.
        for (const [registryId, threeMat] of fragments.core.models.materials.list) {
          const materialLocalId = (threeMat.userData as { localId?: number }).localId;
          if (typeof materialLocalId !== "number" || !localMatIds.has(materialLocalId)) {
            continue;
          }

          const ctx = contexts.get(materialLocalId);
          const isSpace = ctx?.isSpace === true || spaceMaterialIds.has(materialLocalId);
          const src = ifcMaterials.get(materialLocalId);
          const resolved = isSpace
            ? resolveSpaceColor(
                src,
                ctx?.storey ?? null,
                BIM_SPACE_MATERIAL.color,
                BIM_SPACE_MATERIAL.opacity,
                colorOpts,
              )
            : resolveElementColor(ctx?.dominantType ?? "IfcProduct", src, colorOpts);

          processedMaterials.add(threeMat);
          applyMaterial(registryId, threeMat, resolved, isSpace);
        }

        // Tile meshes carry itemIds — catch space geometry even when material registry matching fails.
        applySpaceDisplayToModelMeshes(
          model,
          spaceItemIds,
          (storey) => resolveSpaceForMaterial(undefined, storey),
          storeyMap,
          (threeMat, _resolvedFromStorey, storey) => {
            if (processedMaterials.has(threeMat)) return threeMat;
            const materialLocalId = (threeMat.userData as { localId?: number }).localId;
            const registryId = registryByMaterial.get(threeMat) ?? null;
            const resolved = resolveSpaceForMaterial(materialLocalId, storey);
            processedMaterials.add(threeMat);
            return applyMaterial(registryId, threeMat, resolved, true);
          },
        );

        applyRenderOrderToModel(model);
      }
      await fragments.core.update(true);
    } catch {
      /* Material sync is best-effort — never block tools or model load. */
    } finally {
      this.materialSyncInProgress = false;
    }
  }

  /**
   * Highlighter.updateColors() races resetHighlight || highlight via Promise.allSettled,
   * so reset often wins and selection/filter tints vanish immediately. Route all
   * highlight updates through our serialized painter instead.
   */
  private installFilterHighlightGuard(highlighter: OBF.Highlighter): void {
    const guarded = highlighter as OBF.Highlighter & {
      __planSyncFilterGuard?: boolean;
      updateColors: () => Promise<void>;
    };
    if (guarded.__planSyncFilterGuard) return;
    guarded.updateColors = async () => {
      await this.requestFragmentHighlights();
    };
    guarded.__planSyncFilterGuard = true;
  }

  /** Re-apply ghost / colorize tints after fragment material or tile updates. */
  private hasActiveFilterHighlights(): boolean {
    return this.activeFilterGhostMap != null || this.activeColorizeGroups.length > 0;
  }

  // fallow-ignore-next-line complexity
  private hasActiveSelectionHighlight(): boolean {
    if (this.selectedGuids.size > 0 || this.lastPickMap != null) return true;
    const highlighter = this.components?.get(OBF.Highlighter);
    if (!highlighter) return false;
    const selectMap = highlighter.selection[highlighter.config.selectName];
    if (!selectMap) return false;
    for (const ids of Object.values(selectMap)) {
      if (ids instanceof Set && ids.size > 0) return true;
    }
    return false;
  }

  private hasActiveFragmentHighlights(): boolean {
    return this.hasActiveFilterHighlights() || this.hasActiveSelectionHighlight();
  }

  /** Hover preview is only useful in orbit select mode. */
  private syncHoverEnabled(): void {
    const hoverer = this.components?.get(OBF.Hoverer);
    if (!hoverer) return;
    hoverer.enabled = this.tool === "select" && this.cameraMode !== "walk";
  }

  /** Queue a single coalesced repaint of selection + filter overlays. */
  private requestFragmentHighlights(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.highlightPaintInFlight) {
      this.highlightPaintQueued = true;
      return this.highlightPaintInFlight;
    }
    this.highlightPaintInFlight = this.runFragmentHighlightPaint().finally(() => {
      this.highlightPaintInFlight = null;
      if (this.highlightPaintQueued && !this.disposed) {
        this.highlightPaintQueued = false;
        void this.requestFragmentHighlights();
      } else {
        this.highlightPaintQueued = false;
      }
    });
    return this.highlightPaintInFlight;
  }

  private readyFragments(): OBC.FragmentsManager | null {
    if (this.disposed || !this.components) return null;
    const fragments = this.components.get(OBC.FragmentsManager);
    if (!fragments.initialized) return null;
    return fragments;
  }

  /** Drop model/local ids that are no longer in the loaded fragment list. */
  // fallow-ignore-next-line complexity
  private sanitizeHighlightMap(
    map: OBC.ModelIdMap | null | undefined,
    fragments: OBC.FragmentsManager | null | undefined,
  ): OBC.ModelIdMap | null {
    if (!map || !fragments?.initialized) return null;
    try {
      const out: OBC.ModelIdMap = {};
      for (const [modelId, ids] of Object.entries(map)) {
        if (!fragments.list.has(modelId)) continue;
        if (!(ids instanceof Set) || ids.size === 0) continue;
        out[modelId] = new Set(ids);
      }
      return Object.keys(out).length > 0 ? out : null;
    } catch {
      return null;
    }
  }

  /**
   * Paint filter tints via FragmentsManager sequentially.
   * Do NOT use Highlighter.updateColors() — it Promise.allSettles reset+highlight
   * in parallel, so reset often wins and ghost/colorize vanish immediately.
   *
   * Never set preserveOriginalMaterial without _explicitProps — That Open then
   * applies zero property overrides and ghost/colorize become invisible.
   */
  // fallow-ignore-next-line complexity
  private async runFragmentHighlightPaint(): Promise<void> {
    const fragments = this.readyFragments();
    const highlighter = this.disposed ? null : this.components?.get(OBF.Highlighter);
    if (!fragments) return;

    try {
      if (!this.hasActiveFragmentHighlights()) {
        try {
          await fragments.resetHighlight();
          if (!this.readyFragments()) return;
          await fragments.core.update(true);
        } catch {
          /* fragment list may be mid-load or already torn down */
        }
        this.bumpRender();
        return;
      }

      try {
        await fragments.resetHighlight();
      } catch {
        /* best-effort reset before repainting overlays */
      }

      // fallow-ignore-next-line complexity
      const paint = async (
        customId: string,
        def: {
          color: THREE.Color;
          opacity: number;
          transparent: boolean;
          renderedFaces?: number;
          depthTest?: boolean;
          depthWrite?: boolean;
        },
        map: OBC.ModelIdMap | null | undefined,
      ) => {
        const live = this.readyFragments();
        if (!live) return;
        const safeMap = this.sanitizeHighlightMap(map, live);
        if (!safeMap) return;
        try {
          await live.highlight(
            {
              color: def.color,
              opacity: def.opacity,
              transparent: def.transparent,
              renderedFaces: def.renderedFaces ?? 0,
              depthTest: def.depthTest ?? true,
              depthWrite: def.depthWrite ?? false,
              customId,
            },
            safeMap,
          );
        } catch {
          /* stale selection/filter maps during federation or filter churn */
        }
      };

      if (this.activeFilterGhostMap) {
        await paint(
          BimEngine.FILTER_GHOST_STYLE,
          {
            color: new THREE.Color("#64748b"),
            opacity: this.activeFilterGhostOpacity,
            transparent: true,
            renderedFaces: 0,
            depthTest: true,
            depthWrite: false,
          },
          this.activeFilterGhostMap,
        );
      }

      for (const group of this.activeColorizeGroups) {
        await paint(
          group.styleId,
          {
            color: new THREE.Color(group.color),
            opacity: COLORIZE_HIGHLIGHT_OPACITY,
            transparent: true,
            renderedFaces: 0,
            depthTest: true,
            depthWrite: false,
          },
          group.map,
        );
      }

      if (!this.readyFragments()) return;

      // Keep selection tint on top when present.
      const selectMap = this.sanitizeHighlightMap(this.getActiveSelectionMap(), fragments);
      if (selectMap && highlighter) {
        const selectName = highlighter.config.selectName;
        const selectDef = highlighter.styles.get(selectName);
        await paint(
          selectName,
          {
            color: selectDef?.color ?? new THREE.Color(SELECTION_ACCENT),
            opacity: selectDef?.opacity ?? BIM_SELECTION.fillOpacity,
            transparent: selectDef?.transparent ?? true,
            renderedFaces: selectDef?.renderedFaces ?? 0,
            depthTest: selectDef?.depthTest ?? true,
            depthWrite: selectDef?.depthWrite ?? false,
          },
          selectMap,
        );
      }

      try {
        await fragments.core.update(true);
      } catch {
        /* worker may reject update while tiles are rebuilding or engine is disposing */
      }
      if (!this.disposed) this.bumpRender();
    } finally {
      this.maybeScheduleDeferredMaterialSync();
    }
  }

  private async paintFilterHighlights(): Promise<void> {
    await this.requestFragmentHighlights();
  }

  private async refreshHighlightStyles(): Promise<void> {
    await this.requestFragmentHighlights();
  }

  private maybeScheduleDeferredMaterialSync(): void {
    if (!this.pendingMaterialSync || this.hasActiveFragmentHighlights()) return;
    this.pendingMaterialSync = false;
    this.scheduleMaterialSync();
  }

  // fallow-ignore-next-line complexity
  private applyResolvedShellMaterial(
    threeMat: THREE.MeshStandardMaterial,
    resolved: ReturnType<typeof resolveElementColor>,
    isSpace: boolean,
  ): void {
    threeMat.color.copy(resolved.color);
    threeMat.opacity = resolved.opacity;
    threeMat.transparent = resolved.transparent;
    threeMat.depthWrite = resolved.depthWrite;
    threeMat.visible = resolved.opacity > 0;
    threeMat.roughness = resolved.pbr.roughness;
    threeMat.metalness = resolved.pbr.metalness;
    threeMat.envMapIntensity = resolved.pbr.envMapIntensity;
    threeMat.side = THREE.DoubleSide;
    threeMat.fog = true;
    threeMat.userData.renderTier = resolved.renderTier;
    if (isSpace && this.appearance.spaceDisplay === "outline") {
      threeMat.emissive.set(BIM_ACCENT);
      threeMat.emissiveIntensity = 0.35;
    } else if (isSpace) {
      threeMat.emissive.set(BIM_SPACE_MATERIAL.color);
      threeMat.emissiveIntensity = 0.1;
    } else if (resolved.renderTier === BimRenderTier.glass) {
      threeMat.emissive.copy(resolved.color).multiplyScalar(0.04);
      threeMat.emissiveIntensity = 1;
    } else {
      threeMat.emissive.copy(resolved.color).multiplyScalar(0.035);
      threeMat.emissiveIntensity = 0.85;
    }
    threeMat.needsUpdate = true;
  }

  // fallow-ignore-next-line complexity
  private applySkyEnvironment(): void {
    const world = this.world;
    if (!world) return;
    const sky = getViewportColors(this.appearance.environment);

    this.viewportBackground?.dispose();
    this.viewportBackground = createBimSkyTexture(this.appearance.environment);
    world.scene.three.background = this.viewportBackground;

    world.scene.config.directionalLight.color = new THREE.Color(sky.sun);
    world.scene.config.directionalLight.intensity = sky.sunIntensity;
    world.scene.config.ambientLight.color = new THREE.Color(sky.ambient);
    world.scene.config.ambientLight.intensity = sky.ambientIntensity;

    if (this.hemiLight) {
      this.hemiLight.color.set(sky.hemiSky);
      this.hemiLight.groundColor.set(sky.hemiGround);
      this.hemiLight.intensity = sky.hemiIntensity;
    }
    if (this.rimLight) {
      this.rimLight.color.set(sky.rim);
      this.rimLight.intensity = sky.rimIntensity;
    }

    world.renderer?.three && (world.renderer.three.toneMappingExposure = sky.exposure);

    const grid = this.components?.get(OBC.Grids).list.get(world.uuid);
    if (grid) {
      const sky = getViewportColors(this.appearance.environment);
      grid.config.visible = this.appearance.gridMode !== "hide";
      grid.config.color = new THREE.Color(sky.grid);
      if (this.appearance.gridMode === "fade_far") {
        grid.config.distance = 900;
      } else if (this.appearance.gridMode === "subtle") {
        grid.config.distance = 450;
        grid.config.color = new THREE.Color(sky.grid).multiplyScalar(0.65);
      } else {
        grid.config.distance = 650;
      }
    }
    if (this.container) {
      this.container.style.background = sky.container;
    }
  }

  /** Left-drag orbit, right-drag pan — click without drag selects (see pointerMoved). */
  // fallow-ignore-next-line complexity
  private applyBim360Navigation(): void {
    if (this.cameraMode !== "orbit") return;
    const controls = this.world?.camera?.controls;
    if (!controls) return;
    if (this.tool === "markup") {
      controls.mouseButtons.left = CAM_NONE;
      controls.mouseButtons.right = CAM_TRUCK;
      controls.mouseButtons.middle = CAM_TRUCK;
      controls.mouseButtons.wheel = CAM_DOLLY;
      controls.touches.one = CAM_NONE;
      controls.touches.two = CAM_TOUCH_DOLLY_TRUCK;
      return;
    }
    controls.mouseButtons.left = CAM_ROTATE;
    controls.mouseButtons.right = CAM_TRUCK;
    controls.mouseButtons.middle = CAM_TRUCK;
    controls.mouseButtons.wheel = CAM_DOLLY;
    controls.touches.one = CAM_TOUCH_ROTATE;
    controls.touches.two = CAM_TOUCH_DOLLY_TRUCK;
  }

  /** First-person look + keyboard / joystick movement. */
  // fallow-ignore-next-line complexity
  private applyWalkNavigation(): void {
    if (this.cameraMode !== "walk") return;
    const world = this.world;
    const controls = world?.camera?.controls;
    if (!world || !controls) return;
    world.camera.enabled = true;
    controls.mouseButtons.left = CAM_ROTATE;
    controls.mouseButtons.right = CAM_NONE;
    controls.mouseButtons.middle = CAM_TRUCK;
    controls.mouseButtons.wheel = CAM_DOLLY;
    controls.touches.one = CAM_TOUCH_ROTATE;
    controls.touches.two = CAM_TOUCH_DOLLY_TRUCK;
    controls.truckSpeed = 50;
  }

  // fallow-ignore-next-line complexity
  private async enterWalkCamera(walkPivot?: THREE.Vector3): Promise<void> {
    const world = this.world;
    if (!world) return;
    try {
      const fragments = this.components?.get(OBC.FragmentsManager);
      if (fragments?.initialized) {
        await fragments.core.update(true);
      }
      const box = this.getModelBoundingBox();
      if (!this.isValidBox3(box)) return;

      const controls = world.camera.controls;
      const eyeHeight = this.walkEyeHeight(box);
      const pivot = walkPivot ?? controls.getTarget(new THREE.Vector3());
      const eye = this.clampWalkEyePosition(pivot, box, eyeHeight);

      const dir = new THREE.Vector3();
      world.camera.three.getWorldDirection(dir);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      const lookTarget = eye.clone().add(dir.multiplyScalar(4));

      const sphere = box.getBoundingSphere(new THREE.Sphere());
      if (sphere.radius > 0 && Number.isFinite(sphere.radius)) {
        this.adjustCameraClipping(sphere);
      }

      await controls.setLookAt(
        eye.x,
        eye.y,
        eye.z,
        lookTarget.x,
        lookTarget.y,
        lookTarget.z,
        false,
      );
      this.bumpRender();
    } catch {
      /* Walk still works from the current camera pose. */
    }
  }

  /** Standing eye height in model units (metres or millimetres). */
  private walkEyeHeight(box: THREE.Box3): number {
    const units = this.detectModelUnits();
    if (!this.isValidBox3(box)) {
      return units === "mm" ? 1700 : 1.7;
    }
    const size = box.getSize(new THREE.Vector3());
    if (units === "mm") {
      return THREE.MathUtils.clamp(size.y * 0.05, 1400, 2100);
    }
    return THREE.MathUtils.clamp(size.y * 0.05, 1.4, 2.1);
  }

  // fallow-ignore-next-line complexity
  private isValidBox3(box: THREE.Box3 | null | undefined): box is THREE.Box3 {
    if (!box || box.isEmpty()) return false;
    const { min, max } = box;
    return (
      Number.isFinite(min.x) &&
      Number.isFinite(min.y) &&
      Number.isFinite(min.z) &&
      Number.isFinite(max.x) &&
      Number.isFinite(max.y) &&
      Number.isFinite(max.z) &&
      min.x <= max.x &&
      min.y <= max.y &&
      min.z <= max.z
    );
  }

  // fallow-ignore-next-line complexity
  private walkFeetInset(clampBox: THREE.Box3): number {
    const units = this.detectModelUnits();
    const minInset = units === "mm" ? 250 : 0.25;
    if (!this.isValidBox3(clampBox)) return minInset;
    const size = clampBox.getSize(new THREE.Vector3());
    const span = Math.min(Math.abs(size.x), Math.abs(size.z));
    if (!Number.isFinite(span) || span <= 0) return minInset;
    return Math.max(span * 0.02, minInset);
  }

  /** Resolve walkable floor elevation (fragments are not THREE.Raycaster-safe). */
  // fallow-ignore-next-line complexity
  private findWalkFloorY(hintY: number, modelBox: THREE.Box3 | null): number {
    if (this.planMinimapStoreyFloorY != null && Number.isFinite(this.planMinimapStoreyFloorY)) {
      return this.planMinimapStoreyFloorY;
    }
    if (Number.isFinite(hintY)) return hintY;
    if (this.isValidBox3(modelBox)) return modelBox.min.y;
    return 0;
  }

  /** Place walk camera on the model floor near the orbit pivot (or bbox center). */
  // fallow-ignore-next-line complexity
  private clampWalkEyePosition(
    pivot: THREE.Vector3,
    modelBox: THREE.Box3,
    eyeHeight: number,
    footprintBox: THREE.Box3 = modelBox,
  ): THREE.Vector3 {
    const clampBox = this.isValidBox3(footprintBox)
      ? footprintBox
      : this.isValidBox3(modelBox)
        ? modelBox
        : null;

    let x = pivot.x;
    let z = pivot.z;
    if (clampBox) {
      const inset = this.walkFeetInset(clampBox);
      const center = clampBox.getCenter(new THREE.Vector3());
      const loX = Math.min(clampBox.min.x + inset, clampBox.max.x - inset);
      const hiX = Math.max(clampBox.min.x + inset, clampBox.max.x - inset);
      const loZ = Math.min(clampBox.min.z + inset, clampBox.max.z - inset);
      const hiZ = Math.max(clampBox.min.z + inset, clampBox.max.z - inset);
      x = Number.isFinite(pivot.x) ? THREE.MathUtils.clamp(pivot.x, loX, hiX) : center.x;
      z = Number.isFinite(pivot.z) ? THREE.MathUtils.clamp(pivot.z, loZ, hiZ) : center.z;
    }

    const hintY = Number.isFinite(pivot.y)
      ? pivot.y
      : this.isValidBox3(modelBox)
        ? modelBox.min.y
        : 0;
    const floorY = this.findWalkFloorY(hintY, modelBox);
    const safeEyeHeight = Number.isFinite(eyeHeight) ? eyeHeight : this.walkEyeHeight(modelBox);
    return new THREE.Vector3(x, floorY + safeEyeHeight, z);
  }

  /** Section planes + measure tools — colors, units, snapping (BIM 360 style). */
  private setupMarkupTools(
    world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.RendererWith2D>,
  ): void {
    const components = this.mustComponents();
    const accent = new THREE.Color(MARKUP_ACCENT);

    const clipper = components.get(OBC.Clipper);
    clipper.setup({
      color: accent,
      opacity: 0,
      size: 8,
    });
    clipper.autoScalePlanes = true;
    clipper.orthogonalY = false;
    clipper.localClippingPlanes = true;
    clipper.config.visible = true;
    clipper.config.enabled = true;
    clipper.onAfterCreate.add((plane) => {
      hideClipPlaneFace(plane);
    });
    this.setupFragmentClipping(world);

    const snap = [
      FRAGS.SnappingClass.POINT,
      FRAGS.SnappingClass.LINE,
      FRAGS.SnappingClass.FACE,
    ] as FRAGS.SnappingClass[];

    const configure = (m: OBF.LengthMeasurement | OBF.AreaMeasurement | OBF.AngleMeasurement) => {
      m.color = accent;
      m.units = this.detectModelUnits();
      m.rounding = 2;
      m.pickerSize = 10;
      m.delay = 120;
      m.pickMode = OBF.MeasurementPickMode.MOUSE_MOVE;
      m.snappings = snap;
    };

    configure(components.get(OBF.LengthMeasurement));
    configure(components.get(OBF.AreaMeasurement));
    configure(components.get(OBF.AngleMeasurement));

    components.get(OBF.LengthMeasurement).mode = "free";
  }

  /** Pass live clip planes to fragment worker meshes + refresh on plane changes. */
  private setupFragmentClipping(
    world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.RendererWith2D>,
  ): void {
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const clipper = this.mustComponents().get(OBC.Clipper);
    const renderer = world.renderer;
    if (!renderer) return;

    const getActivePlanes = (): THREE.Plane[] => renderer.clippingPlanes;

    const bindModel = (model: FRAGS.FragmentsModel): void => {
      model.getClippingPlanesEvent = getActivePlanes;
    };

    for (const [, model] of fragments.list) bindModel(model);
    fragments.list.onItemSet.add(({ value }) => bindModel(value));

    const syncMaterialClipping = (): void => {
      if (!clipper.localClippingPlanes) return;
      const planes = renderer.clippingPlanes;
      for (const [, material] of fragments.core.models.materials.list) {
        material.clippingPlanes = planes;
      }
    };

    fragments.core.models.materials.list.onItemSet.add(() => syncMaterialClipping());

    renderer.onClippingPlanesUpdated.add(() => {
      syncMaterialClipping();
      void fragments.core.update(true);
      this.bumpRender();
    });
  }

  /** View cube (orbit) + plan minimap (walk) — isolated from the main viewport. */
  private setupViewportOverlays(
    container: HTMLElement,
    world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.RendererWith2D>,
  ): void {
    const renderer = world.renderer;
    if (!renderer) return;

    this.viewCube = new ViewCubeOverlay(container, {
      onFaceSelect: (normal) => {
        void this.snapCameraToDirection(normal);
      },
      onDrag: (dx, dy) => this.rotateCameraByDrag(dx, dy),
    });

    const onAfterUpdate = () => {
      if (this.disposed) return;
      this.syncViewportOverlays();
    };
    this.onViewportOverlayAfterUpdate = onAfterUpdate;
    renderer.onAfterUpdate.add(onAfterUpdate);
    this.syncViewportOverlays();
  }

  private syncViewportOverlays(): void {
    const world = this.world;
    if (!world) return;
    const isWalk = this.cameraMode === "walk";
    this.viewCube?.setVisible(!isWalk);
    if (!isWalk) {
      this.viewCube?.sync(world.camera.three.quaternion);
    }
  }

  getCameraMode(): BimCameraMode {
    return this.cameraMode;
  }

  /** Match IFC storey key from source/display name or alias. */
  // fallow-ignore-next-line complexity
  resolveStoreyName(name: string | null | undefined): string | null {
    if (!name) return null;
    if (this.storeyMaps.has(name)) return name;
    const lower = name.toLowerCase();
    for (const key of this.storeyMaps.keys()) {
      if (key.toLowerCase() === lower) return key;
    }
    for (const key of this.storeyMaps.keys()) {
      const kl = key.toLowerCase();
      if (kl.includes(lower) || lower.includes(kl)) return key;
    }
    return null;
  }

  invalidatePlanSilhouette(): void {
    this.planSilhouetteDirty = true;
    this.schedulePlanSilhouetteBake();
  }

  private cancelPlanSilhouetteBakeTimer(): void {
    if (this.planSilhouetteBakeTimer != null) {
      window.clearTimeout(this.planSilhouetteBakeTimer);
      this.planSilhouetteBakeTimer = null;
    }
  }

  schedulePlanSilhouetteBake(): void {
    if (this.disposed) return;
    if (this.planSilhouetteBakeTimer != null) {
      window.clearTimeout(this.planSilhouetteBakeTimer);
    }
    this.planSilhouetteBakeTimer = window.setTimeout(() => {
      this.planSilhouetteBakeTimer = null;
      void this.bakePlanSilhouetteNow();
    }, 200);
  }

  private planSilhouetteBakeGen = 0;
  private planSilhouetteBakePending = false;

  // fallow-ignore-next-line complexity
  private async bakePlanSilhouetteNow(): Promise<void> {
    if (this.disposed) return;
    const world = this.world;
    if (!world) return;
    if (this.planSilhouetteBaking) {
      this.planSilhouetteBakePending = true;
      return;
    }

    this.cancelPlanSilhouetteBakeTimer();
    const bakeGen = ++this.planSilhouetteBakeGen;
    const storeyAtStart = this.planMinimapStorey;
    this.planSilhouetteBaking = true;
    try {
      const elementsByModel = this.filterPlanLocalIds(this.planMinimapStorey);
      const worldBounds = await this.computePlanBounds(elementsByModel, this.planMinimapStorey);
      if (bakeGen !== this.planSilhouetteBakeGen || storeyAtStart !== this.planMinimapStorey)
        return;
      if (!worldBounds || !this.isValidBox3(worldBounds)) {
        if (bakeGen !== this.planSilhouetteBakeGen || storeyAtStart !== this.planMinimapStorey)
          return;
        this.planSilhouette?.close();
        this.planSilhouette = null;
        this.planMinimapBoundsCache = null;
        this.planSilhouetteDirty = false;
        return;
      }

      const fragments = this.mustComponents().get(OBC.FragmentsManager);
      await fragments.core.update(true);
      world.scene.three.updateMatrixWorld(true);

      if (bakeGen !== this.planSilhouetteBakeGen || storeyAtStart !== this.planMinimapStorey)
        return;

      const bounds = boundsFromBox3(worldBounds);
      const next = await bakePlanFromSlice({
        fragments: fragments.list,
        elementsByModel,
        bounds,
        worldBounds,
        units: this.detectModelUnits(),
      });

      if (bakeGen !== this.planSilhouetteBakeGen || storeyAtStart !== this.planMinimapStorey) {
        next?.close();
        return;
      }

      this.planSilhouette?.close();
      this.planSilhouette = next;
      this.planMinimapBoundsCache = bounds;
      if (this.planMinimapStorey) {
        this.planMinimapStoreyFloorY = worldBounds.min.y;
      } else {
        this.planMinimapStoreyFloorY = null;
      }
      this.planSilhouetteDirty = false;
      this.bumpRender();
    } catch {
      /* Silhouette is optional — footprint fallback still works. */
    } finally {
      this.planSilhouetteBaking = false;
      if (this.hasActiveFragmentHighlights()) {
        await this.requestFragmentHighlights();
      }
      if (this.planSilhouetteBakePending) {
        this.planSilhouetteBakePending = false;
        void this.bakePlanSilhouetteNow();
      }
    }
  }

  /** IFC elements to include in the plan slice (storey + architectural categories). */
  // fallow-ignore-next-line complexity
  private filterPlanLocalIds(storeyName: string | null): Map<string, number[]> {
    const planCats = filterPlanCategories(this.categoryMaps.keys()).filter(
      (cat) => this.categoryVisible.get(cat) ?? true,
    );
    const grouped = new Map<string, Set<number>>();

    const addId = (modelId: string, localId: number) => {
      const bucket = grouped.get(modelId) ?? new Set<number>();
      bucket.add(localId);
      grouped.set(modelId, bucket);
    };

    const groupedCount = () => {
      let total = 0;
      for (const ids of grouped.values()) total += ids.size;
      return total;
    };

    const matchesPlanCategory = (modelId: string, localId: number): boolean => {
      if (planCats.length === 0) return true;
      for (const cat of planCats) {
        const catMap = this.categoryMaps.get(cat);
        if (catMap?.[modelId]?.has(localId)) return true;
      }
      return false;
    };

    const targetStoreys = (): string[] => {
      if (storeyName) {
        const resolved = this.resolveStoreyName(storeyName);
        return resolved ? [resolved] : [];
      }
      return [...this.storeyMaps.keys()].filter((name) => this.storeyVisible.get(name) ?? true);
    };

    // fallow-ignore-next-line complexity
    const addFromStoreys = (useCategoryFilter: boolean) => {
      for (const name of targetStoreys()) {
        const storeyMap = this.storeyMaps.get(name);
        if (!storeyMap) continue;
        for (const [modelId, idSet] of Object.entries(storeyMap)) {
          for (const localId of idSet) {
            if (useCategoryFilter && !matchesPlanCategory(modelId, localId)) continue;
            addId(modelId, localId);
          }
        }
      }
    };

    // Selected floor → all elements on that storey (category trim only for "All levels").
    const useCategoryFilter = !storeyName && planCats.length > 0;
    addFromStoreys(useCategoryFilter);

    if (groupedCount() === 0 && useCategoryFilter) {
      addFromStoreys(false);
    }

    // Models without IFC storeys: fall back to visible architectural categories only.
    if (groupedCount() === 0 && !storeyName && this.storeyMaps.size === 0) {
      const cats =
        planCats.length > 0
          ? planCats
          : [...this.categoryMaps.keys()].filter((cat) => this.categoryVisible.get(cat) ?? true);
      for (const cat of cats) {
        const catMap = this.categoryMaps.get(cat);
        if (!catMap) continue;
        for (const [modelId, idSet] of Object.entries(catMap)) {
          for (const localId of idSet) {
            addId(modelId, localId);
          }
        }
      }
    }

    const out = new Map<string, number[]>();
    let total = 0;
    for (const [modelId, ids] of grouped) {
      const list = [...ids];
      const room = Math.max(PLAN_GEOMETRY_ITEM_CAP - total, 0);
      if (room <= 0) break;
      out.set(modelId, list.slice(0, room));
      total += Math.min(list.length, room);
    }
    return out;
  }

  // fallow-ignore-next-line complexity
  private async computePlanBounds(
    elementsByModel: Map<string, number[]>,
    storeyName: string | null = null,
  ): Promise<THREE.Box3 | null> {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized || elementsByModel.size === 0) {
      if (storeyName) return null;
      return this.getModelBoundingBox();
    }

    const bounds = new THREE.Box3();
    for (const [modelId, ids] of elementsByModel) {
      const model = fragments.list.get(modelId);
      if (!model || ids.length === 0) continue;
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        try {
          bounds.union(await model.getMergedBox(chunk));
        } catch {
          /* skip chunk */
        }
      }
    }

    if (bounds.isEmpty()) {
      return storeyName ? null : this.getModelBoundingBox();
    }
    return bounds;
  }

  /** Storey floor elevation and footprint for walk + minimap framing. */
  // fallow-ignore-next-line complexity
  private async getStoreyWalkHint(
    storeyName: string,
  ): Promise<{ floorY: number; centerX: number; centerZ: number; bounds: THREE.Box3 } | null> {
    try {
      const elementsByModel = this.filterPlanLocalIds(storeyName);
      const bounds = await this.computePlanBounds(elementsByModel, storeyName);
      if (!bounds || !this.isValidBox3(bounds)) return null;
      const center = bounds.getCenter(new THREE.Vector3());
      const floorY = Number.isFinite(bounds.min.y) ? bounds.min.y : center.y;
      if (!Number.isFinite(floorY)) return null;
      return {
        floorY,
        centerX: center.x,
        centerZ: center.z,
        bounds: bounds.clone(),
      };
    } catch {
      return null;
    }
  }

  private horizontalLookDir(out = new THREE.Vector3()): THREE.Vector3 {
    const world = this.world;
    if (!world) return out.set(0, 0, -1);
    world.camera.three.getWorldDirection(out);
    out.y = 0;
    if (out.lengthSq() < 1e-6) return out.set(0, 0, -1);
    return out.normalize();
  }

  // fallow-ignore-next-line complexity
  private async placeWalkOnStorey(storeyName: string, animate: boolean): Promise<void> {
    const world = this.world;
    if (!world || this.cameraMode !== "walk") return;
    try {
      const hint = await this.getStoreyWalkHint(storeyName);
      const box = this.getModelBoundingBox();
      if (!hint || !this.isValidBox3(box)) return;

      const cam = world.camera.three.position;
      const inset = this.walkFeetInset(hint.bounds);
      const loX = Math.min(hint.bounds.min.x + inset, hint.bounds.max.x - inset);
      const hiX = Math.max(hint.bounds.min.x + inset, hint.bounds.max.x - inset);
      const loZ = Math.min(hint.bounds.min.z + inset, hint.bounds.max.z - inset);
      const hiZ = Math.max(hint.bounds.min.z + inset, hint.bounds.max.z - inset);
      const x = THREE.MathUtils.clamp(cam.x, loX, hiX);
      const z = THREE.MathUtils.clamp(cam.z, loZ, hiZ);
      const eyeHeight = this.walkEyeHeight(box);
      const pivot = new THREE.Vector3(x, hint.floorY, z);
      const eye = this.clampWalkEyePosition(pivot, box, eyeHeight, hint.bounds);
      const dir = this.horizontalLookDir();
      const lookTarget = eye.clone().add(dir.multiplyScalar(4));

      await world.camera.controls.setLookAt(
        eye.x,
        eye.y,
        eye.z,
        lookTarget.x,
        lookTarget.y,
        lookTarget.z,
        animate,
      );
      await this.mustComponents().get(OBC.FragmentsManager).core.update(true);
      this.bumpRender();
    } catch {
      /* Walk placement is best-effort when fragment bounds are unavailable. */
    }
  }

  // fallow-ignore-next-line complexity
  getPlanMinimapState(): PlanMinimapState | null {
    const world = this.world;
    if (!world) return null;

    const dir = this.horizontalLookDir();
    const controls = world.camera.controls;
    const target = controls.getTarget(new THREE.Vector3());
    const camPos = world.camera.three.position;
    const isWalk = this.cameraMode === "walk";
    const anchorX = isWalk ? camPos.x : target.x;
    const anchorZ = isWalk ? camPos.z : target.z;

    const box = this.getModelBoundingBox();
    const bounds =
      this.planMinimapBoundsCache ?? (box && !box.isEmpty() ? boundsFromBox3(box) : null);

    const persp = world.camera.three as THREE.PerspectiveCamera;
    const vFovRad = ((persp.fov ?? 50) * Math.PI) / 180;
    const aspect = persp.aspect > 0 ? persp.aspect : 1;
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
    const fovHalfRad = isWalk ? (35 * Math.PI) / 180 : hFovRad / 2;

    if (this.planSilhouetteDirty && !this.planSilhouetteBaking && !this.planSilhouetteBakeTimer) {
      this.schedulePlanSilhouetteBake();
    }

    return {
      anchorX,
      anchorZ,
      heading: Math.atan2(dir.x, dir.z),
      fovHalfRad,
      bounds,
      silhouette: this.planSilhouette,
      baking: this.planSilhouetteBaking || this.planSilhouetteDirty,
      activeStorey: this.planMinimapStorey,
    };
  }

  // fallow-ignore-next-line complexity
  async setPlanMinimapStorey(name: string | null): Promise<void> {
    const next = this.resolveStoreyName(name);
    if (this.planMinimapStorey === next && !this.planSilhouetteDirty) return;
    this.planMinimapStorey = next;
    this.planSilhouetteDirty = true;
    this.cancelPlanSilhouetteBakeTimer();

    if (this.cameraMode === "walk" && next) {
      try {
        await this.placeWalkOnStorey(next, true);
      } catch {
        /* Floor teleport is best-effort. */
      }
    }

    await this.bakePlanSilhouetteNow();
  }

  // fallow-ignore-next-line complexity
  async applyPlanMinimapPose(pose: PlanMinimapPose): Promise<void> {
    const world = this.world;
    if (!world) return;
    const controls = world.camera.controls;
    const animate = pose.animate ?? false;

    if (this.cameraMode === "walk") {
      const box = this.getModelBoundingBox();
      if (!this.isValidBox3(box)) return;
      const eyeHeight = this.walkEyeHeight(box);
      const controlsTarget = controls.getTarget(new THREE.Vector3());
      const hintY = this.planMinimapStoreyFloorY ?? controlsTarget.y;
      const pivot = new THREE.Vector3(pose.x, hintY, pose.z);
      const footprint =
        this.planMinimapBoundsCache != null
          ? (() => {
              const b = new THREE.Box3();
              b.min.set(
                this.planMinimapBoundsCache!.minX,
                box.min.y,
                this.planMinimapBoundsCache!.minZ,
              );
              b.max.set(
                this.planMinimapBoundsCache!.maxX,
                box.max.y,
                this.planMinimapBoundsCache!.maxZ,
              );
              return b;
            })()
          : box;
      const eye = this.clampWalkEyePosition(pivot, box, eyeHeight, footprint);
      const dir =
        pose.heading != null
          ? new THREE.Vector3(Math.sin(pose.heading), 0, Math.cos(pose.heading))
          : this.horizontalLookDir();
      const lookTarget = eye.clone().add(dir.multiplyScalar(4));

      await controls.setLookAt(
        eye.x,
        eye.y,
        eye.z,
        lookTarget.x,
        lookTarget.y,
        lookTarget.z,
        animate,
      );
    } else {
      const target = controls.getTarget(new THREE.Vector3());
      const camPos = world.camera.three.position.clone();
      const offset = camPos.clone().sub(target);

      if (pose.heading != null) {
        const horizDist = Math.max(Math.hypot(offset.x, offset.z), 0.001);
        const yOff = offset.y;
        offset.x = -Math.sin(pose.heading) * horizDist;
        offset.z = -Math.cos(pose.heading) * horizDist;
        offset.y = yOff;
      }

      const newTarget = new THREE.Vector3(pose.x, target.y, pose.z);
      const newPos = newTarget.clone().add(offset);
      await controls.setLookAt(
        newPos.x,
        newPos.y,
        newPos.z,
        newTarget.x,
        newTarget.y,
        newTarget.z,
        animate,
      );
      controls.setOrbitPoint(newTarget.x, newTarget.y, newTarget.z);
    }

    await this.mustComponents().get(OBC.FragmentsManager).core.update(true);
    this.bumpRender();
  }

  /** Drag the view cube to orbit the main camera. */
  rotateCameraByDrag(dx: number, dy: number): void {
    if (this.cameraMode !== "orbit") return;
    const controls = this.world?.camera.controls;
    if (!controls) return;
    void controls.rotate(-dx * ROTATE_SENSITIVITY, -dy * ROTATE_SENSITIVITY, false);
    void this.mustComponents().get(OBC.FragmentsManager).core.update(true);
    this.bumpRender();
  }

  /** Animate the main camera to look along an axis (view-cube face click). */
  async snapCameraToDirection(direction: THREE.Vector3): Promise<void> {
    const world = this.mustWorld();
    const controls = world.camera.controls;
    const target = controls.getTarget(new THREE.Vector3());
    const distance = world.camera.three.position.distanceTo(target);
    const pos = direction.clone().normalize().multiplyScalar(distance).add(target);
    await controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    await this.mustComponents().get(OBC.FragmentsManager).core.update(true);
    this.bumpRender();
  }

  private ensureSectionController(): SectionBoxController {
    if (!this.sectionBox) {
      this.sectionBox = new SectionBoxController(
        () => this.world,
        () => this.mustComponents().get(OBC.Clipper),
        () => this.world?.camera.three ?? null,
        () => {
          const world = this.world;
          if (!world) return null;
          return this.mustComponents().get(OBC.Raycasters).get(world);
        },
        () => this.bumpRender(),
      );
    }
    return this.sectionBox;
  }

  /** Large IFC models are usually mm; smaller bounds suggest metres. */
  private detectModelUnits(): "m" | "mm" {
    const sphere = this.getModelBoundingSphere();
    if (!sphere || !Number.isFinite(sphere.radius)) return "m";
    return sphere.radius > 500 ? "mm" : "m";
  }

  private pointerNormFromEvent(e: PointerEvent): { x: number; y: number } | null {
    const container = this.container;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  /** Arm click-to-place issue mode on the 3D canvas (pass null to disable). */
  setIssuePlacementPick(handler: ((normX: number, normY: number) => void) | null): void {
    this.issuePlacementPick = handler;
  }

  private pointerNdc(e: PointerEvent): THREE.Vector2 {
    const canvas = this.world!.renderer!.three.domElement;
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  // fallow-ignore-next-line complexity
  private async castPickAtPointer(
    e: PointerEvent,
    snappingClasses?: FRAGS.SnappingClass[],
  ): Promise<{
    point: THREE.Vector3;
    normal?: THREE.Vector3;
    localId?: number;
    modelId?: string;
  } | null> {
    const world = this.mustWorld();
    const components = this.mustComponents();
    const fragments = components.get(OBC.FragmentsManager);

    const ndc = this.pointerNdc(e);
    const caster = components.get(OBC.Raycasters).get(world);
    const hit = await caster.castRay({
      position: ndc,
      snappingClasses: snappingClasses?.length ? snappingClasses : undefined,
    });

    if (hit?.point) {
      const model = this.isFragmentPick(hit) ? hit.fragments : undefined;
      const raw = hit as { localId?: number };
      return {
        point: hit.point,
        normal: hit.normal,
        localId: typeof raw.localId === "number" ? raw.localId : undefined,
        modelId: model?.modelId,
      };
    }

    const canvas = world.renderer!.three.domElement;
    const fragHit = await fragments.raycast({
      camera: world.camera.three as THREE.PerspectiveCamera,
      mouse: new THREE.Vector2(e.clientX, e.clientY),
      dom: canvas,
      ...(snappingClasses?.length ? { snappingClasses } : {}),
    });
    if (!fragHit?.point) return null;
    return {
      point: fragHit.point,
      normal: fragHit.normal,
      localId: fragHit.localId,
      modelId: fragHit.fragments.modelId,
    };
  }

  /** Fast element pick for select — one GPU id pass, no worker fence or snapping. */
  // fallow-ignore-next-line complexity
  private async fastPickElement(
    e: PointerEvent,
  ): Promise<{ modelId: string; localId: number } | null> {
    const world = this.world;
    const components = this.components;
    if (!world?.renderer || !components) return null;

    const fragments = components.get(OBC.FragmentsManager);
    if (!fragments.initialized || fragments.list.size === 0) return null;

    const ndc = this.pointerNdc(e);
    const item = await components.get(OBC.FastModelPickers).get(world).getItemAt(ndc);
    if (item) return { modelId: item.modelId, localId: item.localId };

    const hit = await fragments.raycast({
      camera: world.camera.three as THREE.PerspectiveCamera,
      mouse: new THREE.Vector2(e.clientX, e.clientY),
      dom: world.renderer.three.domElement,
    });
    if (hit?.localId == null) return null;
    return { modelId: hit.fragments.modelId, localId: hit.localId };
  }

  private bumpRender(): void {
    const world = this.world;
    if (world?.renderer && "update" in world.renderer) {
      (world.renderer as OBF.RendererWith2D & { update: () => void }).update();
    }
  }

  /** Re-apply PBR + space colors when fragments stream in new tile materials. */
  // fallow-ignore-next-line complexity
  private scheduleMaterialSync(): void {
    if (this.disposed || this.modelRegistry.size === 0 || this.materialSyncInProgress) return;
    // PBR recolor fights fragment highlights — defer until overlays are cleared.
    if (this.hasActiveFragmentHighlights()) {
      this.pendingMaterialSync = true;
      return;
    }
    if (this.materialSyncTimer != null) window.clearTimeout(this.materialSyncTimer);
    this.materialSyncTimer = window.setTimeout(() => {
      this.materialSyncTimer = null;
      void this.syncViewportMaterials().then(() => this.bumpRender());
    }, 120);
  }

  /** Keep fog hue in sync with camera height while orbiting (throttled). */
  private refreshAtmosphereIfNeeded(): void {
    if (this.disposed || this.appearance.fogMode === "off") return;
    const now = performance.now();
    if (now - this.lastAtmosphereRefresh < 180) return;
    this.lastAtmosphereRefresh = now;
    this.applyViewportAtmosphere(this.getModelBoundingSphere());
  }

  /** Wait for fragments + renderer to finish the current frame before readback. */
  private async flushRender(): Promise<void> {
    if (this.disposed) return;
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (fragments?.initialized) {
      await fragments.core.update(true);
    }
    this.bumpRender();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        this.bumpRender();
        requestAnimationFrame(() => resolve());
      });
    });
  }

  /** Keeps the That Open raycaster mouse in sync with the latest pointer coords. */
  private syncPointerForRaycast(e: PointerEvent): void {
    const canvas = this.world?.renderer?.three.domElement;
    if (!canvas) return;
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
        bubbles: true,
      }),
    );
  }

  private isFragmentPick(
    hit: unknown,
  ): hit is { localId: number; fragments: FRAGS.FragmentsModel } {
    if (!hit || typeof hit !== "object") return false;
    const candidate = hit as { localId?: unknown; fragments?: unknown };
    return typeof candidate.localId === "number" && candidate.fragments != null;
  }

  /** Sky gradient + camera-aware atmospheric fog. */
  // fallow-ignore-next-line complexity
  private applyViewportAtmosphere(sphere: THREE.Sphere | null): void {
    const world = this.world;
    if (!world) return;

    if (!this.viewportBackground) {
      this.viewportBackground = createBimSkyTexture(this.appearance.environment);
      world.scene.three.background = this.viewportBackground;
    }

    if (sphere && sphere.radius > 0) {
      const sky = getViewportColors(this.appearance.environment);
      const fogScale = fogDistanceScales(this.appearance.fogMode);
      if (!fogScale) {
        world.scene.three.fog = null;
        return;
      }
      const radius = Math.max(sphere.radius, 1);
      const fogColor = resolveFogColor(this.appearance.environment, sphere, world.camera.three);
      const baseNear = radius * 0.42 * sky.fogNearScale;
      const baseFar = radius * 3.2 * sky.fogFarScale;
      world.scene.three.fog = new THREE.Fog(
        fogColor,
        baseNear * fogScale.near,
        baseFar * fogScale.far,
      );
    } else {
      world.scene.three.fog = null;
    }
  }

  private configureRendererContainer(renderer: OBF.RendererWith2D, container: HTMLElement): void {
    renderer.showLogo = false;
    container.style.position = "relative";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.overflow = "hidden";
    container.style.background = VIEWPORT_BG;
    container.style.pointerEvents = "auto";

    const canvas = renderer.three.domElement;
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.zIndex = "1";

    // RendererWith2D adds a CSS2D overlay sibling — stretch it too.
    const css2d = renderer.three2D?.domElement;
    if (css2d) {
      css2d.style.position = "absolute";
      css2d.style.inset = "0";
      css2d.style.width = "100%";
      css2d.style.height = "100%";
      css2d.style.pointerEvents = "none";
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed) return;
      this.syncRendererSize(renderer);
    });
    this.resizeObserver.observe(container);
    requestAnimationFrame(() => this.syncRendererSize(renderer));
  }

  /** Match WebGL + CSS2D renderers to the container's laid-out pixel size. */
  // fallow-ignore-next-line complexity
  private syncRendererSize(renderer: OBF.RendererWith2D): void {
    const container = this.container;
    if (!container) return;
    const w = Math.floor(container.clientWidth);
    const h = Math.floor(container.clientHeight);
    if (w < MIN_CANVAS_PX || h < MIN_CANVAS_PX) return;

    renderer.resize(new THREE.Vector2(w, h));
    renderer.three.setPixelRatio(bimViewportPixelRatio());

    const canvas = renderer.three.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const css2d = renderer.three2D?.domElement;
    if (css2d) {
      css2d.style.width = "100%";
      css2d.style.height = "100%";
    }

    const world = this.world;
    if (world && "updateAspect" in world.camera) {
      (world.camera as OBC.OrthoPerspectiveCamera & { updateAspect: () => void }).updateAspect();
    }
    if (this.components) {
      void this.components.get(OBC.FragmentsManager).core.update(true);
    }
  }

  // fallow-ignore-next-line complexity
  private async buildClassifications(): Promise<void> {
    if (this.disposed) return;
    const components = this.mustComponents();
    const classifier = components.get(OBC.Classifier);
    const finder = components.get(OBC.ItemsFinder);
    const fragments = components.get(OBC.FragmentsManager);

    // ThatOpen's byCategory only registers *new* finder queries, and FinderQuery
    // caches the first result — so linked models never join Visibility until we
    // clear and rebind groups across every loaded model.
    classifier.list.delete(STOREY_CLASSIFICATION);
    classifier.list.delete(CATEGORY_CLASSIFICATION);
    for (const [, query] of finder.list) {
      query.clearCache();
    }

    await classifier.byIfcBuildingStorey({ classificationName: STOREY_CLASSIFICATION });

    const allCategories = new Set<string>();
    for (const [, model] of fragments.list) {
      const cats = await model.getItemsWithGeometryCategories();
      for (const category of cats) {
        if (category) allCategories.add(category);
      }
    }
    for (const category of allCategories) {
      if (!finder.list.has(category)) {
        finder.create(category, [{ categories: [new RegExp(`^${category}$`)] }]);
      } else {
        finder.list.get(category)?.clearCache();
      }
      classifier.setGroupQuery(CATEGORY_CLASSIFICATION, category, { name: category });
    }

    this.storeyMaps.clear();
    this.categoryMaps.clear();
    this.storeyByModelLocalId.clear();

    const prevStoreyVisible = new Map(this.storeyVisible);
    const prevCategoryVisible = new Map(this.categoryVisible);
    this.storeyVisible.clear();
    this.categoryVisible.clear();

    const storeys = classifier.list.get(STOREY_CLASSIFICATION);
    if (storeys) {
      for (const [name, data] of storeys) {
        const map = await data.get();
        this.storeyMaps.set(name, map);
        this.storeyVisible.set(name, prevStoreyVisible.get(name) ?? true);
        for (const [mid, ids] of Object.entries(map)) {
          for (const id of ids) this.storeyByModelLocalId.set(modelLocalKey(mid, id), name);
        }
      }
    }
    const categories = classifier.list.get(CATEGORY_CLASSIFICATION);
    if (categories) {
      for (const [name, data] of categories) {
        // Force a fresh query so caches cannot stick to the first model only.
        const query = finder.list.get(name);
        query?.clearCache();
        const map = await data.get();
        this.categoryMaps.set(name, map);
        this.categoryVisible.set(name, prevCategoryVisible.get(name) ?? true);
      }
    }

    // Re-apply hide state so newly linked models respect existing toggles.
    await this.reapplyGroupVisibility();

    this.emitGroups();
  }

  private emitGroups(): void {
    this.events.onGroupsChanged({
      storeys: [...this.storeyMaps.keys()].map((name) => ({
        name,
        visible: this.storeyVisible.get(name) ?? true,
      })),
      categories: [...this.categoryMaps.keys()]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          name,
          visible: this.categoryVisible.get(name) ?? true,
        })),
    });
  }

  // fallow-ignore-next-line unused-class-member
  async setGroupVisible(
    kind: "storey" | "category",
    name: string,
    visible: boolean,
  ): Promise<void> {
    const map = kind === "storey" ? this.storeyMaps.get(name) : this.categoryMaps.get(name);
    if (!map) return;
    (kind === "storey" ? this.storeyVisible : this.categoryVisible).set(name, visible);
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.set(visible, map);
    this.emitGroups();
    this.invalidatePlanSilhouette();
  }

  async showAllGroups(): Promise<void> {
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.set(true);
    for (const k of this.storeyVisible.keys()) this.storeyVisible.set(k, true);
    for (const k of this.categoryVisible.keys()) this.categoryVisible.set(k, true);
    this.emitGroups();
    this.invalidatePlanSilhouette();
  }

  /**
   * Toggle Autodesk-style visual clustering: elements of each IFC type are
   * packed into a tight pile, piles sit close together, then the camera flies
   * to an elevated overview.
   */
  // fallow-ignore-next-line complexity
  async setClusterByType(enabled: boolean): Promise<void> {
    if (enabled === this.clusterByTypeActive) return;
    if (!enabled) {
      await this.clearClusterByType();
      await this.flyToClusterScene(false);
      return;
    }
    if (this.categoryMaps.size === 0) {
      throw new Error("No element types available to cluster.");
    }

    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const editor = fragments.core.editor;
    const packs: ClusterCategoryPack[] = [];
    const backup: ClusterTransformBackup = new Map();

    const names = [...this.categoryMaps.keys()].sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      if (!shouldClusterType(name)) continue;
      if (!(this.categoryVisible.get(name) ?? true)) continue;
      const map = this.categoryMaps.get(name);
      if (!map) continue;
      const units = await this.collectClusterPackUnits(map, backup);
      if (units.length === 0) continue;
      packs.push({ name, units });
    }
    if (packs.length === 0) {
      throw new Error("No visible element types to cluster.");
    }

    const { offsets, labels } = computeTightClusterOffsets(packs);
    for (const [modelId, byTransform] of offsets) {
      const model = fragments.list.get(modelId);
      if (!model) continue;
      await applyTransformOffsets(editor, modelId, model, byTransform);
    }

    this.clusterTransformBackup = backup;
    this.clusterByTypeActive = true;
    this.showClusterTypeLabels(labels);
    await fragments.core.update(true);
    this.invalidatePlanSilhouette();
    this.bumpRender();
    await this.flyToClusterScene(true);
  }

  /** Build pack units (unique transforms) and snapshot originals into backup. */
  // fallow-ignore-next-line complexity
  private async collectClusterPackUnits(
    map: OBC.ModelIdMap,
    backup: ClusterTransformBackup,
  ): Promise<ClusterPackUnit[]> {
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const units: ClusterPackUnit[] = [];
    const seen = new Set<string>();

    for (const [modelId, idSet] of Object.entries(map)) {
      const model = fragments.list.get(modelId);
      if (!model || idSet.size === 0) continue;
      const itemIds = [...idSet];
      let modelBackup = backup.get(modelId);
      if (!modelBackup) {
        modelBackup = new Map();
        backup.set(modelId, modelBackup);
      }
      await backupGlobalTransforms(model, itemIds, modelBackup);
      const itemToTransform = await mapItemsToTransformIds(model, itemIds);

      for (let i = 0; i < itemIds.length; i += 200) {
        const chunk = itemIds.slice(i, i + 200);
        let boxes: THREE.Box3[] = [];
        try {
          boxes = await model.getBoxes(chunk);
        } catch {
          boxes = [];
        }
        for (let j = 0; j < chunk.length; j++) {
          const itemId = chunk[j]!;
          const transformLocalId = itemToTransform.get(itemId);
          if (transformLocalId == null) continue;
          const key = `${modelId}:${transformLocalId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const box = boxes[j];
          if (!box || !this.isValidBox3(box)) continue;
          units.push({ modelId, transformLocalId, box: box.clone() });
        }
      }
    }
    return units;
  }

  /** Smooth elevated overview (cluster on) or animated fit-to-model (cluster off). */
  // fallow-ignore-next-line complexity
  private async flyToClusterScene(clustered: boolean): Promise<void> {
    const world = this.world;
    const controls = world?.camera?.controls;
    if (!world || !controls) {
      await this.fitToView();
      return;
    }
    await this.mustComponents().get(OBC.FragmentsManager).core.update(true);
    const box = this.getModelBoundingBox();
    if (!this.isValidBox3(box)) {
      await this.fitToView();
      return;
    }

    const prevSmooth = controls.smoothTime;
    // Slightly longer ease for a cinematic reveal / restore.
    controls.smoothTime = Math.max(prevSmooth, 0.55);

    try {
      if (!clustered) {
        await this.fitToView();
        return;
      }

      const { eye, target, sphere } = computeClusterCameraPose(box);
      this.adjustCameraClipping(sphere);
      await controls.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true);
      controls.setOrbitPoint(target.x, target.y, target.z);
      this.bumpRender();
    } finally {
      controls.smoothTime = prevSmooth;
    }
  }

  // fallow-ignore-next-line complexity
  private showClusterTypeLabels(labels: ClusterTypeLabel[]): void {
    this.clearClusterTypeLabels();
    const world = this.world;
    if (!world || labels.length === 0) return;

    const root = new THREE.Group();
    root.name = "bim-cluster-labels";
    for (const label of labels) {
      const el = document.createElement("div");
      el.className = "bim-cluster-type-label";
      el.setAttribute("role", "text");
      const title = document.createElement("span");
      title.className = "bim-cluster-type-label__title";
      title.textContent = label.title;
      const count = document.createElement("span");
      count.className = "bim-cluster-type-label__count";
      count.textContent = `${label.count.toLocaleString()} ${label.count === 1 ? "element" : "elements"}`;
      el.append(title, count);

      const obj = new CSS2DObject(el);
      obj.position.copy(label.position);
      root.add(obj);
    }
    world.scene.three.add(root);
    this.clusterLabelRoot = root;
  }

  private clearClusterTypeLabels(): void {
    const root = this.clusterLabelRoot;
    if (!root) return;
    root.removeFromParent();
    for (const child of [...root.children]) {
      const obj = child as CSS2DObject;
      obj.element?.remove();
      root.remove(child);
    }
    this.clusterLabelRoot = null;
  }

  // fallow-ignore-next-line complexity
  private async clearClusterByType(): Promise<void> {
    if (!this.clusterByTypeActive && this.clusterTransformBackup.size === 0) return;
    this.clearClusterTypeLabels();
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (fragments?.initialized) {
      const editor = fragments.core.editor;
      for (const [modelId, backup] of this.clusterTransformBackup) {
        if (!fragments.list.has(modelId)) continue;
        try {
          await restoreGlobalTransforms(editor, modelId, backup);
        } catch {
          /* model may have been removed */
        }
      }
      await fragments.core.update(true);
    }
    this.clusterTransformBackup.clear();
    this.clusterByTypeActive = false;
    this.invalidatePlanSilhouette();
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  private async handleHighlight(map: OBC.ModelIdMap, preferModelId?: string | null): Promise<void> {
    const preferred =
      preferModelId && map[preferModelId] instanceof Set && map[preferModelId]!.size > 0
        ? preferModelId
        : null;
    const entry = preferred
      ? ([preferred, map[preferred]!] as [string, Set<number>])
      : Object.entries(map)[0];
    if (!entry) {
      this.events.onSelection(null);
      return;
    }
    const [modelId, idSet] = entry;
    const localId = [...idSet][0];
    if (localId == null) {
      this.events.onSelection(null);
      return;
    }
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const model = fragments.list.get(modelId);
    if (!model) return;

    const loadId = ++this.selectionLoadId;

    try {
      const [[data], [guid]] = await Promise.all([
        model.getItemsData([localId], {
          attributesDefault: true,
          relationsDefault: { attributes: false, relations: false },
        }),
        model.getGuidsByLocalIds([localId]),
      ]);
      if (loadId !== this.selectionLoadId) return;

      const ifcType = data._category ? attrValue(data, "_category") : null;
      const meta = this.modelRegistry.get(modelId);
      this.events.onSelection({
        modelId,
        fileVersionId: meta?.fileVersionId ?? null,
        sourceLabel: meta?.name ?? null,
        localId,
        ifcGuid: guid ?? attrValue(data, "_guid") ?? attrValue(data, "GlobalId"),
        name: attrValue(data, "Name"),
        ifcType,
        storey: this.storeyByModelLocalId.get(modelLocalKey(modelId, localId)) ?? null,
        position: null,
        attributes: flattenAttributes(data),
        psets: [],
        detailsPending: true,
      });

      const [fullData] = await model.getItemsData([localId], {
        attributesDefault: true,
        relationsDefault: { attributes: true, relations: false },
        relations: {
          IsDefinedBy: { attributes: true, relations: true },
          HasProperties: { attributes: true, relations: true },
          Quantities: { attributes: true, relations: true },
          ContainedInStructure: { attributes: true, relations: true },
          IsTypedBy: { attributes: true, relations: true },
          Decomposes: { attributes: true, relations: false },
        },
      });
      if (loadId !== this.selectionLoadId) return;

      let position: { x: number; y: number; z: number } | null = null;
      position = await this.getElementAnchorPosition(model, localId);
      if (loadId !== this.selectionLoadId) return;

      this.events.onSelection({
        modelId,
        fileVersionId: meta?.fileVersionId ?? null,
        sourceLabel: meta?.name ?? null,
        localId,
        ifcGuid: guid ?? attrValue(fullData, "_guid") ?? attrValue(fullData, "GlobalId"),
        name: attrValue(fullData, "Name"),
        ifcType: fullData._category ? attrValue(fullData, "_category") : ifcType,
        storey: this.storeyByModelLocalId.get(modelLocalKey(modelId, localId)) ?? null,
        position,
        attributes: flattenAttributes(fullData),
        psets: extractPsets(fullData),
        detailsPending: false,
      });
    } catch {
      if (loadId === this.selectionLoadId) this.events.onSelection(null);
    }
  }

  clearSelection(): void {
    this.selectedGuids.clear();
    this.lastPickMap = null;
    this.lastPickedModelId = null;
    void this.requestFragmentHighlights();
    this.events.onSelection(null);
    this.events.onMultiSelection?.([]);
  }

  // ---------------------------------------------------------------- tools

  // fallow-ignore-next-line complexity
  setTool(tool: BimTool): void {
    this.tool = tool;
    const components = this.mustComponents();
    const clipper = components.get(OBC.Clipper);
    clipper.enabled = tool === "clip";
    components.get(OBF.LengthMeasurement).enabled = tool === "length";
    components.get(OBF.AreaMeasurement).enabled = tool === "area";
    components.get(OBF.AngleMeasurement).enabled = tool === "angle";
    const highlighter = components.get(OBF.Highlighter);
    highlighter.config.selectEnabled = tool === "select";
    highlighter.enabled = true;
    this.syncHoverEnabled();
    if (tool !== "select" && tool !== "markup") this.clearSelection();
    if (tool !== "clip") {
      this.sectionBox?.deactivate();
    } else {
      const box = this.getModelBoundingBox();
      if (box) {
        this.ensureSectionController();
        this.sectionBox?.activate(box);
      }
    }
    this.applyBim360Navigation();
    this.events.onToolChange?.(tool);
  }

  // fallow-ignore-next-line complexity
  private activeMeasurement():
    | OBF.LengthMeasurement
    | OBF.AreaMeasurement
    | OBF.AngleMeasurement
    | null {
    const components = this.components;
    if (!components) return null;
    if (this.tool === "length") return components.get(OBF.LengthMeasurement);
    if (this.tool === "area") return components.get(OBF.AreaMeasurement);
    if (this.tool === "angle") return components.get(OBF.AngleMeasurement);
    return null;
  }

  /** Confirms the in-progress measurement point (mobile button). */
  // fallow-ignore-next-line unused-class-member
  measureConfirmPoint(): void {
    const m = this.activeMeasurement();
    if (m) void m.create();
  }

  // fallow-ignore-next-line unused-class-member
  deleteMeasurements(): void {
    const components = this.components;
    if (!components) return;
    components.get(OBF.LengthMeasurement).list.clear();
    components.get(OBF.AreaMeasurement).list.clear();
    components.get(OBF.AngleMeasurement).list.clear();
  }

  deleteClippingPlanes(): void {
    this.sectionBox?.deactivate();
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  private onGlobalKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.key === "Escape") {
      if (this.tool === "clip") {
        this.deleteClippingPlanes();
        this.setTool("select");
        return;
      }
      this.activeMeasurement()?.cancelCreation();
      this.clearSelection();
      this.events.onSelection(null);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.tool === "select" && this.selectedGuids.size > 0) {
        void this.hideSelection();
        return;
      }
      if (this.tool === "clip") {
        this.deleteClippingPlanes();
        const box = this.getModelBoundingBox();
        if (box) {
          this.ensureSectionController();
          this.sectionBox?.activate(box);
        }
        this.bumpRender();
        return;
      }
      this.activeMeasurement()?.delete();
      this.bumpRender();
    }
  };

  // fallow-ignore-next-line complexity
  private onCanvasContextMenu = (e: MouseEvent): void => {
    if (this.disposed || !this.container) return;
    const canvas = this.world?.renderer?.three.domElement;
    if (!canvas) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest(".bim-view-cube, .bim-plan-minimap")) return;

    const rect = canvas.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const initialHasSelection = this.selectedGuids.size > 0 || this.lastPickMap != null;
    this.events.onContextMenu?.({
      x: e.clientX,
      y: e.clientY,
      hasSelection: initialHasSelection,
    });
    void this.refineContextMenuPick(e, initialHasSelection);
  };

  // fallow-ignore-next-line complexity
  private async refineContextMenuPick(e: MouseEvent, initialHasSelection: boolean): Promise<void> {
    const pickPromise = this.selectAtPointer(e as unknown as PointerEvent, {
      additive: e.ctrlKey || e.metaKey,
      forContextMenu: true,
    });
    this.contextMenuPickPromise = pickPromise;
    try {
      const picked = await pickPromise;
      if (picked !== initialHasSelection) {
        this.events.onContextMenu?.({
          x: e.clientX,
          y: e.clientY,
          hasSelection: picked,
        });
      }
    } catch {
      /* keep the menu that was shown synchronously */
    } finally {
      if (this.contextMenuPickPromise === pickPromise) {
        this.contextMenuPickPromise = null;
      }
    }
  }

  /** Wait for an in-flight context-menu pick before running selection actions. */
  async flushContextMenuPick(): Promise<void> {
    if (this.contextMenuPickPromise) {
      await this.contextMenuPickPromise;
    }
  }

  // fallow-ignore-next-line complexity
  private onCanvasPointerDown = (e: PointerEvent): void => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
    this.pointerMoved = false;

    if (this.tool !== "clip" || e.button !== 0) return;

    if (!this.sectionBox?.isActive()) return;

    const ndc = this.pointerNdc(e);
    const pick = this.sectionBox.pick(ndc);
    if (!pick) return;

    const startPointerT = this.sectionBox.pointerAxisT(pick.handle, pick.plane.origin, ndc);
    if (startPointerT == null) return;

    this.sectionBox.beginDrag(pick.handle, pick.plane, startPointerT);
    if (this.world) this.world.camera.enabled = false;
    this.container?.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    const dx = e.clientX - this.pointerDown.x;
    const dy = e.clientY - this.pointerDown.y;
    if (Math.hypot(dx, dy) > POINTER_CLICK_THRESHOLD_PX) this.pointerMoved = true;

    if (this.sectionBox?.isDragging()) {
      this.sectionBox.pointerMove(this.pointerNdc(e));
      e.preventDefault();
    }
  };

  // fallow-ignore-next-line complexity
  private onCanvasPointerUp = (e: PointerEvent): void => {
    if (this.sectionBox?.isDragging()) {
      this.sectionBox.endDrag();
      if (this.world) this.world.camera.enabled = true;
      this.container?.releasePointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (e.button !== 0 || this.pointerMoved) return;

    if (this.issuePlacementPick) {
      const norm = this.pointerNormFromEvent(e);
      if (norm) this.issuePlacementPick(norm.x, norm.y);
      return;
    }

    if (this.tool === "markup") return;

    if (this.cameraMode === "walk") return;

    const now = Date.now();
    if (now - this.lastClickTime < 350) {
      void this.zoomToSelection();
      this.lastClickTime = 0;
      return;
    }
    this.lastClickTime = now;
    void this.handleCanvasPointerUp(e);
  };

  // fallow-ignore-next-line complexity
  private async handleCanvasPointerUp(e: PointerEvent): Promise<void> {
    const world = this.world;
    const components = this.components;
    if (!world?.renderer || !components) return;

    if (this.tool === "select" && this.cameraMode !== "walk") {
      this.pickSelection(e);
      return;
    }
    if (this.tool === "clip") return;

    this.syncPointerForRaycast(e);
    const m = this.activeMeasurement();
    if (m) {
      await m.create();
      this.bumpRender();
    }
  }

  /** Raycast at the pointer location and highlight the hit element. */
  private pickSelection(e: PointerEvent): void {
    void this.selectAtPointer(e, { additive: e.ctrlKey || e.metaKey });
  }

  // fallow-ignore-next-line complexity
  private async selectAtPointer(
    e: PointerEvent,
    opts: { additive?: boolean; forContextMenu?: boolean } = {},
  ): Promise<boolean> {
    const components = this.components;
    if (!components || !this.model) return false;
    if (this.tool !== "select" && !opts.forContextMenu) return false;

    const hit = await this.fastPickElement(e);
    if (!hit) {
      if (opts.forContextMenu) {
        return this.selectedGuids.size > 0 || this.lastPickMap != null;
      }
      if (!opts.additive) this.clearSelection();
      return false;
    }

    const fragments = components.get(OBC.FragmentsManager);
    const model = fragments.list.get(hit.modelId);
    let guid: string | null = null;
    if (model) {
      try {
        const [g] = await model.getGuidsByLocalIds([hit.localId]);
        guid = g ?? null;
      } catch {
        /* optional */
      }
    }

    const pickMap: OBC.ModelIdMap | null = hit ? { [hit.modelId]: new Set([hit.localId]) } : null;

    const additive = opts.additive ?? false;
    if (opts.forContextMenu) {
      if (guid) {
        if (!additive) {
          this.selectedGuids.clear();
          this.selectedGuids.add(guid);
        } else if (!this.selectedGuids.has(guid)) {
          this.selectedGuids.add(guid);
        }
      } else if (!additive) {
        this.selectedGuids.clear();
      }
    } else if (guid) {
      if (this.selectedGuids.has(guid)) {
        this.selectedGuids.delete(guid);
        if (this.selectedGuids.size === 0) {
          this.clearSelection();
          return false;
        }
      } else if (additive) {
        this.selectedGuids.add(guid);
      } else {
        this.selectedGuids.clear();
        this.selectedGuids.add(guid);
      }
    } else if (!additive) {
      this.selectedGuids.clear();
    }

    if (guid && hit) {
      const meta = this.modelRegistry.get(hit.modelId);
      this.guidIndex.set(guid, {
        modelId: hit.modelId,
        localId: hit.localId,
        fileVersionId: meta?.fileVersionId ?? "",
        sourceLabel: meta?.name ?? "Model",
      });
    }

    let map: OBC.ModelIdMap | null = null;
    if (this.selectedGuids.size > 0) {
      map = await this.resolveModelIdMapFromGuids([...this.selectedGuids]);
    }
    if (!map && pickMap) {
      map = pickMap;
    } else if (map && pickMap && hit) {
      if (!map[hit.modelId]) map[hit.modelId] = new Set<number>();
      (map[hit.modelId] as Set<number>).add(hit.localId);
    }

    if (!map) {
      if (!additive) this.clearSelection();
      return false;
    }

    this.lastPickMap = map;
    this.lastPickedModelId = hit.modelId;
    await this.requestFragmentHighlights();
    await this.handleHighlight(map, hit.modelId);
    this.bumpRender();
    this.events.onMultiSelection?.([...this.selectedGuids]);
    return true;
  }

  // --------------------------------------------------------------- camera

  async setCameraMode(mode: BimCameraMode): Promise<void> {
    const world = this.mustWorld();
    this.cameraMode = mode;
    try {
      if (mode === "walk") {
        const walkPivot = world.camera.controls.getTarget(new THREE.Vector3()).clone();
        try {
          await world.camera.projection.set("Perspective");
        } catch {
          /* use current projection */
        }
        try {
          world.camera.set("FirstPerson");
        } catch {
          /* orbit camera still supports forward/truck walk controls */
        }
        world.camera.controls.dollySpeed = 1.2;
        this.applyWalkNavigation();
        await this.enterWalkCamera(walkPivot);
        this.startWalkLoop();
        this.planSilhouetteDirty = true;
        this.schedulePlanSilhouetteBake();
      } else {
        world.camera.set("Orbit");
        this.stopWalkLoop();
        this.applyBim360Navigation();
      }
    } finally {
      this.syncHoverEnabled();
      this.syncViewportOverlays();
      this.bumpRender();
    }
  }

  // fallow-ignore-next-line unused-class-member
  async toggleProjection(): Promise<void> {
    const world = this.mustWorld();
    if (this.cameraMode === "walk") return;
    await world.camera.projection.toggle();
  }

  /** Builds a bounding box from all loaded fragment models (world space). */
  // fallow-ignore-next-line complexity
  private getModelBoundingBox(): THREE.Box3 | null {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized || fragments.list.size === 0) return null;
    const box = new THREE.Box3();
    for (const [, model] of fragments.list) {
      const modelBox = model.box;
      if (modelBox.isEmpty()) {
        box.union(new THREE.Box3().setFromObject(model.object));
        continue;
      }
      box.union(modelBox);
    }
    return box.isEmpty() ? null : box;
  }

  /** Builds a bounding sphere from all loaded fragment models. */
  private getModelBoundingSphere(): THREE.Sphere | null {
    const box = this.getModelBoundingBox();
    if (!box) return null;
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return sphere;
  }

  async fitToView(): Promise<void> {
    const world = this.mustWorld();
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    await fragments.core.update(true);
    this.syncRendererSize(world.renderer!);
    const sphere = this.getModelBoundingSphere();
    if (sphere && sphere.radius > 0 && Number.isFinite(sphere.radius)) {
      this.adjustCameraClipping(sphere);
      // Slightly shrink the bound so the model fills more of the viewport.
      const fitSphere = sphere.clone();
      fitSphere.radius *= 0.82;
      await world.camera.controls.fitToSphere(fitSphere, true);
      world.camera.controls.setOrbitPoint(sphere.center.x, sphere.center.y, sphere.center.z);
    } else {
      await world.camera.fitToItems();
    }
  }

  /** Virtual joystick input from touch UI: values in [-1, 1]. */
  // fallow-ignore-next-line unused-class-member
  setWalkInput(forward: number, strafe: number): void {
    this.walkJoystick.forward = forward;
    this.walkJoystick.strafe = strafe;
  }

  // fallow-ignore-next-line complexity
  private onWalkKeyDown = (e: KeyboardEvent): void => {
    if (this.cameraMode !== "walk") return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    this.walkKeys.add(e.key.toLowerCase());
  };

  private onWalkKeyUp = (e: KeyboardEvent): void => {
    this.walkKeys.delete(e.key.toLowerCase());
  };

  private startWalkLoop(): void {
    if (this.walkRaf != null) return;
    this.walkLastTime = performance.now();
    const step = (now: number) => {
      if (this.disposed || this.cameraMode !== "walk") {
        this.walkRaf = null;
        return;
      }
      const dt = Math.min((now - this.walkLastTime) / 1000, 0.1);
      this.walkLastTime = now;
      this.applyWalkStep(dt, now);
      this.syncViewportOverlays();
      this.walkRaf = requestAnimationFrame(step);
    };
    this.walkRaf = requestAnimationFrame(step);
  }

  private stopWalkLoop(): void {
    if (this.walkRaf != null) cancelAnimationFrame(this.walkRaf);
    this.walkRaf = null;
    this.walkKeys.clear();
    this.walkJoystick = { forward: 0, strafe: 0 };
  }

  // fallow-ignore-next-line complexity
  private applyWalkStep(dt: number, now: number): void {
    const world = this.world;
    if (!world) return;
    let forward = this.walkJoystick.forward;
    let strafe = this.walkJoystick.strafe;
    if (this.walkKeys.has("w") || this.walkKeys.has("arrowup")) forward += 1;
    if (this.walkKeys.has("s") || this.walkKeys.has("arrowdown")) forward -= 1;
    if (this.walkKeys.has("d") || this.walkKeys.has("arrowright")) strafe += 1;
    if (this.walkKeys.has("a") || this.walkKeys.has("arrowleft")) strafe -= 1;
    forward = Math.max(-1, Math.min(1, forward));
    strafe = Math.max(-1, Math.min(1, strafe));
    if (forward === 0 && strafe === 0) return;

    // Collision: poll the distance to whatever is dead-ahead (screen centre)
    // and stop forward motion when a wall is within reach.
    if (forward > 0) {
      if (now - this.walkLastCollisionPoll > WALK_COLLISION_POLL_MS) {
        this.walkLastCollisionPoll = now;
        void this.pollForwardCollision();
      }
      if (
        this.walkBlockedUntilDistance != null &&
        this.walkBlockedUntilDistance < WALK_COLLISION_DISTANCE
      ) {
        forward = 0;
      }
    }

    const controls = world.camera.controls;
    if (forward !== 0) controls.forward(forward * WALK_SPEED * dt, false);
    if (strafe !== 0) controls.truck(strafe * WALK_SPEED * dt, 0, false);
    if (forward !== 0 || strafe !== 0) this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  private async pollForwardCollision(): Promise<void> {
    const world = this.world;
    const components = this.components;
    const container = this.container;
    if (!world || !components || !container) return;
    const canvas = world.renderer?.three.domElement;
    if (!canvas) return;
    try {
      const fragments = components.get(OBC.FragmentsManager);
      const rect = canvas.getBoundingClientRect();
      const centre = new THREE.Vector2(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const hit = await fragments.raycast({
        camera: world.camera.three as THREE.PerspectiveCamera,
        mouse: centre,
        dom: canvas,
      });
      this.walkBlockedUntilDistance = hit ? hit.distance : null;
    } catch {
      this.walkBlockedUntilDistance = null;
    }
  }

  /** Server-built quantity catalog for fast search / takeoff. */
  // fallow-ignore-next-line unused-class-member
  setQuantityIndex(index: BimQuantityIndex | null): void {
    this.quantityIndex = index;
    void this.syncGuidLocalIdMap().then(() => this.refreshIssueAnchorWorld());
  }

  getSelectedGuids(): string[] {
    return [...this.selectedGuids];
  }

  // fallow-ignore-next-line complexity
  private async syncGuidLocalIdMap(): Promise<void> {
    this.guidIndex.clear();
    const index = this.quantityIndex;
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!index || !fragments?.initialized) return;

    const modelBuckets = new Map<
      string,
      {
        guids: string[];
        meta: Map<string, { fileVersionId: string; sourceLabel: string }>;
      }
    >();

    for (const el of index.elements) {
      const modelId = el.sourceModelId ?? this.primaryModelId;
      const fileVersionId =
        el.sourceFileVersionId ?? this.modelRegistry.get(modelId)?.fileVersionId;
      const sourceLabel = el.sourceLabel ?? this.modelRegistry.get(modelId)?.name ?? null;
      if (!modelId || !fileVersionId) continue;

      let bucket = modelBuckets.get(modelId);
      if (!bucket) {
        bucket = { guids: [], meta: new Map() };
        modelBuckets.set(modelId, bucket);
      }
      bucket.guids.push(el.guid);
      bucket.meta.set(el.guid, {
        fileVersionId,
        sourceLabel: sourceLabel ?? "Model",
      });
    }

    for (const [modelId, bucket] of modelBuckets) {
      const model = fragments.list.get(modelId);
      if (!model) continue;
      for (let i = 0; i < bucket.guids.length; i += BimEngine.GUID_SYNC_CHUNK) {
        const chunk = bucket.guids.slice(i, i + BimEngine.GUID_SYNC_CHUNK);
        try {
          const localIds = await model.getLocalIdsByGuids(chunk);
          for (let j = 0; j < chunk.length; j++) {
            const guid = chunk[j]!;
            const localId = localIds[j];
            if (localId == null) continue;
            const meta = bucket.meta.get(guid);
            if (!meta) continue;
            this.guidIndex.set(guid, {
              modelId,
              localId,
              fileVersionId: meta.fileVersionId,
              sourceLabel: meta.sourceLabel,
            });
          }
        } catch {
          /* best-effort */
        }
      }
    }
  }

  // fallow-ignore-next-line complexity
  private mergeModelIdMaps(
    a: OBC.ModelIdMap | null,
    b: OBC.ModelIdMap | null,
  ): OBC.ModelIdMap | null {
    if (!a && !b) return null;
    const out: OBC.ModelIdMap = {};
    for (const src of [a, b]) {
      if (!src) continue;
      for (const [modelId, ids] of Object.entries(src)) {
        if (!(ids instanceof Set) || ids.size === 0) continue;
        if (!out[modelId]) out[modelId] = new Set<number>();
        for (const id of ids) (out[modelId] as Set<number>).add(id);
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  // fallow-ignore-next-line complexity
  private buildModelIdMapFromGuids(guids: string[]): OBC.ModelIdMap | null {
    const map: OBC.ModelIdMap = {};
    for (const g of guids) {
      const hit = this.guidIndex.get(g);
      if (!hit) continue;
      if (!map[hit.modelId]) map[hit.modelId] = new Set<number>();
      (map[hit.modelId] as Set<number>).add(hit.localId);
    }
    return Object.keys(map).length > 0 ? map : null;
  }

  // fallow-ignore-next-line complexity
  private async resolveModelIdMapFromGuids(guids: string[]): Promise<OBC.ModelIdMap | null> {
    if (guids.length === 0) return null;
    const map = this.buildModelIdMapFromGuids(guids) ?? {};
    const missing = guids.filter((g) => !this.guidIndex.has(g));
    if (missing.length > 0) {
      const fragments = this.components?.get(OBC.FragmentsManager);
      if (fragments?.initialized) {
        try {
          const fallback = await fragments.guidsToModelIdMap(missing);
          if (fallback) {
            for (const [modelId, ids] of Object.entries(fallback)) {
              if (!(ids instanceof Set) || ids.size === 0) continue;
              if (!map[modelId]) map[modelId] = new Set<number>();
              for (const id of ids) (map[modelId] as Set<number>).add(id);
            }
          }
        } catch {
          /* optional */
        }
      }
    }
    return Object.keys(map).length > 0 ? map : null;
  }

  // fallow-ignore-next-line complexity
  private getActiveSelectionMap(): OBC.ModelIdMap | null {
    // fallow-ignore-next-line code-duplication
    const raw = this.mergeModelIdMaps(
      this.buildModelIdMapFromGuids([...this.selectedGuids]),
      this.lastPickMap,
    );
    if (!raw) return null;
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return raw;
    const safe = this.sanitizeHighlightMap(raw, fragments);
    if (!safe && this.lastPickMap === raw) this.lastPickMap = null;
    return safe;
  }

  // fallow-ignore-next-line complexity
  private async getActiveSelectionMapAsync(): Promise<OBC.ModelIdMap | null> {
    const raw =
      (this.selectedGuids.size > 0
        ? await this.resolveModelIdMapFromGuids([...this.selectedGuids])
        : null) ?? this.lastPickMap;
    if (!raw) return null;
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return raw;
    const safe = this.sanitizeHighlightMap(raw, fragments);
    if (!safe && this.lastPickMap === raw) this.lastPickMap = null;
    return safe;
  }

  // fallow-ignore-next-line complexity
  async selectByGuids(guids: string[], additive = false): Promise<void> {
    if (!additive) this.selectedGuids.clear();
    for (const g of guids) this.selectedGuids.add(g);
    const map = await this.resolveModelIdMapFromGuids([...this.selectedGuids]);
    if (!map) {
      if (!additive) this.clearSelection();
      return;
    }
    this.lastPickMap = map;
    await this.requestFragmentHighlights();
    await this.handleHighlight(map);
    this.events.onMultiSelection?.([...this.selectedGuids]);
  }

  async isolateSelection(): Promise<void> {
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.isolate(map);
    this.bumpRender();
  }

  async hideSelection(): Promise<void> {
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.set(false, map);
    this.bumpRender();
  }

  async showAllElements(): Promise<void> {
    await this.clearColorize();
    await this.clearFilterGhost();
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.set(true);
    await this.showAllGroups();
    this.xRayActive = false;
    this.clearSelection();
    this.invalidatePlanSilhouette();
    this.bumpRender();
  }

  /** Reset visibility without clearing selection (used when filter visualize = none). */
  async resetFilterVisibility(): Promise<void> {
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.set(true);
    await this.reapplyGroupVisibility();
    this.bumpRender();
  }

  /** Show all elements for ghost filter without triggering a plan rebake. */
  private async ensureBaseVisibilityForFilter(): Promise<void> {
    const hider = this.mustComponents().get(OBC.Hider);
    await hider.set(true);
    await this.reapplyGroupVisibility();
  }

  // fallow-ignore-next-line complexity
  private async reapplyGroupVisibility(): Promise<void> {
    const hider = this.mustComponents().get(OBC.Hider);
    for (const [name, visible] of this.storeyVisible) {
      if (visible) continue;
      const map = this.storeyMaps.get(name);
      if (map) await hider.set(false, map);
    }
    for (const [name, visible] of this.categoryVisible) {
      if (visible) continue;
      const map = this.categoryMaps.get(name);
      if (map) await hider.set(false, map);
    }
  }

  /**
   * Apply filter visualize + colorize in one pass so ghost/colorize/selection
   * are painted together without intermediate wipes.
   */
  // fallow-ignore-next-line complexity
  async applyFilterPresentation(opts: {
    filterActive: boolean;
    visualize: "isolate" | "ghost" | "none";
    matchGuids: string[];
    colorizeGroups: { styleId: string; color: string; guids: string[] }[];
  }): Promise<void> {
    this.activeFilterGhostMap = null;

    if (opts.filterActive) {
      if (opts.visualize === "none") {
        await this.resetFilterVisibility();
      } else if (opts.visualize === "isolate") {
        const map = await this.resolveModelIdMapFromGuids(opts.matchGuids);
        if (map) {
          const hider = this.mustComponents().get(OBC.Hider);
          await hider.isolate(map);
          this.invalidatePlanSilhouette();
        }
      } else {
        await this.applyFilterGhostState(opts.matchGuids);
      }
    } else {
      await this.resetFilterVisibility();
    }

    const nextGroups: { styleId: string; color: string; map: OBC.ModelIdMap }[] = [];
    this.colorizeStyleIds = [];
    for (const group of opts.colorizeGroups) {
      const map = await this.resolveModelIdMapFromGuids(group.guids);
      if (!map) continue;
      this.colorizeStyleIds.push(group.styleId);
      nextGroups.push({ styleId: group.styleId, color: group.color, map });
    }
    this.activeColorizeGroups = nextGroups;

    await this.requestFragmentHighlights();
    if (!this.hasActiveFragmentHighlights()) {
      this.maybeScheduleDeferredMaterialSync();
    }
  }

  async clearFilterGhost(): Promise<void> {
    const hadGhost = this.activeFilterGhostMap != null;
    this.activeFilterGhostMap = null;
    if (!hadGhost && this.activeColorizeGroups.length === 0) return;
    await this.requestFragmentHighlights();
    if (!this.hasActiveFragmentHighlights()) {
      this.maybeScheduleDeferredMaterialSync();
    }
  }

  /** Update ghost state only — caller paints via requestFragmentHighlights(). */
  // fallow-ignore-next-line complexity
  private async applyFilterGhostState(matchGuids: string[], opacity = 0.18): Promise<void> {
    const index = this.quantityIndex;
    if (!index || matchGuids.length === 0) return;

    await this.ensureBaseVisibilityForFilter();

    const matchSet = new Set(matchGuids);
    const ghostGuids = index.elements.filter((el) => !matchSet.has(el.guid)).map((el) => el.guid);
    if (ghostGuids.length === 0) {
      this.activeFilterGhostMap = null;
      return;
    }

    const map = await this.resolveModelIdMapFromGuids(ghostGuids);
    if (!map) return;

    this.activeFilterGhostMap = map;
    this.activeFilterGhostOpacity = opacity;
  }

  async clearColorize(): Promise<void> {
    const hadColorize = this.activeColorizeGroups.length > 0;
    this.activeColorizeGroups = [];
    this.colorizeStyleIds = [];
    if (!hadColorize && this.activeFilterGhostMap == null) {
      this.maybeScheduleDeferredMaterialSync();
      return;
    }
    await this.requestFragmentHighlights();
    if (!this.hasActiveFragmentHighlights()) {
      this.maybeScheduleDeferredMaterialSync();
    }
  }

  async setXRayMode(enabled: boolean): Promise<void> {
    this.xRayActive = enabled;
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    const hider = this.mustComponents().get(OBC.Hider);
    if (enabled) await hider.isolate(map);
    else await hider.set(true);
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  async sectionBoxOnSelection(): Promise<void> {
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    const world = this.mustWorld();
    const components = this.mustComponents();
    const clipper = components.get(OBC.Clipper);
    clipper.enabled = true;
    clipper.deleteAll();

    const box = new THREE.Box3();
    const fragments = components.get(OBC.FragmentsManager);
    for (const [mid, ids] of Object.entries(map)) {
      const model = fragments.list.get(mid);
      if (!model) continue;
      for (const lid of ids) {
        try {
          const [pos] = await model.getPositions([lid]);
          if (pos) box.expandByPoint(new THREE.Vector3(pos.x, pos.y, pos.z));
        } catch {
          /* optional */
        }
      }
    }
    if (box.isEmpty()) return;

    const pad = 0.15;
    box.expandByScalar(pad);
    const min = box.min;
    const max = box.max;
    const planes: { normal: THREE.Vector3; point: THREE.Vector3 }[] = [
      { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(min.x, 0, 0) },
      { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(max.x, 0, 0) },
      { normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(0, min.y, 0) },
      { normal: new THREE.Vector3(0, -1, 0), point: new THREE.Vector3(0, max.y, 0) },
      { normal: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, min.z) },
      { normal: new THREE.Vector3(0, 0, -1), point: new THREE.Vector3(0, 0, max.z) },
    ];
    for (const p of planes) {
      clipper.createFromNormalAndCoplanarPoint(world, p.normal, p.point);
    }
    this.tool = "clip";
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  private async getElementAnchorPosition(
    model: FRAGS.FragmentsModel,
    localId: number,
  ): Promise<{ x: number; y: number; z: number } | null> {
    const isFiniteVec = (v: THREE.Vector3) =>
      Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

    try {
      const [pos] = await model.getPositions([localId]);
      if (pos && isFiniteVec(pos)) {
        return { x: pos.x, y: pos.y, z: pos.z };
      }
    } catch {
      /* optional */
    }

    try {
      const box = await model.getMergedBox([localId]);
      if (box && !box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        if (isFiniteVec(center)) {
          return { x: center.x, y: center.y, z: center.z };
        }
      }
    } catch {
      /* optional */
    }

    return null;
  }

  // fallow-ignore-next-line complexity
  projectWorldToScreen(
    x: number,
    y: number,
    z: number,
  ): { x: number; y: number; visible: boolean } | null {
    const world = this.world;
    const container = this.container;
    if (!world || !container) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    const cam = world.camera.three;
    const vec = new THREE.Vector3(x, y, z);
    vec.project(cam);
    if (!Number.isFinite(vec.x) || !Number.isFinite(vec.y) || !Number.isFinite(vec.z)) return null;
    if (vec.z > 1) return { x: 0, y: 0, visible: false };
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const screenX = ((vec.x + 1) / 2) * rect.width;
    const screenY = ((-vec.y + 1) / 2) * rect.height;
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
    return {
      x: screenX,
      y: screenY,
      visible: vec.z >= -1 && vec.z <= 1,
    };
  }

  /** Raycast the model (or a plane through the orbit target) at normalized overlay coords. */
  // fallow-ignore-next-line complexity
  async raycastAtNorm(
    normX: number,
    normY: number,
  ): Promise<{ x: number; y: number; z: number } | null> {
    const world = this.world;
    const container = this.container;
    if (!world?.renderer || !container) return null;

    const ndc = new THREE.Vector2(normX * 2 - 1, -(normY * 2 - 1));
    const components = this.components;
    if (components) {
      const caster = components.get(OBC.Raycasters).get(world);
      const hit = await caster.castRay({ position: ndc });
      if (hit?.point) {
        return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      }

      const fragments = components.get(OBC.FragmentsManager);
      if (fragments.initialized) {
        const rect = container.getBoundingClientRect();
        const fragHit = await fragments.raycast({
          camera: world.camera.three as THREE.PerspectiveCamera,
          mouse: new THREE.Vector2(rect.left + normX * rect.width, rect.top + normY * rect.height),
          dom: world.renderer.three.domElement,
        });
        if (fragHit?.point) {
          return { x: fragHit.point.x, y: fragHit.point.y, z: fragHit.point.z };
        }
      }
    }

    return this.intersectRayWithTargetPlane(normX, normY);
  }

  /** Pick an IFC element or world point at normalized viewport coords for issue placement. */
  // fallow-ignore-next-line complexity
  async buildIssueAnchorAtNorm(
    normX: number,
    normY: number,
  ): Promise<{
    ifcGuid: string;
    localId?: number;
    name?: string;
    ifcType?: string;
    spatialPath?: string[];
    position?: { x: number; y: number; z: number };
  } | null> {
    const container = this.container;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const pointer = new PointerEvent("pointerdown", {
      clientX: rect.left + normX * rect.width,
      clientY: rect.top + normY * rect.height,
      bubbles: true,
    });

    const hit = await this.fastPickElement(pointer);
    if (hit) {
      const fragments = this.components?.get(OBC.FragmentsManager);
      const model = fragments?.list.get(hit.modelId);
      if (model) {
        try {
          const [[data], [guid], positions] = await Promise.all([
            model.getItemsData([hit.localId], {
              attributesDefault: true,
              relationsDefault: { attributes: false, relations: false },
            }),
            model.getGuidsByLocalIds([hit.localId]),
            model.getPositions([hit.localId]).catch(() => [null]),
          ]);
          const ifcGuid = guid ?? attrValue(data, "_guid") ?? attrValue(data, "GlobalId");
          if (ifcGuid) {
            const pos = positions[0];
            return {
              ifcGuid,
              localId: hit.localId,
              name: attrValue(data, "Name") ?? undefined,
              ifcType: data._category ? (attrValue(data, "_category") ?? undefined) : undefined,
              spatialPath: (() => {
                const storey = this.storeyByModelLocalId.get(
                  modelLocalKey(hit.modelId, hit.localId),
                );
                return storey ? [storey] : undefined;
              })(),
              position: pos ? { x: pos.x, y: pos.y, z: pos.z } : undefined,
            };
          }
        } catch {
          /* fall through to world raycast */
        }
      }
    }

    const worldPoint = await this.raycastAtNorm(normX, normY);
    if (!worldPoint) return null;
    return {
      ifcGuid: "viewport-markup",
      position: worldPoint,
    };
  }

  /** Fallback anchor when the ray misses geometry — plane through orbit target facing camera. */
  intersectRayWithTargetPlane(
    normX: number,
    normY: number,
  ): { x: number; y: number; z: number } | null {
    const world = this.world;
    if (!world) return null;
    const cam = world.camera.three;
    const ndc = new THREE.Vector2(normX * 2 - 1, -(normY * 2 - 1));
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cam);
    const target = world.camera.controls.getTarget(new THREE.Vector3());
    const normal = new THREE.Vector3().subVectors(cam.position, target);
    if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
    normal.normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, target);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, y: hit.y, z: hit.z };
  }

  private async focusCameraOnSphere(sphere: THREE.Sphere): Promise<void> {
    const world = this.mustWorld();
    this.adjustCameraClipping(sphere);
    const fitSphere = sphere.clone();
    fitSphere.radius *= 0.82;
    await world.camera.controls.fitToSphere(fitSphere, true);
    world.camera.controls.setOrbitPoint(sphere.center.x, sphere.center.y, sphere.center.z);
  }

  // fallow-ignore-next-line complexity
  async zoomToWorldPoints(points: { x: number; y: number; z: number }[]): Promise<void> {
    if (points.length === 0) {
      await this.fitToView();
      return;
    }
    const box = new THREE.Box3();
    for (const p of points) {
      box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
    }
    if (box.isEmpty()) {
      await this.fitToView();
      return;
    }
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    if (sphere.radius < 0.5) sphere.radius = 2;
    await this.focusCameraOnSphere(sphere);
  }

  /** Keep issue markers tied to IFC elements (refresh world coords on camera/model changes). */
  // fallow-ignore-next-line unused-class-member
  setIssueAnchors(
    anchors: {
      ifcGuid?: string | null;
      localId?: number;
      fileVersionId?: string | null;
      position?: { x: number; y: number; z: number };
    }[],
  ): void {
    this.issueAnchors = anchors
      .map((a) => ({
        ...a,
        ifcGuid: a.ifcGuid?.trim() || undefined,
      }))
      .filter((a) => (a.ifcGuid?.length ?? 0) > 0 || a.position != null);
    void this.refreshIssueAnchorWorld();
  }

  // fallow-ignore-next-line complexity
  projectIssueAnchorToScreen(anchor: {
    ifcGuid?: string | null;
    localId?: number;
    fileVersionId?: string | null;
    position?: { x: number; y: number; z: number };
  }): { x: number; y: number; visible: boolean } | null {
    const guid = anchor.ifcGuid?.trim();
    const cached = guid ? this.issueWorldByGuid.get(guid) : null;
    const fallback = anchor.position;
    const point =
      cached ?? (fallback ? new THREE.Vector3(fallback.x, fallback.y, fallback.z) : null);
    if (!point) return null;
    return this.projectWorldToScreen(point.x, point.y, point.z);
  }

  private scheduleIssueAnchorRefresh(): void {
    if (this.issueAnchorRefreshTimer != null || this.issueAnchors.length === 0) return;
    this.issueAnchorRefreshTimer = window.setTimeout(() => {
      this.issueAnchorRefreshTimer = null;
      void this.refreshIssueAnchorWorld();
    }, 48);
  }

  // fallow-ignore-next-line complexity
  private resolveAnchorHit(anchor: {
    ifcGuid: string;
    localId?: number;
    fileVersionId?: string | null;
  }): { modelId: string; localId: number } | null {
    const indexed = this.guidIndex.get(anchor.ifcGuid);
    if (indexed) return { modelId: indexed.modelId, localId: indexed.localId };
    if (anchor.localId == null) return null;
    const fvId = anchor.fileVersionId ?? null;
    for (const [modelId, entry] of this.modelRegistry.entries()) {
      if (fvId && entry.fileVersionId !== fvId) continue;
      return { modelId, localId: anchor.localId };
    }
    return null;
  }

  // fallow-ignore-next-line complexity
  private async refreshIssueAnchorWorld(): Promise<void> {
    if (this.disposed || this.issueAnchors.length === 0 || this.issueAnchorRefreshInFlight) {
      return;
    }
    this.issueAnchorRefreshInFlight = true;
    try {
      const fragments = this.components?.get(OBC.FragmentsManager);
      if (!fragments?.initialized) return;

      for (const anchor of this.issueAnchors) {
        const guid = anchor.ifcGuid?.trim();
        if (!guid) continue;
        const hit = this.resolveAnchorHit({ ...anchor, ifcGuid: guid });
        if (!hit) continue;
        const model = fragments.list.get(hit.modelId);
        if (!model) continue;
        try {
          const [pos] = await model.getPositions([hit.localId]);
          if (!pos) continue;
          this.issueWorldByGuid.set(guid, new THREE.Vector3(pos.x, pos.y, pos.z));
        } catch {
          /* optional */
        }
      }
    } finally {
      this.issueAnchorRefreshInFlight = false;
    }
  }

  async zoomToSelection(): Promise<void> {
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    await this.zoomToModelIdMap(map);
  }

  async zoomToGuids(guids: string[]): Promise<void> {
    if (guids.length === 0) return;
    const map = await this.resolveModelIdMapFromGuids(guids);
    if (!map) return;
    await this.zoomToModelIdMap(map);
  }

  // fallow-ignore-next-line complexity
  private async getModelIdMapBoundingBox(map: OBC.ModelIdMap): Promise<THREE.Box3 | null> {
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const box = new THREE.Box3();
    for (const [mid, ids] of Object.entries(map)) {
      const model = fragments.list.get(mid);
      if (!model) continue;
      const localIds = [...ids];
      for (let i = 0; i < localIds.length; i += 200) {
        const chunk = localIds.slice(i, i + 200);
        try {
          box.union(await model.getMergedBox(chunk));
        } catch {
          try {
            const positions = await model.getPositions(chunk);
            for (const pos of positions) {
              if (pos) box.expandByPoint(new THREE.Vector3(pos.x, pos.y, pos.z));
            }
          } catch {
            /* optional */
          }
        }
      }
    }
    return this.isValidBox3(box) ? box : null;
  }

  // fallow-ignore-next-line complexity
  private async zoomToModelIdMap(map: OBC.ModelIdMap): Promise<void> {
    const box = await this.getModelIdMapBoundingBox(map);
    if (!box) {
      await this.fitToView();
      return;
    }
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const minRadius = this.detectModelUnits() === "mm" ? 500 : 0.5;
    if (!Number.isFinite(sphere.radius) || sphere.radius < minRadius) {
      sphere.radius = this.detectModelUnits() === "mm" ? 2000 : 2;
    }
    await this.focusCameraOnSphere(sphere);
  }

  getCameraState(): Record<string, unknown> {
    const world = this.world;
    if (!world) return {};
    const cam = world.camera.three;
    const target = world.camera.controls.getTarget(new THREE.Vector3());
    return {
      position: cam.position.toArray(),
      target: target.toArray(),
      projection: world.camera.projection.current,
    };
  }

  // fallow-ignore-next-line complexity
  async applyCameraState(state: Record<string, unknown>): Promise<void> {
    const world = this.world;
    if (!world) return;
    const pos = state.position;
    const tgt = state.target;
    if (Array.isArray(pos) && pos.length === 3) {
      world.camera.three.position.set(pos[0] as number, pos[1] as number, pos[2] as number);
    }
    if (Array.isArray(tgt) && tgt.length === 3) {
      world.camera.controls.setLookAt(
        world.camera.three.position.x,
        world.camera.three.position.y,
        world.camera.three.position.z,
        tgt[0] as number,
        tgt[1] as number,
        tgt[2] as number,
        false,
      );
      world.camera.controls.setOrbitPoint(tgt[0] as number, tgt[1] as number, tgt[2] as number);
    }
    if (state.projection === "Orthographic" || state.projection === "Perspective") {
      await world.camera.projection.set(state.projection);
    }
    this.bumpRender();
  }

  // fallow-ignore-next-line unused-class-member
  rollupSelectedQuantities(): {
    count: number;
    length: number | null;
    area: number | null;
    volume: number | null;
    entries: BimQuantityEntry[];
  } {
    const index = this.quantityIndex;
    if (!index) return { count: 0, length: null, area: null, volume: null, entries: [] };
    const entries = index.elements.filter((e) => this.selectedGuids.has(e.guid));
    const rollup = rollupBimQuantities(
      entries.map((e) => e.quantities),
      entries.length,
    );
    return { ...rollup, entries };
  }

  /** Resolves quantities from the index and live fragment property sets. */
  // fallow-ignore-next-line complexity
  async resolveQuantityRollup(guids: string[]): Promise<BimModelQuantityRollup> {
    if (guids.length === 0) {
      return { count: 0, length: null, area: null, volume: null };
    }

    const indexByGuid = new Map(
      this.quantityIndex?.elements.map((e) => [e.guid, e.quantities]) ?? [],
    );
    const fragments = this.mustComponents().get(OBC.FragmentsManager);
    const merged: BimElementQuantities[] = [];

    for (const guid of guids) {
      let quantities = { ...(indexByGuid.get(guid) ?? {}) };
      const hit = this.guidIndex.get(guid);
      const model = hit ? fragments.list.get(hit.modelId) : this.model;
      const localId = hit?.localId;
      if (localId != null && model) {
        try {
          const [fullData] = await model.getItemsData([localId], {
            attributesDefault: true,
            relationsDefault: { attributes: true, relations: false },
            relations: {
              IsDefinedBy: { attributes: true, relations: true },
              HasProperties: { attributes: true, relations: true },
              Quantities: { attributes: true, relations: true },
            },
          });
          if (fullData) {
            const psets = extractPsets(fullData);
            const fromPsets = parseQuantitiesFromPropertyRows(psets.flatMap((p) => p.props));
            quantities = mergeElementQuantities(quantities, fromPsets);
          }
        } catch {
          /* property sets are optional */
        }
      }
      merged.push(quantities);
    }

    return rollupBimQuantities(merged, guids.length);
  }

  // fallow-ignore-next-line complexity
  async captureSnapshot(): Promise<string | null> {
    const world = this.world;
    if (!world?.renderer || this.disposed) return null;
    const canvas = world.renderer.three.domElement;
    if (!canvas || canvas.width < MIN_CANVAS_PX || canvas.height < MIN_CANVAS_PX) {
      return null;
    }

    try {
      await this.flushRender();
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  /** Capture the current viewport with a pin and crop centered on normalized placement coords. */
  async capturePlacementSnapshot(normX: number, normY: number): Promise<string | null> {
    const base = await this.captureSnapshot();
    if (!base) return null;
    const sky = getViewportColors(this.appearance.environment);
    return compositeIssuePlacementSnapshot(base, normX, normY, {
      background: sky.bgHaze,
    });
  }

  /** Capture a viewport snapshot framed on an issue anchor's screen position. */
  // fallow-ignore-next-line complexity
  async captureAnchorSnapshot(anchor: {
    ifcGuid?: string | null;
    localId?: number;
    fileVersionId?: string | null;
    position?: { x: number; y: number; z: number };
  }): Promise<string | null> {
    const container = this.container;
    if (!container) return this.captureSnapshot();

    let normX = 0.5;
    let normY = 0.5;
    let hasFocus = false;

    if (anchor.position) {
      const screen = this.projectWorldToScreen(
        anchor.position.x,
        anchor.position.y,
        anchor.position.z,
      );
      if (screen?.visible) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          normX = Math.min(1, Math.max(0, screen.x / rect.width));
          normY = Math.min(1, Math.max(0, screen.y / rect.height));
          hasFocus = true;
        }
      }
    }

    if (!hasFocus) {
      const screen = this.projectIssueAnchorToScreen(anchor);
      if (screen?.visible) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          normX = Math.min(1, Math.max(0, screen.x / rect.width));
          normY = Math.min(1, Math.max(0, screen.y / rect.height));
          hasFocus = true;
        }
      }
    }

    if (!hasFocus) return this.captureSnapshot();
    return this.capturePlacementSnapshot(normX, normY);
  }

  // -------------------------------------------------------------- cleanup

  // fallow-ignore-next-line complexity
  dispose(): void {
    this.disposed = true;
    this.stopWalkLoop();
    window.removeEventListener("keydown", this.onGlobalKeyDown);
    window.removeEventListener("keydown", this.onWalkKeyDown);
    window.removeEventListener("keyup", this.onWalkKeyUp);
    const container = this.container;
    if (container) {
      container.removeEventListener("pointerdown", this.onCanvasPointerDown);
      container.removeEventListener("pointermove", this.onCanvasPointerMove);
      container.removeEventListener("pointerup", this.onCanvasPointerUp);
      container.removeEventListener("contextmenu", this.onCanvasContextMenu, { capture: true });
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.world?.renderer && this.onViewportOverlayAfterUpdate) {
      this.world.renderer.onAfterUpdate.remove(this.onViewportOverlayAfterUpdate);
    }
    this.onViewportOverlayAfterUpdate = null;
    this.viewCube?.dispose();
    this.viewCube = null;
    this.viewportBackground?.dispose();
    this.viewportBackground = null;
    if (this.issueAnchorRefreshTimer != null) {
      window.clearTimeout(this.issueAnchorRefreshTimer);
      this.issueAnchorRefreshTimer = null;
    }
    if (this.materialSyncTimer != null) {
      window.clearTimeout(this.materialSyncTimer);
      this.materialSyncTimer = null;
    }
    if (this.planSilhouetteBakeTimer != null) {
      window.clearTimeout(this.planSilhouetteBakeTimer);
      this.planSilhouetteBakeTimer = null;
    }
    this.planSilhouette?.close();
    this.planSilhouette = null;
    this.planMinimapBoundsCache = null;
    this.planMinimapStoreyFloorY = null;
    this.clearClusterTypeLabels();
    this.clusterByTypeActive = false;
    this.clusterTransformBackup.clear();
    this.issuePlacementPick = null;
    this.issueAnchors = [];
    this.issueWorldByGuid.clear();
    this.sectionBox?.deactivate();
    if (this.components) {
      this.components.dispose();
      this.components = null;
    }
    this.world = null;
    this.model = null;
    this.container = null;
  }

  private mustComponents(): OBC.Components {
    if (!this.components) throw new Error("BIM engine not initialized");
    return this.components;
  }

  private mustWorld(): NonNullable<BimEngine["world"]> {
    if (!this.world) throw new Error("BIM engine not initialized");
    return this.world;
  }
}
