import type { LocationBuildingRow } from "@/lib/api-client/locations";
import { buildingTypeLabel } from "@/lib/locations/buildingLabels";

export type BuildingCardStatTone = "warn" | "ok" | "muted";

export type BuildingCardStat = {
  value: string;
  tone: BuildingCardStatTone;
};

export function buildingMetaLine(b: LocationBuildingRow): string {
  const typeLabel = buildingTypeLabel(b.buildingType);
  return (
    [typeLabel, b.floorsApprox != null ? `~${b.floorsApprox} floors` : null]
      .filter(Boolean)
      .join(" · ") || "No type yet"
  );
}

export function mappingStat(levelCount: number, mappedLevelCount: number): BuildingCardStat {
  if (levelCount === 0) return { value: "No levels", tone: "muted" };
  const value = `${mappedLevelCount}/${levelCount} mapped`;
  if (mappedLevelCount === 0) return { value, tone: "warn" };
  if (mappedLevelCount >= levelCount) return { value, tone: "ok" };
  return { value, tone: "warn" };
}

export function drawingsStat(pdfCount: number, unmappedPdfCount: number): BuildingCardStat {
  if (pdfCount === 0) return { value: "None", tone: "muted" };
  if (unmappedPdfCount > 0) return { value: `${unmappedPdfCount} unmapped`, tone: "warn" };
  return { value: `${pdfCount} matched`, tone: "ok" };
}

export function modelsStat(ifcCount: number, readyIfcCount: number): BuildingCardStat {
  if (ifcCount === 0) return { value: "None", tone: "muted" };
  if (readyIfcCount === ifcCount) return { value: `${ifcCount} ready`, tone: "ok" };
  return {
    value: `${readyIfcCount}/${ifcCount} ready`,
    tone: readyIfcCount === 0 ? "warn" : "ok",
  };
}

export function clashesStat(
  openClashCount: number,
  publishStatus: LocationBuildingRow["publishStatus"],
): BuildingCardStat {
  if (openClashCount > 0) return { value: `${openClashCount} open`, tone: "warn" };
  if (publishStatus === "ready" || publishStatus === "needs_update") {
    return { value: "Clear", tone: "ok" };
  }
  return { value: "—", tone: "muted" };
}
