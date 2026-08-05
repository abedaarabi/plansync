import type * as OBC from "@thatopen/components";

/**
 * Drop model/local ids that are no longer in the loaded fragment list.
 * Returns null when nothing remains.
 */
// fallow-ignore-next-line complexity
export function sanitizeHighlightMap(
  map: OBC.ModelIdMap | null | undefined,
  loadedModelIds: ReadonlySet<string> | null | undefined,
): OBC.ModelIdMap | null {
  if (!map || !loadedModelIds || loadedModelIds.size === 0) return null;
  try {
    const out: OBC.ModelIdMap = {};
    for (const [modelId, ids] of Object.entries(map)) {
      if (!loadedModelIds.has(modelId)) continue;
      if (!(ids instanceof Set) || ids.size === 0) continue;
      out[modelId] = new Set(ids);
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
