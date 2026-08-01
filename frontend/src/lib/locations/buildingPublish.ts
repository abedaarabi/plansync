import type { BuildingPublishStatus, BuildingChecklist } from "@/lib/api-client/locations";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  warn?: boolean;
  detail?: string;
};

export function buildingStatusLabel(status: BuildingPublishStatus): string {
  if (status === "ready") return "Ready";
  if (status === "needs_update") return "Needs update";
  return "Setup";
}

export function buildPublishChecklist(checklist: BuildingChecklist): ChecklistItem[] {
  return [
    {
      id: "ifc",
      label: "IFC model ready",
      done: checklist.ifcReady,
      detail: checklist.ifcReady ? undefined : "Upload and wait for processing",
    },
    {
      id: "levels",
      label: "Levels available",
      done: checklist.levelCount > 0,
      detail:
        checklist.levelCount > 0
          ? `${checklist.levelCount} level${checklist.levelCount === 1 ? "" : "s"}`
          : "Extract or add levels",
    },
    {
      id: "mapped",
      label: "Drawings matched to levels",
      done: checklist.mappedLevelCount > 0 && checklist.unmappedPdfCount === 0,
      warn: checklist.mappedLevelCount > 0 && checklist.unmappedPdfCount > 0,
      detail:
        checklist.pdfCount === 0
          ? "No PDFs uploaded yet (optional)"
          : checklist.unmappedPdfCount > 0
            ? `${checklist.unmappedPdfCount} unmapped · ${checklist.mappedLevelCount}/${checklist.levelCount} levels have drawings`
            : `${checklist.mappedLevelCount}/${checklist.levelCount} levels have drawings`,
    },
    {
      id: "empty-levels",
      label: "Every level has a drawing",
      done: checklist.levelCount > 0 && checklist.levelsWithoutDrawing === 0,
      warn: checklist.levelsWithoutDrawing > 0,
      detail:
        checklist.levelsWithoutDrawing > 0
          ? `${checklist.levelsWithoutDrawing} level${checklist.levelsWithoutDrawing === 1 ? "" : "s"} without a drawing`
          : undefined,
    },
  ];
}

/** Soft gate: can publish when IFC + levels exist. Unmapped PDFs warn only. */
export function canPublishBuilding(checklist: BuildingChecklist): boolean {
  return checklist.ifcReady && checklist.levelCount > 0;
}

export type LevelHealth = "none" | "ok" | "weak";

export function levelHealthLabel(health: LevelHealth | undefined, mappedCount: number): string {
  if (mappedCount <= 0 || health === "none") return "No drawing";
  if (health === "weak") return "Weak alignment";
  return mappedCount === 1 ? "1 drawing" : `${mappedCount} drawings`;
}

const LAST_VIEW_KEY = (buildingId: string) => `plansync-building-last-view:${buildingId}`;

export type BuildingLastView = {
  levelId?: string | null;
  view: "3d" | "plan";
};

export function readBuildingLastView(buildingId: string): BuildingLastView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_VIEW_KEY(buildingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuildingLastView;
    if (parsed.view !== "3d" && parsed.view !== "plan") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBuildingLastView(buildingId: string, view: BuildingLastView): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_VIEW_KEY(buildingId), JSON.stringify(view));
  } catch {
    /* ignore */
  }
}
