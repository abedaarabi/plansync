import { apiUrl } from "@/lib/api-url";
import { apiJsonFetch } from "@/lib/api-client/shared";
import { BimLoadAbortedError, fetchBinaryWithRetry } from "@/lib/bim/loadFetch";

/** Remaining tiles after the first (ready) tile — keep network busy without flooding. */
const REMAINING_TILE_CONCURRENCY = 3;

type GeometryManifestTile = {
  id: string;
  bounds: [number, number, number, number, number, number];
  contentHash: string;
  byteLength: number;
  guidCount: number;
};

type GeometryManifest = {
  schemaVersion: 1;
  fileVersionId: string;
  monolithic: boolean;
  bounds: [number, number, number, number, number, number];
  tiles: GeometryManifestTile[];
};

async function fetchGeometryManifest(
  fileVersionId: string,
  signal?: AbortSignal,
): Promise<GeometryManifest | null> {
  try {
    return await apiJsonFetch<GeometryManifest>(
      `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/geometry-manifest`,
      { signal: signal ?? AbortSignal.timeout(30_000) },
    );
  } catch {
    return null;
  }
}

async function fetchTileBuffer(
  fileVersionId: string,
  contentHash: string,
  opts?: {
    signal?: AbortSignal;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
  },
): Promise<ArrayBuffer | null> {
  const { res, bytes } = await fetchBinaryWithRetry(
    apiUrl(
      `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/geometry-tiles/${encodeURIComponent(contentHash)}`,
    ),
    {
      signal: opts?.signal,
      onDownloading: opts?.onDownloading,
    },
  );
  if (res.status === 404 || bytes.byteLength === 0) return null;
  return toArrayBuffer(bytes);
}

async function fetchMonolithicFragments(
  fileVersionId: string,
  opts?: {
    signal?: AbortSignal;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
  },
): Promise<ArrayBuffer | null> {
  const { res, bytes } = await fetchBinaryWithRetry(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/fragments`),
    {
      signal: opts?.signal,
      onDownloading: opts?.onDownloading,
    },
  );
  if (res.status === 404 || bytes.byteLength === 0) return null;
  return toArrayBuffer(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function sortTiles(tiles: GeometryManifestTile[]): GeometryManifestTile[] {
  return [...tiles].sort((a, b) => {
    const az = a.bounds[2] ?? 0;
    const bz = b.bounds[2] ?? 0;
    if (az !== bz) return az - bz;
    return b.guidCount - a.guidCount || b.byteLength - a.byteLength;
  });
}

type ProgressiveTile = {
  tileId: string;
  buffer: ArrayBuffer;
  index: number;
  total: number;
};

type ProgressState = {
  completedBytes: number;
  totalBytes: number | null;
  tileCount: number;
  completedTiles: number;
  inflightBytes: Map<number, number>;
  onDownloading?: (fraction: number, bytesTotal: number | null) => void;
};

function reportProgress(state: ProgressState): void {
  let inflight = 0;
  for (const n of state.inflightBytes.values()) inflight += n;
  if (state.totalBytes != null && state.totalBytes > 0) {
    const done = state.completedTiles >= state.tileCount;
    state.onDownloading?.(
      done ? 1 : Math.min(0.99, (state.completedBytes + inflight) / state.totalBytes),
      state.totalBytes,
    );
    return;
  }
  state.onDownloading?.(
    state.tileCount > 0 ? state.completedTiles / state.tileCount : 0,
    state.totalBytes,
  );
}

async function fetchIndexedTile(
  fileVersionId: string,
  tiles: GeometryManifestTile[],
  index: number,
  total: number,
  state: ProgressState,
  signal?: AbortSignal,
): Promise<ProgressiveTile | null> {
  const tile = tiles[index]!;
  if (signal?.aborted) throw new BimLoadAbortedError();
  const buffer = await fetchTileBuffer(fileVersionId, tile.contentHash, {
    signal,
    onDownloading: (fraction, bytesTotal) => {
      const tileBytes = bytesTotal ?? tile.byteLength;
      state.inflightBytes.set(index, fraction * tileBytes);
      reportProgress(state);
    },
  });
  state.inflightBytes.delete(index);
  state.completedTiles += 1;
  if (!buffer?.byteLength) {
    reportProgress(state);
    return null;
  }
  state.completedBytes += buffer.byteLength;
  reportProgress(state);
  return { tileId: tile.id, buffer, index, total };
}

/**
 * First tile sequential (viewer ready ASAP); remaining tiles fetch with a small
 * concurrency window and yield in original index order.
 */
// fallow-ignore-next-line complexity
async function* loadMultiTilesParallel(
  fileVersionId: string,
  tiles: GeometryManifestTile[],
  opts?: {
    signal?: AbortSignal;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
  },
): AsyncGenerator<ProgressiveTile> {
  const total = tiles.length;
  const totalBytes = tiles.reduce((s, t) => s + (t.byteLength || 0), 0) || null;
  const state: ProgressState = {
    completedBytes: 0,
    totalBytes,
    tileCount: total,
    completedTiles: 0,
    inflightBytes: new Map(),
    onDownloading: opts?.onDownloading,
  };

  const first = await fetchIndexedTile(fileVersionId, tiles, 0, total, state, opts?.signal);
  if (first) yield first;
  if (total <= 1) return;

  const futures = new Map<number, Promise<ProgressiveTile | null>>();
  let nextLaunch = 1;

  const ensureWindow = (aheadOf: number) => {
    const limit = Math.min(total, aheadOf + REMAINING_TILE_CONCURRENCY);
    while (nextLaunch < limit) {
      const index = nextLaunch++;
      futures.set(index, fetchIndexedTile(fileVersionId, tiles, index, total, state, opts?.signal));
    }
  };

  for (let nextYield = 1; nextYield < total; nextYield++) {
    if (opts?.signal?.aborted) throw new BimLoadAbortedError();
    ensureWindow(nextYield);
    const future = futures.get(nextYield);
    if (!future) {
      futures.set(
        nextYield,
        fetchIndexedTile(fileVersionId, tiles, nextYield, total, state, opts?.signal),
      );
    }
    const tile = await futures.get(nextYield)!;
    futures.delete(nextYield);
    if (tile) yield tile;
  }
}

/**
 * Yields fragment buffers in load order. Multi-tile manifests stream storey tiles;
 * monolithic falls back to the full `.frag`.
 */
// fallow-ignore-next-line complexity
export async function* loadFragmentsProgressive(
  fileVersionId: string,
  opts?: {
    fragmentsReady?: boolean;
    signal?: AbortSignal;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
  },
): AsyncGenerator<ProgressiveTile> {
  if (opts?.fragmentsReady === false) return;
  if (opts?.signal?.aborted) throw new BimLoadAbortedError();

  const manifest = await fetchGeometryManifest(fileVersionId, opts?.signal);
  if (opts?.signal?.aborted) throw new BimLoadAbortedError();
  const tiles = manifest?.tiles?.length ? sortTiles(manifest.tiles) : null;
  const multi = Boolean(manifest && !manifest.monolithic && tiles && tiles.length > 1);

  if (multi && tiles) {
    yield* loadMultiTilesParallel(fileVersionId, tiles, opts);
    return;
  }

  const buffer = await fetchMonolithicFragments(fileVersionId, {
    signal: opts?.signal,
    onDownloading: opts?.onDownloading,
  });
  if (!buffer?.byteLength) return;
  yield { tileId: tiles?.[0]?.id ?? "0_0_0", buffer, index: 0, total: 1 };
}
