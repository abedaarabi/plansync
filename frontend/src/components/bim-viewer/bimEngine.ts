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
  CLASH_ITEM1_COLOR,
  CLASH_ITEM2_COLOR,
  CLASH_SCENE_GHOST_OPACITY,
} from "@/lib/bim/clash/clashStatusStyle";
import { BIM_PALETTE } from "@/lib/bim/bimPalette";
import {
  BIM_ACCENT,
  BIM_SELECTION,
  BIM_SPACE_MATERIAL,
  BIM_VIEWPORT,
  configureLod500Importer,
  createBimSkyTexture,
  fogDistanceScales,
  getBimBackgroundProfile,
  getViewportColors,
  resolveFogColor,
} from "@/lib/bim/renderingProfile";
import type { BimQualityState } from "@/lib/bim/renderQuality";
import {
  DEFAULT_BIM_VIEWPORT_APPEARANCE,
  mergeViewportAppearance,
  type BimViewportAppearance,
} from "@/lib/bim/viewportAppearance";
import { buildModelId, type BimFederationMember } from "@/lib/bim/federation";
import { assertIfcBytesIntact } from "@/lib/bim/ifcBytes";
import { getBimCameraNavigationProfile } from "@/lib/bim/cameraNavigation";
import { bimViewportPixelRatio } from "@/lib/bim/viewportPixelRatio";
import { ViewCubeOverlay } from "@/lib/bim/viewCube";
import {
  PLAN_BAKE_PX,
  type PlanMinimapBounds,
  type PlanMinimapPose,
  type PlanMinimapState,
} from "@/lib/bim/planMinimap";
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
import { BimRenderEffects } from "@/components/bim-viewer/bimRenderEffects";
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
const WALK_COLLISION_POLL_MS = 120;
/** Hold Shift in walk mode to multiply horizontal/vertical speed. */
const WALK_SPRINT_MULTIPLIER = 2;
/** Vertical (Q/E) speed relative to walk speed — slightly slower than run. */
const WALK_VERTICAL_FACTOR = 0.72;
/** How quickly walk velocity eases toward the target (1/s). */
const WALK_ACCEL = 10;
const WALK_DECEL = 12;
/** Radians per pixel for pointer-lock look (scaled by nav rotate speed). */
const WALK_LOOK_SENS = 0.0022;
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
  onQualityChanged?: (state: BimQualityState) => void;
  /** Ctrl/Cmd+L — host should copy the current view URL. */
  onCopyViewLink?: () => void;
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
    OBF.PostproductionRenderer
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
  private walkVelocity = { forward: 0, strafe: 0, vertical: 0 };
  private walkRaf: number | null = null;
  private walkLastTime = 0;
  private walkBlockedUntilDistance: number | null = null;
  private walkLastCollisionPoll = 0;
  private walkPointerLocked = false;
  private walkShiftHeld = false;
  private resizeObserver: ResizeObserver | null = null;
  private pointerDown = { x: 0, y: 0 };
  private pointerMoved = false;
  private disposed = false;
  private rimLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private renderEffects: BimRenderEffects | null = null;
  private effectiveQuality: BimQualityState | null = null;
  private viewportBackground: THREE.Texture | null = null;
  private gridAxesHelper: THREE.Group | null = null;
  private appearance: BimViewportAppearance = { ...DEFAULT_BIM_VIEWPORT_APPEARANCE };
  /** Cancels stale property loads when the user clicks another element quickly. */
  private selectionLoadId = 0;
  private quantityIndex: BimQuantityIndex | null = null;
  private selectedGuids = new Set<string>();
  /** World-space orbit pivot for the active selection (applied on drag). */
  private selectionOrbitPoint: THREE.Vector3 | null = null;
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
  /**
   * Clash review owns viewport presentation (ghost + Item 1/2 colors). While set,
   * skip default select tint and block the filter-dock idle clear from wiping it.
   */
  private clashReviewSuppressSelectPaint = false;
  /** Fast Navisworks-style context: fade whole-scene materials instead of per-element ghost maps. */
  private clashSceneGhostOpacity: number | null = null;
  /**
   * Clash Ghost context is look-only: faded federation must not be selectable.
   * Picks are restricted to {@link clashPickAllowMap} (Item 1/2) and pierce occluders.
   */
  private clashGhostPickOnly = false;
  private clashPickAllowMap: OBC.ModelIdMap | null = null;
  private clashGhostMatBackup = new Map<
    THREE.Material,
    {
      opacity: number;
      transparent: boolean;
      depthWrite: boolean;
      color?: THREE.Color;
      emissive?: THREE.Color;
    }
  >();
  private static readonly CLASH_GHOST_TINT = new THREE.Color(0x6a6e74);
  /** Bumps on every presentClashPartners call so stale async mode switches are ignored. */
  private clashPresentSeq = 0;
  private clashGhostRefreshTimer: number | null = null;
  private highlightRepaintTimer: number | null = null;
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
  /** Silhouette bake resolution; raised for full-pane 2D plan views. */
  private planBakePx = PLAN_BAKE_PX;
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

  /**
   * Resolve IFC GUIDs to runtime localIds via the quantity-index guid map.
   * Used by clash detection without exposing FragmentsModel.
   */
  // fallow-ignore-next-line unused-class-member
  resolveGuidsToLocalIds(
    guids: string[],
  ): Map<string, { modelId: string; localId: number; fileVersionId: string | null }> {
    const out = new Map<
      string,
      { modelId: string; localId: number; fileVersionId: string | null }
    >();
    for (const guid of guids) {
      const hit = this.guidIndex.get(guid);
      if (!hit) continue;
      out.set(guid, {
        modelId: hit.modelId,
        localId: hit.localId,
        fileVersionId: hit.fileVersionId,
      });
    }
    return out;
  }

  /** Flat AABB buffer: 6 floats per localId (minXYZ, maxXYZ), world space. */
  // fallow-ignore-next-line unused-class-member
  async getElementBoxes(modelId: string, localIds: number[]): Promise<Float32Array> {
    const fragments = this.components?.get(OBC.FragmentsManager);
    const model = fragments?.list.get(modelId);
    const out = new Float32Array(localIds.length * 6);
    if (!model || localIds.length === 0) return out;
    const CHUNK = 200;
    for (let i = 0; i < localIds.length; i += CHUNK) {
      const chunk = localIds.slice(i, i + CHUNK);
      let boxes: THREE.Box3[] = [];
      try {
        boxes = await model.getBoxes(chunk);
      } catch {
        boxes = [];
      }
      for (let j = 0; j < chunk.length; j++) {
        const box = boxes[j];
        const offset = (i + j) * 6;
        if (!box || !this.isValidBox3(box)) {
          out[offset] = 0;
          out[offset + 1] = 0;
          out[offset + 2] = 0;
          out[offset + 3] = 0;
          out[offset + 4] = 0;
          out[offset + 5] = 0;
          continue;
        }
        out[offset] = box.min.x;
        out[offset + 1] = box.min.y;
        out[offset + 2] = box.min.z;
        out[offset + 3] = box.max.x;
        out[offset + 4] = box.max.y;
        out[offset + 5] = box.max.z;
      }
    }
    return out;
  }

  /**
   * Per-element triangle soup in world space (model matrix × mesh transform applied).
   * Order matches input localIds; missing items are omitted.
   */
  // fallow-ignore-next-line unused-class-member, complexity
  async getElementGeometry(
    modelId: string,
    localIds: number[],
  ): Promise<{ localId: number; positions: Float32Array; indices: Uint32Array | null }[]> {
    const { mergeItemMeshesWorld } = await import("@/lib/bim/clash/mergeItemMeshes");
    const fragments = this.components?.get(OBC.FragmentsManager);
    const model = fragments?.list.get(modelId);
    if (!model || localIds.length === 0) return [];
    model.object.updateMatrixWorld(true);
    const modelMatrix = model.object.matrixWorld;
    const CHUNK = 24;
    const out: { localId: number; positions: Float32Array; indices: Uint32Array | null }[] = [];

    for (let i = 0; i < localIds.length; i += CHUNK) {
      const chunk = localIds.slice(i, i + CHUNK);
      let groups: unknown[] = [];
      try {
        groups = await model.getItemsGeometry(chunk);
      } catch {
        continue;
      }
      for (let j = 0; j < chunk.length; j++) {
        const localId = chunk[j]!;
        const group = groups[j];
        const meshes = Array.isArray(group) ? group : group ? [group] : [];
        if (meshes.length === 0) continue;
        const merged = mergeItemMeshesWorld(
          meshes as {
            positions?: ArrayLike<number>;
            indices?: ArrayLike<number>;
            transform: THREE.Matrix4;
          }[],
          modelMatrix,
        );
        if (!merged) continue;
        out.push({ localId, positions: merged.positions, indices: merged.indices });
      }
    }
    return out;
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
    this.renderEffects?.setModelCount(this.modelRegistry.size);
    await this.buildClassifications();
    await fragments.core.update(true);
    this.applyViewportAtmosphere(this.getModelBoundingSphere());
    this.invalidatePlanSilhouette();
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  async setViewportAppearance(patch: Partial<BimViewportAppearance>): Promise<void> {
    this.appearance = mergeViewportAppearance(this.appearance, patch);
    this.renderEffects?.updateAppearance(this.appearance);
    this.applySkyEnvironment();
    if (patch.navigationSpeed != null) this.applyCameraNavigation();
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
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBF.PostproductionRenderer
    >();
    this.world = world;

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBF.PostproductionRenderer(components, container, {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
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
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const grids = components.get(OBC.Grids);
    const grid = grids.create(world);
    grid.config.color = new THREE.Color(sky.grid);
    grid.config.distance = 650;

    // Fragments engine — worker served from public/ (same-origin, offline-safe).
    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(FRAGMENTS_WORKER_URL);
    this.renderEffects = new BimRenderEffects(components, world, this.appearance, (state) => {
      this.applyRenderQuality(state);
      this.events.onQualityChanged?.(state);
    });
    this.renderEffects.isolateMaterial(grid.material);
    world.camera.controls.addEventListener("rest", () => {
      this.renderEffects?.endInteraction();
      if (this.effectiveQuality) this.applyRenderQuality(this.effectiveQuality);
      fragments.core.update(true);
      this.scheduleClashSceneGhostRefresh();
      this.applyViewportAtmosphere(this.getModelBoundingSphere());
      void this.refreshIssueAnchorWorld();
    });
    world.camera.controls.addEventListener("update", () => {
      this.renderEffects?.beginInteraction();
      if (world.renderer) world.renderer.three.shadowMap.enabled = false;
      fragments.core.update();
      this.scheduleIssueAnchorRefresh();
      this.refreshAtmosphereIfNeeded();
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      this.attachModel(model);
    });

    // fallow-ignore-next-line complexity
    fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
      const isLod = "isLodMaterial" in material && material.isLodMaterial;
      // Clash review must ghost every new material (including LOD). Fragment
      // updates otherwise restore solid materials and the building "unghosts".
      if (this.clashSceneGhostOpacity != null) {
        const threeMat = material as unknown as THREE.Material;
        if (this.isClashItemMaterial(threeMat)) {
          this.solidifyClashItemMaterial(threeMat);
          return;
        }
        this.ghostClashMaterial(threeMat, this.clashSceneGhostOpacity);
        if (!isLod) {
          material.polygonOffset = true;
          material.polygonOffsetUnits = 1;
          material.polygonOffsetFactor = Math.random();
          if ("side" in material) material.side = THREE.DoubleSide;
          if ("fog" in material) material.fog = true;
        }
        this.scheduleClashSceneGhostRefresh();
        return;
      }
      if (this.materialSyncInProgress) return;
      if (!isLod) {
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
    this.applyCameraNavigation();

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
    hoverer.fade = true;
    hoverer.fadeDuration = 140;
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
    window.addEventListener("blur", this.onWalkWindowBlur);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onPointerLockMouseMove);
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
    assertIfcBytesIntact(bytes, member.name);
    await this.prepareFederationLoad();
    const components = this.mustComponents();
    const ifcLoader = components.get(OBC.IfcLoader);
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: { path: WEB_IFC_WASM_PATH, absolute: true },
    });
    let model: FRAGS.FragmentsModel;
    try {
      model = await ifcLoader.load(bytes, true, modelId, {
        instanceCallback: configureLod500Importer,
        processData: {
          progressCallback: (progress: number) => opts?.onProgress?.(progress),
        },
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (/bad_alloc|Aborted|abort\(/i.test(raw)) {
        throw new Error(
          `${member.name} could not be parsed (web-ifc aborted). The IFC may be corrupted — re-upload the full file.`,
        );
      }
      throw err;
    }
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
    this.renderEffects?.setModelCount(this.modelRegistry.size);
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

  /** Prefer visible LOD so spatial tiles can stream; fall back to full geometry on error. */
  // fallow-ignore-next-line complexity
  private async applyLod500RuntimeSettings(): Promise<void> {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return;
    try {
      for (const [, model] of fragments.list) {
        await model.setLodMode(FRAGS.LodMode.ALL_VISIBLE);
      }
      await fragments.core.update(true);
    } catch {
      try {
        for (const [, model] of fragments.list) {
          await model.setLodMode(FRAGS.LodMode.ALL_GEOMETRY);
        }
        await fragments.core.update(true);
      } catch {
        /* Best-effort — older fragment buffers may omit LOD metadata. */
      }
    }
  }

  /** PBR materials, IFC/discipline colors, spaces, and transparent render order. */
  // fallow-ignore-next-line complexity
  private async syncViewportMaterials(): Promise<void> {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized || this.materialSyncInProgress) return;
    // Never recolor while clash review is ghosting — PBR sync restores solid mats.
    if (this.shouldDeferMaterialSync()) {
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

  /**
   * True while clash review owns viewport ghost/colorize presentation.
   * Selection still works so properties can be read; only select tint paint is suppressed.
   */
  isClashReviewActive(): boolean {
    return this.clashReviewSuppressSelectPaint;
  }

  /** Re-apply ghost / colorize tints after fragment material or tile updates. */
  private hasActiveFilterHighlights(): boolean {
    return this.activeFilterGhostMap != null || this.activeColorizeGroups.length > 0;
  }

  // fallow-ignore-next-line complexity
  private hasActiveSelectionHighlight(): boolean {
    // Clash review keeps guids for inspect/UI but must not paint select tint.
    if (this.clashReviewSuppressSelectPaint) return false;
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

  /** Hover preview is only useful in orbit select mode — not over look-only ghosts. */
  private syncHoverEnabled(): void {
    const hoverer = this.components?.get(OBF.Hoverer);
    if (!hoverer) return;
    const ghostLookOnly = this.clashGhostPickOnly || this.activeFilterGhostMap != null;
    hoverer.enabled = this.tool === "select" && this.cameraMode !== "walk" && !ghostLookOnly;
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
        const clashSolid = group.styleId.startsWith("clash-item");
        await paint(
          group.styleId,
          {
            color: new THREE.Color(group.color),
            opacity: clashSolid ? 1 : COLORIZE_HIGHLIGHT_OPACITY,
            // Clash Item 1/2 must be truly opaque (Navisworks solid red/green).
            transparent: !clashSolid,
            renderedFaces: 0,
            depthTest: true,
            depthWrite: clashSolid,
          },
          group.map,
        );
      }

      if (!this.readyFragments()) return;

      // During clash review, keep Item 1/2 colors; selection still updates for properties.
      const selectMap = this.clashReviewSuppressSelectPaint
        ? null
        : this.sanitizeHighlightMap(this.getActiveSelectionMap(), fragments);
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
      // Fragment update restores tile materials — repaint the pair first, then
      // re-fade context while forcing Item 1/2 back to solid opaque colors.
      await this.paintClashItemHighlights();
      if (this.clashSceneGhostOpacity != null) {
        this.applyClashSceneGhost(this.clashSceneGhostOpacity);
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

  private shouldDeferMaterialSync(): boolean {
    return this.hasActiveFragmentHighlights() || this.clashSceneGhostOpacity != null;
  }

  private maybeScheduleDeferredMaterialSync(): void {
    if (!this.pendingMaterialSync || this.shouldDeferMaterialSync()) return;
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

  private applyRenderQuality(state: BimQualityState): void {
    this.effectiveQuality = state;
    const world = this.world;
    if (!world?.renderer) return;
    const shadows =
      (state.effective === "high" || state.effective === "ultra") &&
      this.modelRegistry.size <= 2 &&
      !state.interactionReduced;
    const renderer = world.renderer.three;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const sun = world.scene.directionalLights.values().next().value;
    if (sun) {
      sun.castShadow = shadows;
      sun.shadow.mapSize.set(
        state.effective === "ultra" ? 2048 : 1024,
        state.effective === "ultra" ? 2048 : 1024,
      );
      sun.shadow.bias = -0.0002;
      sun.shadow.normalBias = 0.02;
      sun.shadow.radius = 3;
      const sphere = this.getModelBoundingSphere();
      if (sphere && sphere.radius > 0) {
        const extent = sphere.radius * 1.25;
        sun.position
          .set(0.55, 1, 0.42)
          .normalize()
          .multiplyScalar(sphere.radius * 3)
          .add(sphere.center);
        sun.target.position.copy(sphere.center);
        if (!sun.target.parent) world.scene.three.add(sun.target);
        const camera = sun.shadow.camera;
        camera.left = -extent;
        camera.right = extent;
        camera.top = extent;
        camera.bottom = -extent;
        camera.near = Math.max(sphere.radius * 0.05, 0.01);
        camera.far = sphere.radius * 8;
        camera.updateProjectionMatrix();
      }
    }

    for (const entry of this.modelRegistry.values()) {
      entry.model.object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = shadows;
        child.receiveShadow = shadows;
      });
    }
  }

  private resolveGridSpacing(): { minor: number; major: number } {
    const unit = this.detectModelUnits() === "mm" ? 1000 : 1;
    switch (this.appearance.gridSpacing) {
      case "fine":
        return { minor: unit * 0.5, major: unit * 5 };
      case "coarse":
        return { minor: unit * 5, major: unit * 25 };
      case "standard":
        return { minor: unit, major: unit * 5 };
      default: {
        const radius = this.getModelBoundingSphere()?.radius ?? unit * 25;
        if (radius > unit * 500) return { minor: unit * 10, major: unit * 50 };
        if (radius < unit * 15) return { minor: unit * 0.25, major: unit * 2.5 };
        return { minor: unit, major: unit * 5 };
      }
    }
  }

  private applyGridAxes(): void {
    this.gridAxesHelper?.removeFromParent();
    if (this.gridAxesHelper) {
      this.gridAxesHelper.traverse((child) => {
        if (!(child instanceof THREE.Line)) return;
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      });
      this.gridAxesHelper = null;
    }
    const world = this.world;
    if (
      !world ||
      !this.appearance.gridAxes ||
      this.appearance.gridMode === "hide" ||
      this.modelRegistry.size === 0
    ) {
      return;
    }

    const radius = Math.max(this.getModelBoundingSphere()?.radius ?? 50, 1);
    const length = radius * 1.5;
    const group = new THREE.Group();
    group.name = "bim-grid-axes";
    const makeAxis = (start: THREE.Vector3, finish: THREE.Vector3, color: string): THREE.Line => {
      const geometry = new THREE.BufferGeometry().setFromPoints([start, finish]);
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      return new THREE.Line(geometry, material);
    };
    group.add(
      makeAxis(
        new THREE.Vector3(-length, 0.002, 0),
        new THREE.Vector3(length, 0.002, 0),
        BIM_PALETTE.viewer.axisX,
      ),
      makeAxis(
        new THREE.Vector3(0, 0.002, -length),
        new THREE.Vector3(0, 0.002, length),
        BIM_PALETTE.viewer.axisZ,
      ),
    );
    world.scene.three.add(group);
    this.gridAxesHelper = group;
  }

  // fallow-ignore-next-line complexity
  private applySkyEnvironment(): void {
    const world = this.world;
    if (!world) return;
    const sky = getViewportColors(this.appearance.environment);

    this.viewportBackground?.dispose();
    this.viewportBackground =
      this.appearance.backgroundTheme === "transparent"
        ? null
        : createBimSkyTexture(this.appearance.backgroundTheme);
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

    if (world.renderer) world.renderer.three.toneMappingExposure = sky.exposure;

    const grid = this.components?.get(OBC.Grids).list.get(world.uuid);
    if (grid) {
      const sky = getViewportColors(this.appearance.environment);
      grid.config.visible = this.appearance.gridMode !== "hide";
      grid.config.color = new THREE.Color(sky.grid);
      grid.fade = this.appearance.gridMode !== "show";
      const spacing = this.resolveGridSpacing();
      grid.config.primarySize = spacing.major;
      grid.config.secondarySize = spacing.minor;
      if (this.appearance.gridMode === "fade_far") {
        grid.config.distance = 900;
      } else if (this.appearance.gridMode === "subtle") {
        grid.config.distance = 450;
        grid.config.color = new THREE.Color(sky.grid).multiplyScalar(0.65);
      } else {
        grid.config.distance = 650;
      }
    }
    this.applyGridAxes();
    if (this.container) {
      const background = getBimBackgroundProfile(this.appearance.backgroundTheme);
      this.container.style.background =
        this.appearance.backgroundTheme === "transparent" ? "transparent" : background.container;
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
      this.applyCameraNavigation();
      return;
    }
    controls.mouseButtons.left = CAM_ROTATE;
    controls.mouseButtons.right = CAM_TRUCK;
    controls.mouseButtons.middle = CAM_TRUCK;
    controls.mouseButtons.wheel = CAM_DOLLY;
    controls.touches.one = CAM_TOUCH_ROTATE;
    controls.touches.two = CAM_TOUCH_DOLLY_TRUCK;
    this.applyCameraNavigation();
  }

  private applyCameraNavigation(): void {
    const controls = this.world?.camera?.controls;
    if (!controls) return;
    const profile = getBimCameraNavigationProfile(this.appearance.navigationSpeed);
    controls.smoothTime = profile.smoothTime;
    controls.draggingSmoothTime = profile.draggingSmoothTime;
    controls.azimuthRotateSpeed = profile.azimuthRotateSpeed;
    controls.polarRotateSpeed = profile.polarRotateSpeed;
    if (this.cameraMode === "walk") {
      controls.dollySpeed = profile.walkDollySpeed;
      controls.truckSpeed = profile.walkTruckSpeed;
    } else {
      controls.dollySpeed = profile.dollySpeed;
      controls.truckSpeed = profile.truckSpeed;
    }
  }

  /** First-person look + keyboard / joystick movement. */
  // fallow-ignore-next-line complexity
  private applyWalkNavigation(): void {
    if (this.cameraMode !== "walk") return;
    const world = this.world;
    const controls = world?.camera?.controls;
    if (!world || !controls) return;
    world.camera.enabled = true;
    // When pointer-locked, look is driven by movementX/Y — disable drag-rotate.
    controls.mouseButtons.left = this.walkPointerLocked ? CAM_NONE : CAM_ROTATE;
    controls.mouseButtons.right = CAM_NONE;
    controls.mouseButtons.middle = CAM_TRUCK;
    controls.mouseButtons.wheel = CAM_DOLLY;
    controls.touches.one = CAM_TOUCH_ROTATE;
    controls.touches.two = CAM_TOUCH_DOLLY_TRUCK;
    this.applyCameraNavigation();
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
    world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.PostproductionRenderer>,
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
    world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.PostproductionRenderer>,
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
    world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.PostproductionRenderer>,
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
        bakePx: this.planBakePx,
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
        if (resolved) return [resolved];
        if (this.storeyMaps.has(storeyName)) return [storeyName];
        return [];
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
  private async placeWalkOnStorey(
    storeyName: string,
    animate: boolean,
    anchor?: { x: number; z: number },
  ): Promise<void> {
    const world = this.world;
    if (!world || this.cameraMode !== "walk") return;
    try {
      const hint = await this.getStoreyWalkHint(storeyName);
      const box = this.getModelBoundingBox();
      if (!hint || !this.isValidBox3(box)) return;

      this.planMinimapStoreyFloorY = hint.floorY;
      const cam = world.camera.three.position;
      const inset = this.walkFeetInset(hint.bounds);
      const loX = Math.min(hint.bounds.min.x + inset, hint.bounds.max.x - inset);
      const hiX = Math.max(hint.bounds.min.x + inset, hint.bounds.max.x - inset);
      const loZ = Math.min(hint.bounds.min.z + inset, hint.bounds.max.z - inset);
      const hiZ = Math.max(hint.bounds.min.z + inset, hint.bounds.max.z - inset);
      const preferX = anchor?.x ?? cam.x;
      const preferZ = anchor?.z ?? cam.z;
      const x = THREE.MathUtils.clamp(preferX, loX, hiX);
      const z = THREE.MathUtils.clamp(preferZ, loZ, hiZ);
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

  getPlanMinimapStorey(): string | null {
    return this.planMinimapStorey;
  }

  /**
   * Pick the storey to land on when entering walk:
   * preferred plan floor → sole visible storey → nearest to camera/target Y → first storey.
   */
  // fallow-ignore-next-line complexity
  async resolveWalkEntryStorey(preferred?: string | null): Promise<string | null> {
    const names = [...this.storeyMaps.keys()];
    if (names.length === 0) return null;

    const pref =
      this.resolveStoreyName(preferred) ?? this.resolveStoreyName(this.planMinimapStorey);
    if (pref && this.storeyMaps.has(pref)) return pref;

    const visible = names.filter((name) => this.storeyVisible.get(name) ?? true);
    if (visible.length === 1 && visible.length < names.length) return visible[0]!;

    const world = this.world;
    const hintY = world ? world.camera.controls.getTarget(new THREE.Vector3()).y : Number.NaN;
    const camY = world?.camera.three.position.y;
    const refY = Number.isFinite(hintY)
      ? hintY
      : Number.isFinite(camY)
        ? (camY as number)
        : Number.NaN;

    if (Number.isFinite(refY)) {
      const hints = await Promise.all(
        names.map(async (name) => ({ name, hint: await this.getStoreyWalkHint(name) })),
      );
      let best: string | null = null;
      let bestDist = Infinity;
      for (const { name, hint } of hints) {
        if (!hint) continue;
        const dist = Math.abs(hint.floorY - refY);
        if (dist < bestDist) {
          bestDist = dist;
          best = name;
        }
      }
      if (best) return best;
    }

    return visible[0] ?? names[0] ?? null;
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
      silhouetteBakePx: this.planBakePx,
      baking: this.planSilhouetteBaking || this.planSilhouetteDirty,
      activeStorey: this.planMinimapStorey,
    };
  }

  /** Raise/lower the plan silhouette bake resolution (px). Rebakes if changed. */
  setPlanBakeResolution(px: number): void {
    const next = Math.max(256, Math.round(px));
    if (this.planBakePx === next) return;
    this.planBakePx = next;
    this.planSilhouetteDirty = true;
    this.schedulePlanSilhouetteBake();
  }

  // fallow-ignore-next-line complexity
  async setPlanMinimapStorey(name: string | null): Promise<void> {
    const resolved = name ? this.resolveStoreyName(name) : null;
    const next = resolved ?? name;
    const storeyChanged = this.planMinimapStorey !== next;
    if (!storeyChanged && !this.planSilhouetteDirty) return;
    this.planMinimapStorey = next;
    if (storeyChanged) {
      this.planSilhouetteDirty = true;
      this.cancelPlanSilhouetteBakeTimer();
    }

    // Only teleport when the floor selection changes (not on silhouette re-sync).
    if (this.cameraMode === "walk" && next && storeyChanged) {
      try {
        await this.placeWalkOnStorey(next, true);
      } catch {
        /* Floor teleport is best-effort. */
      }
    } else if (!next) {
      this.planMinimapStoreyFloorY = null;
    }

    if (storeyChanged || this.planSilhouetteDirty) {
      await this.bakePlanSilhouetteNow();
    }
  }

  // fallow-ignore-next-line complexity, unused-class-member
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
    const profile = getBimCameraNavigationProfile(this.appearance.navigationSpeed);
    void controls.rotate(
      -dx * profile.viewCubeRotateSensitivity,
      -dy * profile.viewCubeRotateSensitivity,
      false,
    );
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

  private modelIdMapHas(
    map: OBC.ModelIdMap | null | undefined,
    modelId: string,
    localId: number,
  ): boolean {
    const ids = map?.[modelId];
    return ids instanceof Set && ids.has(localId);
  }

  private isFilterGhostLocalId(modelId: string, localId: number): boolean {
    return this.modelIdMapHas(this.activeFilterGhostMap, modelId, localId);
  }

  /** All fragment hits under the pointer, nearest first — used to pierce ghosts. */
  private async raycastAllAtPointer(
    e: PointerEvent,
  ): Promise<Array<{ modelId: string; localId: number; distance: number }>> {
    const world = this.world;
    const components = this.components;
    if (!world?.renderer || !components) return [];
    const fragments = components.get(OBC.FragmentsManager);
    if (!fragments.initialized || fragments.list.size === 0) return [];

    const data = {
      camera: world.camera.three as THREE.PerspectiveCamera,
      mouse: new THREE.Vector2(e.clientX, e.clientY),
      dom: world.renderer.three.domElement,
    };
    const hits: Array<{ modelId: string; localId: number; distance: number }> = [];
    for (const model of fragments.list.values()) {
      try {
        const results = await model.raycastAll(data);
        if (!results) continue;
        for (const hit of results) {
          if (hit.localId == null) continue;
          hits.push({
            modelId: hit.fragments.modelId,
            localId: hit.localId,
            distance: hit.distance,
          });
        }
      } catch {
        /* model may dispose mid-pick */
      }
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  /**
   * When worker hits only return the front occluder, fall back to ray ∩ allow-list
   * AABBs so clash Item 1/2 remain clickable through faded context.
   */
  // fallow-ignore-next-line complexity
  private async pickAllowMapByBounds(
    e: PointerEvent,
    allowMap: OBC.ModelIdMap,
  ): Promise<{ modelId: string; localId: number } | null> {
    const world = this.world;
    const components = this.components;
    if (!world?.renderer || !components) return null;
    const fragments = components.get(OBC.FragmentsManager);
    if (!fragments.initialized) return null;

    const ndc = this.pointerNdc(e);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, world.camera.three);
    const ray = raycaster.ray;
    const hitPoint = new THREE.Vector3();
    let best: { modelId: string; localId: number; distance: number } | null = null;

    for (const [modelId, idSet] of Object.entries(allowMap)) {
      if (!(idSet instanceof Set) || idSet.size === 0) continue;
      const model = fragments.list.get(modelId);
      if (!model) continue;
      const localIds = [...idSet];
      let boxes: THREE.Box3[] = [];
      try {
        boxes = await model.getBoxes(localIds);
      } catch {
        continue;
      }
      for (let i = 0; i < localIds.length; i++) {
        const box = boxes[i];
        const localId = localIds[i]!;
        if (!box || !this.isValidBox3(box)) continue;
        if (!ray.intersectBox(box, hitPoint)) continue;
        const distance = ray.origin.distanceTo(hitPoint);
        if (!best || distance < best.distance) {
          best = { modelId, localId, distance };
        }
      }
    }
    return best ? { modelId: best.modelId, localId: best.localId } : null;
  }

  /** Pick only allow-listed items; pierces any geometry not in the map. */
  private async pickFromAllowMap(
    e: PointerEvent,
    allowMap: OBC.ModelIdMap,
  ): Promise<{ modelId: string; localId: number } | null> {
    for (const hit of await this.raycastAllAtPointer(e)) {
      if (this.modelIdMapHas(allowMap, hit.modelId, hit.localId)) {
        return { modelId: hit.modelId, localId: hit.localId };
      }
    }
    return this.pickAllowMapByBounds(e, allowMap);
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

    // Clash Ghost: faded context is look-only — only Item 1/2 are selectable.
    if (this.clashGhostPickOnly) {
      if (!this.clashPickAllowMap) return null;
      return this.pickFromAllowMap(e, this.clashPickAllowMap);
    }

    // Filter Ghost: skip dimmed ids and pierce through to visible matches.
    if (this.activeFilterGhostMap) {
      for (const hit of await this.raycastAllAtPointer(e)) {
        if (!this.isFilterGhostLocalId(hit.modelId, hit.localId)) {
          return { modelId: hit.modelId, localId: hit.localId };
        }
      }
      return null;
    }

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
      world.renderer.needsUpdate = true;
      world.renderer.update();
    }
  }

  /** Coalesce highlight re-apply after tile/material stream (avoids ghost flicker). */
  private scheduleHighlightRepaint(): void {
    if (this.disposed || !this.hasActiveFragmentHighlights()) return;
    if (this.highlightRepaintTimer != null) window.clearTimeout(this.highlightRepaintTimer);
    this.highlightRepaintTimer = window.setTimeout(() => {
      this.highlightRepaintTimer = null;
      if (this.hasActiveFragmentHighlights()) void this.requestFragmentHighlights();
    }, 280);
  }

  /** Re-apply PBR + space colors when fragments stream in new tile materials. */
  // fallow-ignore-next-line complexity
  private scheduleMaterialSync(): void {
    if (this.disposed || this.modelRegistry.size === 0 || this.materialSyncInProgress) return;
    // PBR recolor fights fragment highlights / clash scene ghost — defer.
    if (this.shouldDeferMaterialSync()) {
      this.pendingMaterialSync = true;
      if (this.hasActiveFragmentHighlights()) this.scheduleHighlightRepaint();
      if (this.clashSceneGhostOpacity != null) this.scheduleClashSceneGhostRefresh();
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

    if (!this.viewportBackground && this.appearance.backgroundTheme !== "transparent") {
      this.viewportBackground = createBimSkyTexture(this.appearance.backgroundTheme);
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

  private configureRendererContainer(
    renderer: OBF.PostproductionRenderer,
    container: HTMLElement,
  ): void {
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
  private syncRendererSize(renderer: OBF.PostproductionRenderer): void {
    const container = this.container;
    if (!container) return;
    const w = Math.floor(container.clientWidth);
    const h = Math.floor(container.clientHeight);
    if (w < MIN_CANVAS_PX || h < MIN_CANVAS_PX) return;

    renderer.resize(new THREE.Vector2(w, h));
    renderer.three.setPixelRatio(bimViewportPixelRatio());
    this.renderEffects?.resize();

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
    const flyToSmooth = getBimCameraNavigationProfile(
      this.appearance.navigationSpeed,
    ).flyToSmoothTime;
    controls.smoothTime = Math.max(prevSmooth, flyToSmooth);

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
  private async handleHighlight(
    map: OBC.ModelIdMap,
    preferModelId?: string | null,
    showSelectionOutline = true,
  ): Promise<void> {
    if (showSelectionOutline) void this.renderEffects?.setSelection(map);
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
    this.selectionOrbitPoint = null;
    void this.requestFragmentHighlights();
    void this.renderEffects?.setSelection(null);
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
      // Clears both the 2-handle gizmo and any 6-plane selection section box.
      this.deleteClippingPlanes();
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

  /** Confirms the in-progress measurement point (mobile button / P / Enter). */
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
    const clipper = this.components?.get(OBC.Clipper);
    if (clipper) {
      for (const [, plane] of clipper.list) {
        plane.controls.detach();
        plane.controls.enabled = false;
      }
      clipper.deleteAll();
      clipper.enabled = false;
    }
    this.bumpRender();
  }

  // fallow-ignore-next-line complexity
  private onGlobalKeyDown = (e: KeyboardEvent): void => {
    if (this.isTypingTarget(e.target)) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const mod = e.ctrlKey || e.metaKey;

    if (e.key === "Escape") {
      if (this.walkPointerLocked) {
        this.exitWalkPointerLock();
        return;
      }
      e.preventDefault();
      this.activeMeasurement()?.cancelCreation();
      // Same as context-menu "Show all objects": restore visibility, clip, selection.
      void this.showAllElements();
      return;
    }

    if (mod && key === "l") {
      e.preventDefault();
      this.events.onCopyViewLink?.();
      return;
    }

    if (mod && key === "z") {
      if (this.activeMeasurement()) {
        e.preventDefault();
        this.undoActiveMeasurement();
      }
      return;
    }

    if (key === " " || e.code === "Space") {
      e.preventDefault();
      void this.zoomToSelection();
      return;
    }

    if (key === "h") {
      if (this.tool === "select" && this.selectedGuids.size > 0) {
        e.preventDefault();
        void this.hideSelection();
      }
      return;
    }

    if (key === "p" || e.key === "Enter") {
      if (this.activeMeasurement()) {
        e.preventDefault();
        this.measureConfirmPoint();
      }
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

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return el.isContentEditable === true;
  }

  private undoActiveMeasurement(): void {
    const m = this.activeMeasurement();
    if (!m) return;
    m.cancelCreation();
    m.delete();
    this.bumpRender();
  }

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
    // Await the pick first so we open one menu (long when an element is hit),
    // instead of flashing the empty short menu then replacing it.
    void this.openContextMenuAfterPick(e);
  };

  private async openContextMenuAfterPick(e: MouseEvent): Promise<void> {
    const pickPromise = this.selectAtPointer(e as unknown as PointerEvent, {
      additive: e.ctrlKey || e.metaKey,
      forContextMenu: true,
    });
    this.contextMenuPickPromise = pickPromise;
    try {
      const picked = await pickPromise;
      const hasSelection = picked || this.selectedGuids.size > 0 || this.lastPickMap != null;
      this.events.onContextMenu?.({
        x: e.clientX,
        y: e.clientY,
        hasSelection,
      });
    } catch {
      const hasSelection = this.selectedGuids.size > 0 || this.lastPickMap != null;
      this.events.onContextMenu?.({
        x: e.clientX,
        y: e.clientY,
        hasSelection,
      });
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
    // Before camera-controls starts a drag, lock the pivot to the selection.
    if (
      this.selectionOrbitPoint &&
      this.cameraMode === "orbit" &&
      (e.button === 0 || e.button === 1 || e.button === 2)
    ) {
      this.applyCachedSelectionOrbitPoint();
    }

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

    if (this.cameraMode === "walk") {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".bim-plan-minimap, .bim-walk-chrome, .bim-split-pane")) return;
      if (!this.walkPointerLocked) this.requestWalkPointerLock();
      return;
    }

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

    if (guid && hit) {
      const meta = this.modelRegistry.get(hit.modelId);
      this.guidIndex.set(guid, {
        modelId: hit.modelId,
        localId: hit.localId,
        fileVersionId: meta?.fileVersionId ?? "",
        sourceLabel: meta?.name ?? "Model",
      });
    }

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
    void this.focusOrbitOnSelectionMap(map);
    this.bumpRender();
    this.events.onMultiSelection?.([...this.selectedGuids]);
    return true;
  }

  // --------------------------------------------------------------- camera

  // fallow-ignore-next-line complexity
  async setCameraMode(
    mode: BimCameraMode,
    opts?: { preferredStorey?: string | null },
  ): Promise<void> {
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
        this.applyWalkNavigation();

        const storey = await this.resolveWalkEntryStorey(opts?.preferredStorey);
        if (storey) {
          this.planMinimapStorey = storey;
          this.planSilhouetteDirty = true;
          await this.placeWalkOnStorey(storey, false, { x: walkPivot.x, z: walkPivot.z });
          this.schedulePlanSilhouetteBake();
        } else {
          await this.enterWalkCamera(walkPivot);
          this.planSilhouetteDirty = true;
          this.schedulePlanSilhouetteBake();
        }
        this.startWalkLoop();
      } else {
        world.camera.set("Orbit");
        this.exitWalkPointerLock();
        this.stopWalkLoop();
        this.applyBim360Navigation();
      }
    } finally {
      this.renderEffects?.updateCamera();
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
    this.renderEffects?.updateCamera();
    this.bumpRender();
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
    if (this.isTypingTarget(e.target)) return;
    this.walkShiftHeld = e.shiftKey;
    const k = e.key.toLowerCase();
    this.walkKeys.add(k);
    if (
      k === "w" ||
      k === "a" ||
      k === "s" ||
      k === "d" ||
      k === "q" ||
      k === "e" ||
      k === "r" ||
      k === "f" ||
      k === "arrowup" ||
      k === "arrowdown" ||
      k === "arrowleft" ||
      k === "arrowright"
    ) {
      e.preventDefault();
    }
  };

  private onWalkKeyUp = (e: KeyboardEvent): void => {
    this.walkShiftHeld = e.shiftKey;
    this.walkKeys.delete(e.key.toLowerCase());
  };

  private onWalkWindowBlur = (): void => {
    this.walkKeys.clear();
    this.walkShiftHeld = false;
    this.walkVelocity = { forward: 0, strafe: 0, vertical: 0 };
  };

  private getWalkPointerLockElement(): Element | null {
    return this.world?.renderer?.three.domElement ?? this.container;
  }

  private requestWalkPointerLock(): void {
    if (this.cameraMode !== "walk" || this.disposed) return;
    const el = this.getWalkPointerLockElement();
    if (!el || document.pointerLockElement === el) return;
    void (el as HTMLElement).requestPointerLock?.();
  }

  private exitWalkPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    if (this.walkPointerLocked) {
      this.walkPointerLocked = false;
      this.applyWalkNavigation();
    }
  }

  private onPointerLockChange = (): void => {
    const el = this.getWalkPointerLockElement();
    const locked = !!el && document.pointerLockElement === el;
    if (this.walkPointerLocked === locked) return;
    this.walkPointerLocked = locked;
    if (this.cameraMode === "walk") this.applyWalkNavigation();
  };

  private onPointerLockMouseMove = (e: MouseEvent): void => {
    if (!this.walkPointerLocked || this.cameraMode !== "walk" || this.disposed) return;
    const controls = this.world?.camera?.controls;
    if (!controls) return;
    if (e.movementX === 0 && e.movementY === 0) return;
    const profile = getBimCameraNavigationProfile(this.appearance.navigationSpeed);
    const sens = WALK_LOOK_SENS * profile.azimuthRotateSpeed;
    void controls.rotate(-e.movementX * sens, -e.movementY * sens, false);
    this.bumpRender();
  };

  private startWalkLoop(): void {
    if (this.walkRaf != null) return;
    this.walkLastTime = performance.now();
    this.walkVelocity = { forward: 0, strafe: 0, vertical: 0 };
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
    this.walkShiftHeld = false;
    this.walkJoystick = { forward: 0, strafe: 0 };
    this.walkVelocity = { forward: 0, strafe: 0, vertical: 0 };
  }

  private approachWalkAxis(current: number, target: number, dt: number): number {
    const rate = (Math.abs(target) < 1e-4 ? WALK_DECEL : WALK_ACCEL) * dt;
    const delta = target - current;
    if (Math.abs(delta) <= rate) return target;
    return current + Math.sign(delta) * rate;
  }

  // fallow-ignore-next-line complexity
  private applyWalkStep(dt: number, now: number): void {
    const world = this.world;
    if (!world) return;

    let targetForward = this.walkJoystick.forward;
    let targetStrafe = this.walkJoystick.strafe;
    let targetVertical = 0;

    if (this.walkKeys.has("w") || this.walkKeys.has("arrowup")) targetForward += 1;
    if (this.walkKeys.has("s") || this.walkKeys.has("arrowdown")) targetForward -= 1;
    if (this.walkKeys.has("d") || this.walkKeys.has("arrowright")) targetStrafe += 1;
    if (this.walkKeys.has("a") || this.walkKeys.has("arrowleft")) targetStrafe -= 1;
    // E/R up, Q/F down (game fly + CAD-style aliases).
    if (this.walkKeys.has("e") || this.walkKeys.has("r")) targetVertical += 1;
    if (this.walkKeys.has("q") || this.walkKeys.has("f")) targetVertical -= 1;

    targetForward = Math.max(-1, Math.min(1, targetForward));
    targetStrafe = Math.max(-1, Math.min(1, targetStrafe));
    targetVertical = Math.max(-1, Math.min(1, targetVertical));

    // Normalize horizontal diagonals so W+A is not faster than W.
    const horizLen = Math.hypot(targetForward, targetStrafe);
    if (horizLen > 1) {
      targetForward /= horizLen;
      targetStrafe /= horizLen;
    }

    // Collision only gates forward; vertical stays free-fly.
    if (targetForward > 0) {
      if (now - this.walkLastCollisionPoll > WALK_COLLISION_POLL_MS) {
        this.walkLastCollisionPoll = now;
        void this.pollForwardCollision();
      }
      if (
        this.walkBlockedUntilDistance != null &&
        this.walkBlockedUntilDistance < WALK_COLLISION_DISTANCE
      ) {
        targetForward = 0;
      }
    }

    this.walkVelocity.forward = this.approachWalkAxis(this.walkVelocity.forward, targetForward, dt);
    this.walkVelocity.strafe = this.approachWalkAxis(this.walkVelocity.strafe, targetStrafe, dt);
    this.walkVelocity.vertical = this.approachWalkAxis(
      this.walkVelocity.vertical,
      targetVertical,
      dt,
    );

    const { forward, strafe, vertical } = this.walkVelocity;
    if (Math.abs(forward) < 1e-4 && Math.abs(strafe) < 1e-4 && Math.abs(vertical) < 1e-4) {
      this.walkVelocity = { forward: 0, strafe: 0, vertical: 0 };
      return;
    }

    const sprint = this.walkShiftHeld || this.walkKeys.has("shift");
    const baseSpeed = getBimCameraNavigationProfile(this.appearance.navigationSpeed).walkSpeed;
    const speed = baseSpeed * (sprint ? WALK_SPRINT_MULTIPLIER : 1);
    const vertSpeed = speed * WALK_VERTICAL_FACTOR;
    const controls = world.camera.controls;

    if (Math.abs(forward) >= 1e-4) controls.forward(forward * speed * dt, false);
    if (Math.abs(strafe) >= 1e-4) controls.truck(strafe * speed * dt, 0, false);
    if (Math.abs(vertical) >= 1e-4) controls.elevate(vertical * vertSpeed * dt, false);
    this.bumpRender();
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
    return this.resolveGuidRefsToModelIdMap(guids.map((guid) => ({ guid })));
  }

  /**
   * Resolve IFC guids to fragment local ids, preferring a fileVersion when set
   * so federated models with colliding GlobalIds still map correctly.
   */
  // fallow-ignore-next-line complexity
  private async resolveGuidRefsToModelIdMap(
    refs: { guid: string; fileVersionId?: string | null }[],
  ): Promise<OBC.ModelIdMap | null> {
    if (refs.length === 0) return null;
    const map: OBC.ModelIdMap = {};
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return null;

    const unresolved: { guid: string; fileVersionId?: string | null }[] = [];

    for (const ref of refs) {
      const guid = ref.guid?.trim();
      if (!guid) continue;
      const indexed = this.guidIndex.get(guid);
      if (
        indexed &&
        (!ref.fileVersionId || indexed.fileVersionId === ref.fileVersionId) &&
        fragments.list.has(indexed.modelId)
      ) {
        if (!map[indexed.modelId]) map[indexed.modelId] = new Set<number>();
        (map[indexed.modelId] as Set<number>).add(indexed.localId);
        continue;
      }
      unresolved.push({ guid, fileVersionId: ref.fileVersionId });
    }

    for (const ref of unresolved) {
      const candidates = [...this.modelRegistry.entries()].filter(([, entry]) =>
        ref.fileVersionId ? entry.fileVersionId === ref.fileVersionId : true,
      );
      let found = false;
      for (const [modelId, entry] of candidates) {
        const model = fragments.list.get(modelId);
        if (!model) continue;
        try {
          const [localId] = await model.getLocalIdsByGuids([ref.guid]);
          if (localId == null) continue;
          if (!map[modelId]) map[modelId] = new Set<number>();
          (map[modelId] as Set<number>).add(localId);
          this.guidIndex.set(ref.guid, {
            modelId,
            localId,
            fileVersionId: entry.fileVersionId,
            sourceLabel: entry.name,
          });
          found = true;
          break;
        } catch {
          /* try next model */
        }
      }
      if (found || ref.fileVersionId) continue;
      try {
        const fallback = await fragments.guidsToModelIdMap([ref.guid]);
        if (!fallback) continue;
        for (const [modelId, ids] of Object.entries(fallback)) {
          if (!(ids instanceof Set) || ids.size === 0) continue;
          if (!map[modelId]) map[modelId] = new Set<number>();
          for (const id of ids) {
            (map[modelId] as Set<number>).add(id);
            const meta = this.modelRegistry.get(modelId);
            this.guidIndex.set(ref.guid, {
              modelId,
              localId: id,
              fileVersionId: meta?.fileVersionId ?? "",
              sourceLabel: meta?.name ?? "Model",
            });
          }
        }
      } catch {
        /* optional */
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
    void this.focusOrbitOnSelectionMap(map);
    this.events.onMultiSelection?.([...this.selectedGuids]);
  }

  /**
   * Remember guids as the active selection without painting the default select
   * style (used by clash review so red/green item colors stay visible).
   */
  // fallow-ignore-next-line unused-class-member
  rememberSelectionGuids(guids: string[]): void {
    this.selectedGuids.clear();
    for (const g of guids) this.selectedGuids.add(g);
    this.lastPickMap = this.buildModelIdMapFromGuids(guids);
    this.events.onMultiSelection?.([...this.selectedGuids]);
  }

  private isClashItemMaterial(mat: THREE.Material): boolean {
    const customId = mat.userData?.customId;
    return typeof customId === "string" && customId.startsWith("clash-item");
  }

  /** Fade + desaturate a fragment material for clash scene ghost (O(1) per material). */
  private ghostClashMaterial(mat: THREE.Material, opacity: number): void {
    if (!("opacity" in mat)) return;
    if (this.isClashItemMaterial(mat)) {
      this.solidifyClashItemMaterial(mat);
      return;
    }
    const m = mat as THREE.Material & {
      opacity: number;
      transparent: boolean;
      depthWrite: boolean;
      needsUpdate: boolean;
      color?: THREE.Color;
      emissive?: THREE.Color;
    };
    if (!this.clashGhostMatBackup.has(m)) {
      this.clashGhostMatBackup.set(m, {
        opacity: m.opacity,
        transparent: m.transparent,
        depthWrite: m.depthWrite,
        color: m.color ? m.color.clone() : undefined,
        emissive: m.emissive ? m.emissive.clone() : undefined,
      });
    }
    // Ghost context must not write depth or it will occlude the clash pair and
    // make federated models look like disconnected opaque patches.
    const pipelineChanged = !m.transparent || m.depthWrite;
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = false;
    // Strip material color so the building reads as a faint silhouette, not painted BIM.
    if (m.color) m.color.copy(BimEngine.CLASH_GHOST_TINT);
    if (m.emissive) m.emissive.setRGB(0, 0, 0);
    if ("highlightOpacity" in m) {
      (m as THREE.Material & { highlightOpacity: number }).highlightOpacity = opacity;
    }
    if (pipelineChanged) m.needsUpdate = true;
  }

  /** Force Item 1/2 overlays back to opaque solid colors (Navisworks style). */
  private solidifyClashItemMaterial(mat: THREE.Material): void {
    if (!("opacity" in mat)) return;
    const m = mat as THREE.Material & {
      opacity: number;
      transparent: boolean;
      depthWrite: boolean;
      depthTest: boolean;
      needsUpdate: boolean;
    };
    // If this material was previously ghosted by mistake, drop the backup so
    // clearing review doesn't restore a faded opacity onto a clash color.
    this.clashGhostMatBackup.delete(m);
    const pipelineChanged = m.transparent || !m.depthWrite || m.opacity < 1;
    m.opacity = 1;
    m.transparent = false;
    m.depthWrite = true;
    m.depthTest = true;
    if ("highlightOpacity" in m) {
      (m as THREE.Material & { highlightOpacity: number }).highlightOpacity = 1;
    }
    if (pipelineChanged) m.needsUpdate = true;
  }

  private collectFragmentMaterials(): Set<THREE.Material> {
    const materials = new Set<THREE.Material>();
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return materials;
    for (const [, mat] of fragments.core.models.materials.list) {
      materials.add(mat as unknown as THREE.Material);
    }
    // Federated/streamed meshes may expose materials on the scene graph before
    // they appear in the shared registry.
    for (const [, model] of fragments.list) {
      model.object.traverse((object) => {
        if (!("material" in object)) return;
        const material = (object as THREE.Mesh).material;
        if (Array.isArray(material)) {
          for (const item of material) {
            if (item instanceof THREE.Material) materials.add(item);
          }
        } else if (material instanceof THREE.Material) {
          materials.add(material);
        }
      });
    }
    return materials;
  }

  /** Keep clash Item 1/2 materials opaque after any scene ghost pass. */
  private solidifyClashItemMaterials(): void {
    for (const material of this.collectFragmentMaterials()) {
      if (this.isClashItemMaterial(material)) this.solidifyClashItemMaterial(material);
    }
  }

  /**
   * Navisworks-style context: fade loaded model materials (but not Item 1/2
   * overlays) instead of highlighting hundreds of thousands of element ids.
   */
  // fallow-ignore-next-line complexity
  private applyClashSceneGhost(opacity: number): void {
    const fragments = this.components?.get(OBC.FragmentsManager);
    if (!fragments?.initialized) return;
    this.clashSceneGhostOpacity = opacity;
    for (const material of this.collectFragmentMaterials()) {
      this.ghostClashMaterial(material, opacity);
    }
    this.solidifyClashItemMaterials();
    this.bumpRender();
  }

  /** Fragment/LOD updates wipe material opacity — coalesce a full re-fade. */
  private scheduleClashSceneGhostRefresh(): void {
    if (this.disposed || this.clashSceneGhostOpacity == null) return;
    if (this.clashGhostRefreshTimer != null) window.clearTimeout(this.clashGhostRefreshTimer);
    this.clashGhostRefreshTimer = window.setTimeout(() => {
      this.clashGhostRefreshTimer = null;
      if (this.clashSceneGhostOpacity == null) return;
      void this.paintClashItemHighlights().then(() => {
        if (this.clashSceneGhostOpacity == null) return;
        this.applyClashSceneGhost(this.clashSceneGhostOpacity);
      });
    }, 240);
  }

  /**
   * Re-apply Item 1/2 colors without resetHighlight / core.update.
   * Avoids fragment updates that would wipe the scene ghost again.
   */
  // fallow-ignore-next-line complexity
  private async paintClashItemHighlights(): Promise<void> {
    const fragments = this.readyFragments();
    if (!fragments || this.disposed) return;
    const groups = this.activeColorizeGroups.filter((g) => g.styleId.startsWith("clash-item"));
    if (groups.length === 0) return;
    for (const group of groups) {
      const safeMap = this.sanitizeHighlightMap(group.map, fragments);
      if (!safeMap) continue;
      try {
        await fragments.highlight(
          {
            color: new THREE.Color(group.color),
            opacity: 1,
            transparent: false,
            renderedFaces: 0,
            depthTest: true,
            depthWrite: true,
            customId: group.styleId,
          },
          safeMap,
        );
      } catch {
        /* stale maps during tile churn */
      }
    }
    this.solidifyClashItemMaterials();
    this.bumpRender();
  }

  private clearClashSceneGhost(): void {
    if (this.clashGhostRefreshTimer != null) {
      window.clearTimeout(this.clashGhostRefreshTimer);
      this.clashGhostRefreshTimer = null;
    }
    this.clashSceneGhostOpacity = null;
    for (const [mat, prev] of this.clashGhostMatBackup) {
      try {
        const m = mat as THREE.Material & {
          opacity: number;
          transparent: boolean;
          depthWrite: boolean;
          needsUpdate: boolean;
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        m.opacity = prev.opacity;
        m.transparent = prev.transparent;
        m.depthWrite = prev.depthWrite;
        if (prev.color && m.color) m.color.copy(prev.color);
        if (prev.emissive && m.emissive) m.emissive.copy(prev.emissive);
        m.needsUpdate = true;
      } catch {
        /* material may already be disposed with unloaded tiles */
      }
    }
    this.clashGhostMatBackup.clear();
  }

  /**
   * Clash focus presentation:
   * - color: full federation opaque + Item 1 green / Item 2 red
   * - ghost: fade all models + solid clash pair
   * - hide: isolate only the clash pair
   */
  // fallow-ignore-next-line unused-class-member, complexity
  async presentClashPartners(opts: {
    a: { guid: string; fileVersionId?: string | null };
    b: { guid: string; fileVersionId?: string | null };
    /** World-space clash contact point — preferred camera focus. */
    point?: { x: number; y: number; z: number } | null;
    context?: "color" | "ghost" | "hide";
    ghostOpacity?: number;
    /** When false, re-paint only (e.g. Color/Ghost/Hide toggle). Default true. */
    refocusCamera?: boolean;
  }): Promise<void> {
    const refs = [opts.a, opts.b].filter((r) => r.guid);
    if (refs.length === 0) return;
    const context = opts.context ?? "color";
    const refocusCamera = opts.refocusCamera !== false;
    const seq = ++this.clashPresentSeq;
    const stillCurrent = () => !this.disposed && this.clashPresentSeq === seq;

    this.clashReviewSuppressSelectPaint = true;
    this.clashGhostPickOnly = false;
    this.clashPickAllowMap = null;
    this.selectedGuids.clear();
    this.lastPickMap = null;
    this.lastPickedModelId = null;
    this.activeFilterGhostMap = null;
    // Always drop prior ghost/hide so Color/Ghost/Hide toggles start from a clean baseline.
    this.clearClashSceneGhost();
    await this.renderEffects?.setSelection(null);
    if (!stillCurrent()) return;
    this.events.onSelection(null);
    this.events.onMultiSelection?.([]);

    const [itemAMap, itemBMap] = await Promise.all([
      this.resolveGuidRefsToModelIdMap([opts.a]),
      this.resolveGuidRefsToModelIdMap([opts.b]),
    ]);
    if (!stillCurrent()) return;
    const partnerMap = this.mergeModelIdMaps(itemAMap, itemBMap);
    // Ghost context: federation is visual-only; picks may only hit the clash pair.
    this.clashPickAllowMap = partnerMap;
    this.clashGhostPickOnly = context === "ghost";
    this.syncHoverEnabled();
    this.colorizeStyleIds = [];
    this.activeColorizeGroups = [];
    if (itemAMap) {
      this.colorizeStyleIds.push("clash-item-1");
      this.activeColorizeGroups.push({
        styleId: "clash-item-1",
        color: CLASH_ITEM1_COLOR,
        map: itemAMap,
      });
    }
    if (itemBMap) {
      this.colorizeStyleIds.push("clash-item-2");
      this.activeColorizeGroups.push({
        styleId: "clash-item-2",
        color: CLASH_ITEM2_COLOR,
        map: itemBMap,
      });
    }

    // Restore full visibility before Color/Ghost; Hide isolates after.
    await this.ensureBaseVisibilityForFilter();
    if (!stillCurrent()) return;
    if (context !== "hide") this.invalidatePlanSilhouette();

    if (context === "hide") {
      if (partnerMap) {
        await this.mustComponents().get(OBC.Hider).isolate(partnerMap);
        this.invalidatePlanSilhouette();
      }
      if (!stillCurrent()) return;
      await this.requestFragmentHighlights();
    } else if (context === "ghost") {
      const ghostOpacity = opts.ghostOpacity ?? CLASH_SCENE_GHOST_OPACITY;
      this.clashSceneGhostOpacity = ghostOpacity;
      await this.requestFragmentHighlights();
      if (!stillCurrent()) return;
      // Re-apply even if highlight paint already ghosted — guarantees latest opacity/tint.
      this.applyClashSceneGhost(ghostOpacity);
      this.solidifyClashItemMaterials();
      this.scheduleClashSceneGhostRefresh();
    } else {
      // Color: materials already un-ghosted above; paint solid pair on full federation.
      await this.requestFragmentHighlights();
      if (!stillCurrent()) return;
      // Highlight update can recreate materials — ensure no leftover ghost opacity.
      this.clearClashSceneGhost();
      this.solidifyClashItemMaterials();
    }

    if (!stillCurrent()) return;
    if (refocusCamera) {
      await this.zoomToClashFocus({
        point: opts.point,
        partnerMap,
        fallbackGuids: refs.map((r) => r.guid),
      });
    }
  }

  /** Inspect one clash partner in the properties panel without changing clash colors. */
  // fallow-ignore-next-line unused-class-member
  async inspectClashPartner(ref: { guid: string; fileVersionId?: string | null }): Promise<void> {
    if (!ref.guid) return;
    this.clashReviewSuppressSelectPaint = true;
    const map = await this.resolveGuidRefsToModelIdMap([ref]);
    if (!map) return;
    this.selectedGuids.clear();
    this.selectedGuids.add(ref.guid);
    this.lastPickMap = map;
    const modelId = Object.keys(map)[0] ?? null;
    this.lastPickedModelId = modelId;
    // Outline only — fragment select tint would cover Item 1/2 colors.
    await this.handleHighlight(map, modelId, true);
    this.events.onMultiSelection?.([ref.guid]);
    this.bumpRender();
  }

  /** Exit clash review presentation (pair colors + ghost + suppress flag). */
  async clearClashReviewPresentation(): Promise<void> {
    this.clashPresentSeq += 1;
    this.clashReviewSuppressSelectPaint = false;
    this.clashGhostPickOnly = false;
    this.clashPickAllowMap = null;
    this.syncHoverEnabled();
    if (this.highlightRepaintTimer != null) {
      window.clearTimeout(this.highlightRepaintTimer);
      this.highlightRepaintTimer = null;
    }
    this.clearClashSceneGhost();
    await this.applyFilterPresentation({
      filterActive: false,
      visualize: "none",
      matchGuids: [],
      colorizeGroups: [],
      force: true,
    });
    await this.showAllElements();
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
    this.clashReviewSuppressSelectPaint = false;
    this.clashGhostPickOnly = false;
    this.clashPickAllowMap = null;
    this.clearClashSceneGhost();
    await this.clearColorize();
    await this.clearFilterGhost();
    this.syncHoverEnabled();
    // Section / clip planes also hide geometry — clear them with visibility.
    const wasClip = this.tool === "clip";
    this.deleteClippingPlanes();
    if (wasClip) {
      this.tool = "select";
      this.mustComponents().get(OBF.Highlighter).config.selectEnabled = true;
      this.syncHoverEnabled();
      this.applyBim360Navigation();
      this.events.onToolChange?.("select");
    }
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
    /** Optional fileVersion-aware refs for federated isolate/ghost match sets. */
    matchRefs?: { guid: string; fileVersionId?: string | null }[];
    colorizeGroups: {
      styleId: string;
      color: string;
      guids: string[];
      fileVersionId?: string | null;
    }[];
    /** Ghost opacity for surrounding context (clash review). Default 0.18. */
    ghostOpacity?: number;
    /**
     * When true, allow clearing even during clash review (used by clash exit).
     * Filter-dock calls omit this so they cannot wipe clash ghost mid-review.
     */
    force?: boolean;
  }): Promise<void> {
    // Filter-dock idle clears must not wipe an active clash review presentation.
    const idleClear =
      !opts.filterActive && opts.visualize === "none" && opts.colorizeGroups.length === 0;
    if (idleClear && this.clashReviewSuppressSelectPaint && !opts.force) return;

    if (!opts.filterActive) {
      await this.resetFilterVisibility();
      // Clash review may have started while we awaited — do not wipe it.
      if (this.clashReviewSuppressSelectPaint && !opts.force) return;
      this.activeFilterGhostMap = null;
      this.activeColorizeGroups = [];
      this.colorizeStyleIds = [];
      await this.requestFragmentHighlights();
      this.maybeScheduleDeferredMaterialSync();
      return;
    }

    this.activeFilterGhostMap = null;

    if (opts.visualize === "none") {
      await this.resetFilterVisibility();
    } else if (opts.visualize === "isolate") {
      const map = opts.matchRefs?.length
        ? await this.resolveGuidRefsToModelIdMap(opts.matchRefs)
        : await this.resolveModelIdMapFromGuids(opts.matchGuids);
      if (map) {
        const hider = this.mustComponents().get(OBC.Hider);
        await hider.isolate(map);
        this.invalidatePlanSilhouette();
      }
    } else {
      await this.applyFilterGhostState(opts.matchGuids, opts.ghostOpacity ?? 0.18);
    }

    const nextGroups: { styleId: string; color: string; map: OBC.ModelIdMap }[] = [];
    this.colorizeStyleIds = [];
    for (const group of opts.colorizeGroups) {
      const map = await this.resolveGuidRefsToModelIdMap(
        group.guids.map((guid) => ({ guid, fileVersionId: group.fileVersionId })),
      );
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
    if (hadGhost) this.syncHoverEnabled();
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
      this.syncHoverEnabled();
      return;
    }

    const map = await this.resolveModelIdMapFromGuids(ghostGuids);
    if (!map) return;

    this.activeFilterGhostMap = map;
    this.activeFilterGhostOpacity = opacity;
    this.syncHoverEnabled();
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
    if (!enabled) {
      await this.clearFilterGhost();
      await this.resetFilterVisibility();
      this.bumpRender();
      return;
    }
    const guids = [...this.selectedGuids];
    if (guids.length > 0) {
      // Keep selection solid; fade the rest of the model.
      await this.applyFilterGhostState(guids, 0.14);
      await this.requestFragmentHighlights();
      this.bumpRender();
      return;
    }
    // No GUID index yet — fall back to hard isolate.
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    await this.mustComponents().get(OBC.Hider).isolate(map);
    this.bumpRender();
  }

  /**
   * Clip the model to a six-plane box around the selection.
   * Avoids setTool("clip") which would clearSelection() and reset to the full model.
   */
  // fallow-ignore-next-line complexity
  async sectionBoxOnSelection(): Promise<void> {
    const map = await this.getActiveSelectionMapAsync();
    if (!map) return;
    const box = await this.getModelIdMapBoundingBox(map);
    if (!box || !this.isValidBox3(box)) return;

    const mm = this.detectModelUnits() === "mm";
    const size = box.getSize(new THREE.Vector3());
    const minEdge = mm ? 500 : 0.5;
    const pad =
      size.x < minEdge || size.y < minEdge || size.z < minEdge
        ? mm
          ? 1000
          : 1
        : Math.max(size.length() * 0.04, mm ? 100 : 0.1);
    box.expandByScalar(pad);

    const world = this.mustWorld();
    const components = this.mustComponents();
    const clipper = components.get(OBC.Clipper);

    // Drop interactive 2-handle gizmo / any prior planes, then install a tight box.
    this.sectionBox?.deactivate();
    for (const [, plane] of clipper.list) {
      plane.controls.detach();
      plane.controls.enabled = false;
    }
    clipper.deleteAll();
    clipper.enabled = true;

    const { min, max } = box;
    const specs: { normal: THREE.Vector3; point: THREE.Vector3 }[] = [
      { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(min.x, 0, 0) },
      { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(max.x, 0, 0) },
      { normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(0, min.y, 0) },
      { normal: new THREE.Vector3(0, -1, 0), point: new THREE.Vector3(0, max.y, 0) },
      { normal: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, min.z) },
      { normal: new THREE.Vector3(0, 0, -1), point: new THREE.Vector3(0, 0, max.z) },
    ];
    for (const spec of specs) {
      const id = clipper.createFromNormalAndCoplanarPoint(world, spec.normal, spec.point);
      const plane = clipper.list.get(id);
      if (!plane) continue;
      plane.enabled = true;
      hideClipPlaneFace(plane);
    }
    world.renderer?.updateClippingPlanes();

    components.get(OBF.LengthMeasurement).enabled = false;
    components.get(OBF.AreaMeasurement).enabled = false;
    components.get(OBF.AngleMeasurement).enabled = false;
    components.get(OBF.Highlighter).config.selectEnabled = false;
    this.tool = "clip";
    this.syncHoverEnabled();
    this.applyBim360Navigation();
    this.events.onToolChange?.("clip");
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

  private async focusCameraOnSphere(sphere: THREE.Sphere, fitScale = 0.82): Promise<void> {
    const world = this.mustWorld();
    this.adjustCameraClipping(sphere);
    const fitSphere = sphere.clone();
    // Smaller fitScale → camera moves closer (sphere fills more of the viewport).
    fitSphere.radius *= fitScale;
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

  /**
   * Cache + apply an orbit pivot on the selection without flying the camera —
   * so the next drag inspects that area instead of a distant model-center pivot.
   */
  private async focusOrbitOnSelectionMap(map: OBC.ModelIdMap): Promise<void> {
    const box = await this.getModelIdMapBoundingBox(map);
    if (!box) {
      this.selectionOrbitPoint = null;
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
      this.selectionOrbitPoint = null;
      return;
    }
    this.selectionOrbitPoint = center;
    this.applyCachedSelectionOrbitPoint();
  }

  private applyCachedSelectionOrbitPoint(): void {
    if (this.cameraMode !== "orbit") return;
    const point = this.selectionOrbitPoint;
    const controls = this.world?.camera?.controls;
    if (!point || !controls) return;
    controls.setOrbitPoint(point.x, point.y, point.z);
    this.bumpRender();
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

  /**
   * Frame both clash partners around the contact point.
   * Prefers a comfortable neighborhood that keeps Item 1 + Item 2 visible;
   * clamps extreme pull-back for very large hosts (long walls, slabs).
   */
  // fallow-ignore-next-line complexity
  private async zoomToClashFocus(opts: {
    point?: { x: number; y: number; z: number } | null;
    partnerMap?: OBC.ModelIdMap | null;
    fallbackGuids?: string[];
  }): Promise<void> {
    const mm = this.detectModelUnits() === "mm";
    const minRadius = mm ? 2500 : 2.5;
    const maxRadius = mm ? 14000 : 14;
    // Larger than default 0.82 → more padding / farther camera.
    const fitScale = 1.08;
    const point = opts.point;
    const hasPoint =
      point != null &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z);
    const clashCenter = hasPoint && point ? new THREE.Vector3(point.x, point.y, point.z) : null;

    if (opts.partnerMap) {
      const box = await this.getModelIdMapBoundingBox(opts.partnerMap);
      if (box) {
        if (clashCenter) box.expandByPoint(clashCenter);
        const partnerSphere = new THREE.Sphere();
        box.getBoundingSphere(partnerSphere);
        if (Number.isFinite(partnerSphere.radius) && partnerSphere.radius > 0) {
          // Orbit on the clash contact when available; otherwise the pair centroid.
          const center = clashCenter?.clone() ?? partnerSphere.center.clone();
          // Radius must reach both partners from the orbit center.
          let radius = partnerSphere.center.distanceTo(center) + partnerSphere.radius * 1.15;
          radius = Math.max(minRadius, Math.min(maxRadius, radius));
          await this.focusCameraOnSphere(new THREE.Sphere(center, radius), fitScale);
          if (clashCenter) {
            this.world?.camera.controls.setOrbitPoint(clashCenter.x, clashCenter.y, clashCenter.z);
          }
          return;
        }
      }
    }

    if (clashCenter) {
      await this.focusCameraOnSphere(new THREE.Sphere(clashCenter, minRadius * 1.6), fitScale);
      return;
    }
    if (opts.fallbackGuids && opts.fallbackGuids.length > 0) {
      await this.zoomToGuids(opts.fallbackGuids);
      return;
    }
    await this.fitToView();
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
      this.renderEffects?.updateCamera();
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
    this.exitWalkPointerLock();
    this.stopWalkLoop();
    window.removeEventListener("keydown", this.onGlobalKeyDown);
    window.removeEventListener("keydown", this.onWalkKeyDown);
    window.removeEventListener("keyup", this.onWalkKeyUp);
    window.removeEventListener("blur", this.onWalkWindowBlur);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onPointerLockMouseMove);
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
    this.renderEffects?.dispose();
    this.renderEffects = null;
    this.viewportBackground?.dispose();
    this.viewportBackground = null;
    this.gridAxesHelper?.removeFromParent();
    this.gridAxesHelper = null;
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
