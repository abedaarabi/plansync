import * as THREE from "three";

type MeshLike = {
  positions?: ArrayLike<number>;
  indices?: ArrayLike<number>;
  transform: THREE.Matrix4;
};

function transformPositions(src: ArrayLike<number>, matrix: THREE.Matrix4): Float32Array {
  const world = new Float32Array(src.length);
  const v = new THREE.Vector3();
  for (let k = 0; k < src.length; k += 3) {
    v.set(src[k]!, src[k + 1]!, src[k + 2]!).applyMatrix4(matrix);
    world[k] = v.x;
    world[k + 1] = v.y;
    world[k + 2] = v.z;
  }
  return world;
}

function appendIndices(
  idxChunks: number[],
  mesh: MeshLike,
  vertexBase: number,
  vertexCount: number,
): void {
  if (mesh.indices && mesh.indices.length > 0) {
    for (let k = 0; k < mesh.indices.length; k++) {
      idxChunks.push(mesh.indices[k]! + vertexBase);
    }
    return;
  }
  for (let k = 0; k < vertexCount; k++) idxChunks.push(vertexBase + k);
}

/** Merge fragment mesh pieces for one item into a single world-space buffer. */
export function mergeItemMeshesWorld(
  meshes: MeshLike[],
  modelMatrix: THREE.Matrix4,
): { positions: Float32Array; indices: Uint32Array | null } | null {
  const posChunks: Float32Array[] = [];
  const idxChunks: number[] = [];
  let vertexBase = 0;

  for (const mesh of meshes) {
    if (!mesh.positions || mesh.positions.length < 9) continue;
    const matrix = new THREE.Matrix4().multiplyMatrices(modelMatrix, mesh.transform);
    const world = transformPositions(mesh.positions, matrix);
    posChunks.push(world);
    const vertexCount = mesh.positions.length / 3;
    appendIndices(idxChunks, mesh, vertexBase, vertexCount);
    vertexBase += vertexCount;
  }

  if (posChunks.length === 0) return null;
  const totalLen = posChunks.reduce((n, p) => n + p.length, 0);
  const positions = new Float32Array(totalLen);
  let write = 0;
  for (const p of posChunks) {
    positions.set(p, write);
    write += p.length;
  }
  return {
    positions,
    indices: idxChunks.length > 0 ? new Uint32Array(idxChunks) : null,
  };
}
