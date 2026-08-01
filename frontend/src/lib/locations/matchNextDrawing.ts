import type { BuildingAsset } from "@/lib/api-client/locations";

/** First unmapped PDF after a successful registration (excluding the one just saved). */
export function remainingUnmappedDrawings(
  unmapped: BuildingAsset[],
  savedAssetId?: string,
): BuildingAsset[] {
  if (!savedAssetId) return unmapped;
  return unmapped.filter((a) => a.id !== savedAssetId);
}
