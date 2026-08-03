/** Persist which READY IFCs the user last selected for federated open. */

const KEY = (buildingId: string) => `plansync-building-fed-ifc:${buildingId}`;

export function readBuildingFederationSelection(buildingId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(buildingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function writeBuildingFederationSelection(buildingId: string, fileIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(buildingId), JSON.stringify(fileIds));
  } catch {
    /* ignore */
  }
}
