/** S3 keys for BIM artifacts under a file version. */
export function bimFragmentsKey(
  workspaceId: string,
  projectId: string,
  fileId: string,
  fileVersionId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/fragments.frag`;
}

export function bimQuantityIndexKey(
  workspaceId: string,
  projectId: string,
  fileId: string,
  fileVersionId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/quantity-index.json`;
}

/** Content-addressable metadata JSON (dedup across versions). */
export function bimMetadataKey(workspaceId: string, contentHash: string): string {
  return `ws/${workspaceId}/bim/metadata/${contentHash}.json`;
}

/** Content-addressable geometry tile (dedup across versions). */
export function bimGeometryTileKey(workspaceId: string, contentHash: string): string {
  return `ws/${workspaceId}/bim/geometry/${contentHash}.frag`;
}

export function bimGeometryManifestKey(
  workspaceId: string,
  projectId: string,
  fileId: string,
  fileVersionId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/geometry-manifest.json`;
}

export function buildingAssetThumbnailKey(
  workspaceId: string,
  projectId: string,
  fileId: string,
  fileVersionId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/thumb.png`;
}

export function levelPlanThumbnailKey(
  workspaceId: string,
  projectId: string,
  buildingId: string,
  levelId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/buildings/${buildingId}/levels/${levelId}/plan.png`;
}
