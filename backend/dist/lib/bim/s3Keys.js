/** S3 keys for BIM artifacts under a file version. */
export function bimFragmentsKey(workspaceId, projectId, fileId, fileVersionId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/fragments.frag`;
}
export function bimQuantityIndexKey(workspaceId, projectId, fileId, fileVersionId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/quantity-index.json`;
}
/** Content-addressable metadata JSON (dedup across versions). */
export function bimMetadataKey(workspaceId, contentHash) {
    return `ws/${workspaceId}/bim/metadata/${contentHash}.json`;
}
/** Content-addressable geometry tile (dedup across versions). */
export function bimGeometryTileKey(workspaceId, contentHash) {
    return `ws/${workspaceId}/bim/geometry/${contentHash}.frag`;
}
export function bimGeometryManifestKey(workspaceId, projectId, fileId, fileVersionId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/geometry-manifest.json`;
}
export function buildingAssetThumbnailKey(workspaceId, projectId, fileId, fileVersionId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/thumb.png`;
}
export function levelPlanThumbnailKey(workspaceId, projectId, buildingId, levelId) {
    return `ws/${workspaceId}/p/${projectId}/buildings/${buildingId}/levels/${levelId}/plan.png`;
}
