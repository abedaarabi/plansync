import type { OmAssetRow } from "@/lib/api-client/operations-maintenance-assets";

/** Find an O&M asset linked to an IFC element GUID. */
export function findOmAssetByGuid(
  assets: OmAssetRow[] | undefined,
  guid: string | null | undefined,
): OmAssetRow | null {
  const g = guid?.trim();
  if (!g || !assets?.length) return null;
  return assets.find((a) => a.bimAnchor?.ifcGuid?.trim() === g) ?? null;
}
