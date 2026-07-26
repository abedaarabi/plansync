/** S3 keys for BIM artifacts under a file version. */
export function bimFragmentsKey(workspaceId, projectId, fileId, fileVersionId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/fragments.frag`;
}
export function bimQuantityIndexKey(workspaceId, projectId, fileId, fileVersionId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${fileVersionId}/quantity-index.json`;
}
