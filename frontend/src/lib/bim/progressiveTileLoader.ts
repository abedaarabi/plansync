import { apiUrl } from "@/lib/api-url";
import { apiJsonFetch } from "@/lib/api-client/shared";
import { fetchBinaryWithRetry } from "@/lib/bim/loadFetch";

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

async function fetchGeometryManifest(fileVersionId: string): Promise<GeometryManifest | null> {
  try {
    return await apiJsonFetch<GeometryManifest>(
      `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/geometry-manifest`,
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

  const manifest = await fetchGeometryManifest(fileVersionId);
  const tiles = manifest?.tiles?.length ? sortTiles(manifest.tiles) : null;
  const multi = Boolean(manifest && !manifest.monolithic && tiles && tiles.length > 1);

  if (multi && tiles) {
    const total = tiles.length;
    let loadedBytes = 0;
    const totalBytes = tiles.reduce((s, t) => s + (t.byteLength || 0), 0) || null;

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]!;
      if (opts?.signal?.aborted) return;
      const buffer = await fetchTileBuffer(fileVersionId, tile.contentHash, {
        signal: opts?.signal,
        onDownloading: (fraction, bytesTotal) => {
          const tileBytes = bytesTotal ?? tile.byteLength;
          const overall =
            totalBytes != null && totalBytes > 0
              ? Math.min(0.99, (loadedBytes + fraction * tileBytes) / totalBytes)
              : (i + fraction) / total;
          opts?.onDownloading?.(overall, totalBytes);
        },
      });
      if (!buffer?.byteLength) continue;
      loadedBytes += buffer.byteLength;
      opts?.onDownloading?.(
        totalBytes != null && totalBytes > 0
          ? Math.min(1, loadedBytes / totalBytes)
          : (i + 1) / total,
        totalBytes,
      );
      yield { tileId: tile.id, buffer, index: i, total };
    }
    return;
  }

  const buffer = await fetchMonolithicFragments(fileVersionId, {
    signal: opts?.signal,
    onDownloading: opts?.onDownloading,
  });
  if (!buffer?.byteLength) return;
  yield { tileId: tiles?.[0]?.id ?? "0_0_0", buffer, index: 0, total: 1 };
}
