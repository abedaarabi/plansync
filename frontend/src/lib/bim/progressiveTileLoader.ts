import { apiUrl } from "@/lib/api-url";
import { apiJsonFetch } from "@/lib/api-client/shared";

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

/** Load fragments: uses manifest when present (Phase 2), else monolithic .frag. */
export async function fetchFragmentsForVersion(
  fileVersionId: string,
  opts?: { fragmentsReady?: boolean },
): Promise<ArrayBuffer | null> {
  if (opts?.fragmentsReady === false) return null;

  const manifest = await fetchGeometryManifest(fileVersionId);
  if (manifest?.monolithic && manifest.tiles.length === 1) {
    const res = await fetch(
      apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/fragments`),
      { credentials: "include" },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Could not load fragments (${res.status})`);
    return res.arrayBuffer();
  }
  if (manifest && manifest.tiles.length > 0) {
    const res = await fetch(
      apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/fragments`),
      { credentials: "include" },
    );
    if (res.ok) return res.arrayBuffer();
  }
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/fragments`),
    { credentials: "include" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not load fragments (${res.status})`);
  return res.arrayBuffer();
}
