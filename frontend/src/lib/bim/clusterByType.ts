import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";

/** Per-model map of global-transform localId → original transform data. */
export type ClusterTransformBackup = Map<string, Map<number, FRAGS.RawGlobalTransformData>>;

/** One movable unit in a type pile (usually one element / shared instance transform). */
export type ClusterPackUnit = {
  modelId: string;
  transformLocalId: number;
  box: THREE.Box3;
};

export type ClusterCategoryPack = {
  name: string;
  units: ClusterPackUnit[];
};

/** modelId → transformLocalId → world-space translation to apply. */
export type ClusterOffsetMap = Map<string, Map<number, THREE.Vector3>>;

export type ClusterTypeLabel = {
  /** Raw IFC type / category key. */
  name: string;
  /** Display title shown above the pile. */
  title: string;
  count: number;
  position: THREE.Vector3;
};

export type ClusterLayoutResult = {
  offsets: ClusterOffsetMap;
  labels: ClusterTypeLabel[];
};

type SizedUnit = {
  unit: ClusterPackUnit;
  w: number;
  h: number;
  d: number;
};

/** Spatial / void types that produce huge messy boxes — skip in cluster view. */
const SKIP_CLUSTER_TYPE =
  /^(IfcSite|IfcBuilding|IfcBuildingStorey|IfcSpace|IfcOpeningElement|IfcVirtualElement|IfcAnnotation|IfcGrid)/i;

const PILE_GAP_FACTOR = 0.55;
const LABEL_CLEARANCE_FACTOR = 0.22;
/** Drop elements whose volume is wildly larger than the type median. */
const OUTLIER_VOLUME_FACTOR = 48;

export function shouldClusterType(typeName: string): boolean {
  return Boolean(typeName) && !SKIP_CLUSTER_TYPE.test(typeName.trim());
}

/**
 * Pack every type into a neat 3D pile (side-by-side + stacked), then place
 * piles on a shared ground grid. Returns transform offsets and label anchors.
 */
// fallow-ignore-next-line complexity
export function computeTightClusterOffsets(categories: ClusterCategoryPack[]): ClusterLayoutResult {
  const offsets: ClusterOffsetMap = new Map();
  const labels: ClusterTypeLabel[] = [];
  if (categories.length === 0) return { offsets, labels };

  const piles: {
    name: string;
    units: ClusterPackUnit[];
    localTargets: THREE.Vector3[];
    size: THREE.Vector3;
  }[] = [];

  for (const category of categories) {
    if (!shouldClusterType(category.name) || category.units.length === 0) continue;
    const packed = packTypePile(category.units);
    if (packed.units.length === 0) continue;
    piles.push({ name: category.name, ...packed });
  }
  if (piles.length === 0) return { offsets, labels };

  let worldFloorY = Infinity;
  for (const pile of piles) {
    for (const u of pile.units) worldFloorY = Math.min(worldFloorY, u.box.min.y);
  }
  if (!Number.isFinite(worldFloorY)) worldFloorY = 0;

  const avgPileSpan =
    piles.reduce((sum, p) => sum + Math.max(p.size.x, p.size.z), 0) / piles.length;
  const pileGap = Math.max(avgPileSpan * PILE_GAP_FACTOR, avgPileSpan * 0.15, 0.5);
  const cols = Math.max(1, Math.ceil(Math.sqrt(piles.length)));

  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;
  let col = 0;

  for (const pile of piles) {
    if (col >= cols && col > 0) {
      cursorX = 0;
      cursorZ += rowDepth + pileGap;
      rowDepth = 0;
      col = 0;
    }

    const originX = cursorX;
    const originZ = cursorZ;
    let maxTopY = worldFloorY;

    for (let i = 0; i < pile.units.length; i++) {
      const unit = pile.units[i]!;
      const local = pile.localTargets[i]!;
      const center = unit.box.getCenter(new THREE.Vector3());
      const target = new THREE.Vector3(originX + local.x, worldFloorY + local.y, originZ + local.z);
      const halfH = Math.max(unit.box.max.y - unit.box.min.y, 0) / 2;
      maxTopY = Math.max(maxTopY, target.y + halfH);

      const delta = target.clone().sub(center);
      let modelMap = offsets.get(unit.modelId);
      if (!modelMap) {
        modelMap = new Map();
        offsets.set(unit.modelId, modelMap);
      }
      modelMap.set(unit.transformLocalId, delta);
    }

    const labelLift = Math.max(pile.size.y * LABEL_CLEARANCE_FACTOR, pile.size.y * 0.08, 0.4);
    labels.push({
      name: pile.name,
      title: formatClusterTypeTitle(pile.name),
      count: pile.units.length,
      position: new THREE.Vector3(
        originX + pile.size.x / 2,
        maxTopY + labelLift,
        originZ + pile.size.z / 2,
      ),
    });

    cursorX += pile.size.x + pileGap;
    rowDepth = Math.max(rowDepth, pile.size.z);
    col += 1;
  }

  return { offsets, labels };
}

/** "IfcWallStandardCase" → "Wall Standard Case" */
export function formatClusterTypeTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Type";
  const withoutIfc = trimmed.replace(/^Ifc/i, "");
  const spaced = withoutIfc
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return spaced || trimmed;
}

/**
 * Pack one IFC type into a tidy 3D pile:
 * - same layer → elements sit next to each other (X then Z)
 * - next layer → stack on top (Y)
 * Uses each element's real AABB so boxes never overlap.
 */
function packTypePile(units: ClusterPackUnit[]): {
  units: ClusterPackUnit[];
  localTargets: THREE.Vector3[];
  size: THREE.Vector3;
} {
  const sized = toSizedUnits(units);
  if (sized.length === 0) {
    return { units: [], localTargets: [], size: new THREE.Vector3(1, 1, 1) };
  }

  const spans = sized.map((s) => Math.max(s.w, s.h, s.d));
  const medianSpan = percentile(spans, 0.5) || 1;
  const gap = Math.max(medianSpan * 0.22, medianSpan * 0.05);

  const n = sized.length;
  // Cubic-ish: ~∛n beside × beside × stacked.
  const side = Math.max(1, Math.ceil(Math.cbrt(n)));
  const cols = side;
  const rows = side;

  type Slot = { item: SizedUnit; layer: number; row: number; col: number };
  const slots: Slot[] = sized.map((item, i) => ({
    item,
    col: i % cols,
    row: Math.floor(i / cols) % rows,
    layer: Math.floor(i / (cols * rows)),
  }));

  const layerCount = slots.reduce((m, s) => Math.max(m, s.layer), 0) + 1;
  const centers = new Array<THREE.Vector3>(sized.length);
  let pileW = 0;
  let pileD = 0;
  let pileH = 0;
  let layerBottom = 0;

  for (let layer = 0; layer < layerCount; layer++) {
    const inLayer = slots.filter((s) => s.layer === layer);
    const layerHeight = inLayer.reduce((m, s) => Math.max(m, s.item.h), 0);
    let rowZ = 0;
    let layerDepth = 0;
    let layerWidth = 0;

    const rowIds = [...new Set(inLayer.map((s) => s.row))].sort((a, b) => a - b);
    for (const row of rowIds) {
      const inRow = inLayer.filter((s) => s.row === row).sort((a, b) => a.col - b.col);
      const rowDepth = inRow.reduce((m, s) => Math.max(m, s.item.d), 0);
      let x = 0;

      for (const slot of inRow) {
        const { w, h, d } = slot.item;
        const index = sized.indexOf(slot.item);
        // Bottom-align on the layer; center in X/Z within the occupied slot.
        const cx = x + w / 2;
        const cy = layerBottom + h / 2;
        const cz = rowZ + d / 2;
        centers[index] = new THREE.Vector3(cx, cy, cz);
        x += w + gap;
      }

      layerWidth = Math.max(layerWidth, Math.max(0, x - gap));
      layerDepth = Math.max(layerDepth, rowZ + rowDepth);
      rowZ += rowDepth + gap;
    }

    pileW = Math.max(pileW, layerWidth);
    pileD = Math.max(pileD, layerDepth);
    pileH = Math.max(pileH, layerBottom + layerHeight);
    layerBottom += layerHeight + gap;
  }

  return {
    units: sized.map((s) => s.unit),
    localTargets: centers.map((c) => c ?? new THREE.Vector3()),
    size: new THREE.Vector3(Math.max(pileW, gap), Math.max(pileH, gap), Math.max(pileD, gap)),
  };
}

function toSizedUnits(units: ClusterPackUnit[]): SizedUnit[] {
  const raw: SizedUnit[] = [];
  for (const unit of units) {
    const size = unit.box.getSize(new THREE.Vector3());
    if (![size.x, size.y, size.z].every((v) => Number.isFinite(v) && v >= 0)) continue;
    const w = Math.max(size.x, 1e-4);
    const h = Math.max(size.y, 1e-4);
    const d = Math.max(size.z, 1e-4);
    raw.push({ unit, w, h, d });
  }
  if (raw.length === 0) return [];

  // Prefer medium elements; drop huge outliers (site-scale leftovers, etc.).
  const volumes = raw.map((s) => s.w * s.h * s.d).sort((a, b) => a - b);
  const medVol = volumes[Math.floor(volumes.length / 2)] || 1;
  const filtered = raw.filter((s) => s.w * s.h * s.d <= medVol * OUTLIER_VOLUME_FACTOR);
  const list = filtered.length > 0 ? filtered : raw;

  // Tall / larger first → cleaner stacks and front rows.
  return list.sort((a, b) => b.h * Math.max(b.w, b.d) - a.h * Math.max(a.w, a.d));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

/** Elevated overview eye/target for a cinematic cluster reveal. */
export function computeClusterCameraPose(box: THREE.Box3): {
  eye: THREE.Vector3;
  target: THREE.Vector3;
  sphere: THREE.Sphere;
} {
  const target = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const span = Math.max(size.x, size.y, size.z, sphere.radius * 2, 1);
  const elev = THREE.MathUtils.degToRad(36);
  const azim = THREE.MathUtils.degToRad(46);
  const dist = span * 1.65;
  const eye = new THREE.Vector3(
    target.x + dist * Math.cos(elev) * Math.sin(azim),
    target.y + dist * Math.sin(elev) + size.y * 0.1,
    target.z + dist * Math.cos(elev) * Math.cos(azim),
  );
  return { eye, target, sphere };
}

function cloneTransform(data: FRAGS.RawGlobalTransformData): FRAGS.RawGlobalTransformData {
  return {
    itemId: data.itemId,
    position: [...data.position],
    xDirection: [...data.xDirection],
    yDirection: [...data.yDirection],
  };
}

/** Snapshot current global transforms for the given item ids (keyed by transform localId). */
export async function backupGlobalTransforms(
  model: FRAGS.FragmentsModel,
  itemLocalIds: number[],
  into: Map<number, FRAGS.RawGlobalTransformData>,
): Promise<number[]> {
  if (itemLocalIds.length === 0) return [];
  const transformIds = await model.getGlobalTranformsIdsOfItems(itemLocalIds);
  const unique = [...new Set(transformIds.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return [];
  const transforms = await model.getGlobalTransforms(unique);
  for (const [id, data] of transforms) {
    if (!into.has(id)) into.set(id, cloneTransform(data));
  }
  return unique;
}

/** Map item localIds → their global transform localIds (aligned arrays from the API). */
export async function mapItemsToTransformIds(
  model: FRAGS.FragmentsModel,
  itemLocalIds: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (itemLocalIds.length === 0) return out;
  const transformIds = await model.getGlobalTranformsIdsOfItems(itemLocalIds);
  for (let i = 0; i < itemLocalIds.length; i++) {
    const itemId = itemLocalIds[i]!;
    const tid = transformIds[i];
    if (tid != null && Number.isFinite(tid)) out.set(itemId, tid);
  }
  return out;
}

/** Apply per-transform translations in one edit batch. */
export async function applyTransformOffsets(
  editor: FRAGS.Editor,
  modelId: string,
  model: FRAGS.FragmentsModel,
  offsetByTransformId: Map<number, THREE.Vector3>,
): Promise<void> {
  if (offsetByTransformId.size === 0) return;
  const ids = [...offsetByTransformId.keys()];
  const transforms = await model.getGlobalTransforms(ids);
  const requests: FRAGS.EditRequest[] = [];
  for (const [localId, data] of transforms) {
    const offset = offsetByTransformId.get(localId);
    if (!offset || offset.lengthSq() < 1e-12) continue;
    const next = cloneTransform(data);
    next.position[0] = (next.position[0] ?? 0) + offset.x;
    next.position[1] = (next.position[1] ?? 0) + offset.y;
    next.position[2] = (next.position[2] ?? 0) + offset.z;
    requests.push({
      type: FRAGS.EditRequestType.UPDATE_GLOBAL_TRANSFORM,
      localId,
      data: next,
    });
  }
  if (requests.length === 0) return;
  await editor.edit(modelId, requests);
}

/** Restore previously snapshotted global transforms. */
export async function restoreGlobalTransforms(
  editor: FRAGS.Editor,
  modelId: string,
  backup: Map<number, FRAGS.RawGlobalTransformData>,
): Promise<void> {
  if (backup.size === 0) return;
  const requests: FRAGS.EditRequest[] = [];
  for (const [localId, data] of backup) {
    requests.push({
      type: FRAGS.EditRequestType.UPDATE_GLOBAL_TRANSFORM,
      localId,
      data: cloneTransform(data),
    });
  }
  await editor.edit(modelId, requests);
}
