import * as THREE from "three";
import { MeshBVH, type HitPointInfo } from "three-mesh-bvh";
import type { BimClashHit, BimClashType } from "@plansync/shared/bimClashTypes";

export type ClashElementBox = {
  guid: string;
  fileVersionId: string;
  ifcType: string | null;
  name: string | null;
  /** World-space AABB: minX,minY,minZ,maxX,maxY,maxZ */
  box: Float32Array;
};

export type ClashMeshPayload = {
  guid: string;
  fileVersionId: string;
  ifcType: string | null;
  name: string | null;
  /** World-space positions (already origin-offset applied). */
  positions: Float32Array;
  indices: Uint32Array | null;
};

export type ClashCoreOptions = {
  clearanceEnabled: boolean;
  clearanceMm: number;
  /** Max pairs to narrow-phase; remainder truncated. */
  pairCap?: number;
  onProgress?: (done: number, total: number, hits: BimClashHit[]) => void;
  /** Abort when `aborted` is true (AbortSignal or plain `{ aborted }`). */
  signal?: { aborted: boolean };
};

export type ClashCoreResult = {
  hits: BimClashHit[];
  scannedPairs: number;
  truncated: boolean;
  originOffset: { x: number; y: number; z: number };
};

const DUPLICATE_CENTROID_EPS_M = 0.05;
const DUPLICATE_VOLUME_RATIO = 0.15;

function boxCenter(box: Float32Array): { x: number; y: number; z: number } {
  return {
    x: (box[0]! + box[3]!) * 0.5,
    y: (box[1]! + box[4]!) * 0.5,
    z: (box[2]! + box[5]!) * 0.5,
  };
}

function boxVolume(box: Float32Array): number {
  const dx = Math.max(0, box[3]! - box[0]!);
  const dy = Math.max(0, box[4]! - box[1]!);
  const dz = Math.max(0, box[5]! - box[2]!);
  return dx * dy * dz;
}

function inflateBox(box: Float32Array, padM: number): Float32Array {
  return new Float32Array([
    box[0]! - padM,
    box[1]! - padM,
    box[2]! - padM,
    box[3]! + padM,
    box[4]! + padM,
    box[5]! + padM,
  ]);
}

function boxesOverlap(a: Float32Array, b: Float32Array): boolean {
  return (
    a[0]! <= b[3]! &&
    a[3]! >= b[0]! &&
    a[1]! <= b[4]! &&
    a[4]! >= b[1]! &&
    a[2]! <= b[5]! &&
    a[5]! >= b[2]!
  );
}

function overlapDepthMm(a: Float32Array, b: Float32Array): number {
  const ox = Math.min(a[3]!, b[3]!) - Math.max(a[0]!, b[0]!);
  const oy = Math.min(a[4]!, b[4]!) - Math.max(a[1]!, b[1]!);
  const oz = Math.min(a[5]!, b[5]!) - Math.max(a[2]!, b[2]!);
  if (ox <= 0 || oy <= 0 || oz <= 0) return 0;
  return -Math.min(ox, oy, oz) * 1000;
}

function isDuplicateCandidate(a: ClashElementBox, b: ClashElementBox): boolean {
  if (!a.ifcType || !b.ifcType || a.ifcType !== b.ifcType) return false;
  const ca = boxCenter(a.box);
  const cb = boxCenter(b.box);
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  const dz = ca.z - cb.z;
  if (dx * dx + dy * dy + dz * dz > DUPLICATE_CENTROID_EPS_M * DUPLICATE_CENTROID_EPS_M) {
    return false;
  }
  const va = boxVolume(a.box);
  const vb = boxVolume(b.box);
  if (va <= 0 || vb <= 0) return false;
  const ratio = Math.abs(va - vb) / Math.max(va, vb);
  return ratio <= DUPLICATE_VOLUME_RATIO;
}

/** Shared origin = center of the intersecting AABB of both set extents. */
export function computeOriginOffset(
  setA: ClashElementBox[],
  setB: ClashElementBox[],
): { x: number; y: number; z: number } {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const el of [...setA, ...setB]) {
    minX = Math.min(minX, el.box[0]!);
    minY = Math.min(minY, el.box[1]!);
    minZ = Math.min(minZ, el.box[2]!);
    maxX = Math.max(maxX, el.box[3]!);
    maxY = Math.max(maxY, el.box[4]!);
    maxZ = Math.max(maxZ, el.box[5]!);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, z: 0 };
  return {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5,
    z: (minZ + maxZ) * 0.5,
  };
}

export type BroadPhasePair = {
  a: ClashElementBox;
  b: ClashElementBox;
  duplicate: boolean;
};

// fallow-ignore-next-line complexity
export function broadPhasePairs(
  setA: ClashElementBox[],
  setB: ClashElementBox[],
  clearanceMm: number,
  clearanceEnabled: boolean,
): BroadPhasePair[] {
  const padM = clearanceEnabled ? clearanceMm / 1000 : 0;
  const pairs: BroadPhasePair[] = [];
  for (const a of setA) {
    const aBox = padM > 0 ? inflateBox(a.box, padM) : a.box;
    for (const b of setB) {
      if (a.guid === b.guid && a.fileVersionId === b.fileVersionId) continue;
      const bBox = padM > 0 ? inflateBox(b.box, padM) : b.box;
      if (!boxesOverlap(aBox, bBox)) continue;
      pairs.push({ a, b, duplicate: isDuplicateCandidate(a, b) });
    }
  }
  return pairs;
}

function meshToGeometry(mesh: ClashMeshPayload): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  if (mesh.indices && mesh.indices.length > 0) {
    geom.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  }
  geom.computeBoundingBox();
  return geom;
}

function contactPenetrationMm(
  bvhA: MeshBVH,
  geomB: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
): { depthMm: number; point: { x: number; y: number; z: number }; contactCount: number } {
  const boxA =
    bvhA.geometry.boundingBox ??
    new THREE.Box3().setFromBufferAttribute(
      bvhA.geometry.getAttribute("position") as THREE.BufferAttribute,
    );
  const boxB =
    geomB.boundingBox ??
    new THREE.Box3().setFromBufferAttribute(
      geomB.getAttribute("position") as THREE.BufferAttribute,
    );
  const transformedB = boxB.clone().applyMatrix4(matrix);
  const overlap = boxA.clone().intersect(transformedB);
  const size = new THREE.Vector3();
  overlap.getSize(size);
  const center = new THREE.Vector3();
  overlap.getCenter(center);
  const depthMm =
    size.x > 0 && size.y > 0 && size.z > 0 ? -Math.min(size.x, size.y, size.z) * 1000 : 0;
  return {
    depthMm,
    point: { x: center.x, y: center.y, z: center.z },
    contactCount: 1,
  };
}

// fallow-ignore-next-line complexity
function classifyPair(
  meshA: ClashMeshPayload,
  meshB: ClashMeshPayload,
  opts: ClashCoreOptions,
  originOffset: { x: number; y: number; z: number },
  isDuplicate: boolean,
): BimClashHit | null {
  if (isDuplicate) {
    const ca = {
      x: 0,
      y: 0,
      z: 0,
    };
    // Approximate midpoint from mesh A AABB.
    const geomA = meshToGeometry(meshA);
    geomA.computeBoundingBox();
    const c = new THREE.Vector3();
    geomA.boundingBox!.getCenter(c);
    ca.x = c.x + originOffset.x;
    ca.y = c.y + originOffset.y;
    ca.z = c.z + originOffset.z;
    geomA.dispose();
    return {
      guidA: meshA.guid,
      guidB: meshB.guid,
      fileVersionIdA: meshA.fileVersionId,
      fileVersionIdB: meshB.fileVersionId,
      clashType: "DUPLICATE",
      distanceMm: 0,
      point: ca,
      contactCount: 1,
      nameA: meshA.name,
      nameB: meshB.name,
      ifcTypeA: meshA.ifcType,
      ifcTypeB: meshB.ifcType,
    };
  }

  const geomA = meshToGeometry(meshA);
  const geomB = meshToGeometry(meshB);
  try {
    const bvhA = new MeshBVH(geomA);
    const identity = new THREE.Matrix4();
    const clearanceM = opts.clearanceEnabled ? opts.clearanceMm / 1000 : 0;
    const target1: HitPointInfo = {
      point: new THREE.Vector3(),
      distance: 0,
      faceIndex: 0,
    };
    const target2: HitPointInfo = {
      point: new THREE.Vector3(),
      distance: 0,
      faceIndex: 0,
    };
    const closest = bvhA.closestPointToGeometry(
      geomB,
      identity,
      target1,
      target2,
      0,
      Math.max(clearanceM, 1e-6),
    );

    if (!closest) return null;

    const distance = closest.distance;
    let clashType: BimClashType;
    let distanceMm: number;
    let point: { x: number; y: number; z: number };
    let contactCount = 1;

    if (distance <= 1e-6 || bvhA.intersectsGeometry(geomB, identity)) {
      clashType = "HARD";
      const contact = contactPenetrationMm(bvhA, geomB, identity);
      distanceMm = contact.depthMm;
      point = {
        x: contact.point.x + originOffset.x,
        y: contact.point.y + originOffset.y,
        z: contact.point.z + originOffset.z,
      };
      contactCount = contact.contactCount;
    } else if (opts.clearanceEnabled && distance <= clearanceM) {
      clashType = "CLEARANCE";
      distanceMm = distance * 1000;
      point = {
        x: (target1.point.x + target2.point.x) * 0.5 + originOffset.x,
        y: (target1.point.y + target2.point.y) * 0.5 + originOffset.y,
        z: (target1.point.z + target2.point.z) * 0.5 + originOffset.z,
      };
    } else {
      return null;
    }

    return {
      guidA: meshA.guid,
      guidB: meshB.guid,
      fileVersionIdA: meshA.fileVersionId,
      fileVersionIdB: meshB.fileVersionId,
      clashType,
      distanceMm,
      point,
      contactCount,
      nameA: meshA.name,
      nameB: meshB.name,
      ifcTypeA: meshA.ifcType,
      ifcTypeB: meshB.ifcType,
    };
  } finally {
    geomA.dispose();
    geomB.dispose();
  }
}

/**
 * Narrow-phase clash test for pre-filtered pairs.
 * Meshes must already be in the shared origin-offset frame.
 */
export function runNarrowPhase(
  pairs: BroadPhasePair[],
  meshes: Map<string, ClashMeshPayload>,
  opts: ClashCoreOptions,
  originOffset: { x: number; y: number; z: number },
): ClashCoreResult {
  const pairCap = opts.pairCap ?? 50_000;
  const truncated = pairs.length > pairCap;
  const work = truncated ? pairs.slice(0, pairCap) : pairs;
  const hits: BimClashHit[] = [];
  let done = 0;

  for (const pair of work) {
    if (opts.signal?.aborted) break;
    const keyA = `${pair.a.fileVersionId}:${pair.a.guid}`;
    const keyB = `${pair.b.fileVersionId}:${pair.b.guid}`;
    const meshA = meshes.get(keyA);
    const meshB = meshes.get(keyB);
    done += 1;
    if (!meshA || !meshB) {
      opts.onProgress?.(done, work.length, hits);
      continue;
    }
    const hit = classifyPair(meshA, meshB, opts, originOffset, pair.duplicate);
    if (hit) hits.push(hit);
    if (done % 8 === 0 || done === work.length) {
      opts.onProgress?.(done, work.length, hits);
    }
  }

  return {
    hits,
    scannedPairs: work.length,
    truncated,
    originOffset,
  };
}

/** Apply shared origin offset to world positions (Float64 → Float32). */
export function offsetPositions(
  worldPositions: ArrayLike<number>,
  origin: { x: number; y: number; z: number },
): Float32Array {
  const out = new Float32Array(worldPositions.length);
  for (let i = 0; i < worldPositions.length; i += 3) {
    out[i] = worldPositions[i]! - origin.x;
    out[i + 1] = worldPositions[i + 1]! - origin.y;
    out[i + 2] = worldPositions[i + 2]! - origin.z;
  }
  return out;
}

/** Build a unit-box mesh centered at `center` with half-extents `half` — for tests. */
export function makeBoxMesh(
  guid: string,
  fileVersionId: string,
  center: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  ifcType: string | null = "IfcBuildingElementProxy",
  name: string | null = null,
): { box: ClashElementBox; mesh: ClashMeshPayload } {
  const box = new Float32Array([
    center.x - half.x,
    center.y - half.y,
    center.z - half.z,
    center.x + half.x,
    center.y + half.y,
    center.z + half.z,
  ]);
  const geom = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
  geom.translate(center.x, center.y, center.z);
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const positions = new Float32Array(pos.array.length);
  positions.set(pos.array as ArrayLike<number>);
  const idx = geom.getIndex();
  const indices = idx ? new Uint32Array(idx.array.length) : null;
  if (idx && indices) indices.set(idx.array as ArrayLike<number>);
  geom.dispose();
  return {
    box: { guid, fileVersionId, ifcType, name, box },
    mesh: { guid, fileVersionId, ifcType, name, positions, indices },
  };
}

/** Convenience: broad + narrow for two box sets (tests / simple runs). */
export function runClashOnBoxes(
  setA: { box: ClashElementBox; mesh: ClashMeshPayload }[],
  setB: { box: ClashElementBox; mesh: ClashMeshPayload }[],
  opts: ClashCoreOptions,
): ClashCoreResult {
  const boxesA = setA.map((s) => s.box);
  const boxesB = setB.map((s) => s.box);
  const origin = computeOriginOffset(boxesA, boxesB);
  const pairs = broadPhasePairs(boxesA, boxesB, opts.clearanceMm, opts.clearanceEnabled);
  const meshes = new Map<string, ClashMeshPayload>();
  for (const s of [...setA, ...setB]) {
    const key = `${s.mesh.fileVersionId}:${s.mesh.guid}`;
    meshes.set(key, {
      ...s.mesh,
      positions: offsetPositions(s.mesh.positions, origin),
    });
  }
  return runNarrowPhase(pairs, meshes, opts, origin);
}
