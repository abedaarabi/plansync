import type * as OBC from "@thatopen/components";

/** True when `map[modelId]` is a Set that contains `localId`. */
export function modelIdMapHas(
  map: OBC.ModelIdMap | null | undefined,
  modelId: string,
  localId: number,
): boolean {
  const ids = map?.[modelId];
  return ids instanceof Set && ids.has(localId);
}
