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
