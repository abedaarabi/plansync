/** Stable key for a fragment item within a federated model set. */
export function modelLocalKey(modelId: string, localId: number): string {
  return `${modelId}:${localId}`;
}
