import type { BuildingAsset } from "@/lib/api-client/locations";

/** `work` = full BIM tools; `edit` = mapping setup (levels tree + cut/PDF, stripped chrome). */
export type BuildingWorkspaceMode = "work" | "edit";

export type WorkspaceHrefInput = {
  fileId: string;
  fileName: string;
  projectId: string;
  buildingId: string;
  locationId: string;
  fileVersionId?: string | null;
  levelId?: string | null;
  view?: "3d" | "plan";
  mode?: BuildingWorkspaceMode | null;
  alignLevelId?: string | null;
  alignAssetId?: string | null;
};

/** Build a `/bim-viewer` URL for the building workspace (work or edit/mapping). */
export function buildWorkspaceHref(input: WorkspaceHrefInput): string {
  const q = new URLSearchParams({
    fileId: input.fileId,
    name: input.fileName,
    projectId: input.projectId,
    buildingId: input.buildingId,
    locationId: input.locationId,
  });
  if (input.fileVersionId) q.set("fileVersionId", input.fileVersionId);
  if (input.levelId) q.set("levelId", input.levelId);
  if (input.view) q.set("view", input.view);
  if (input.mode) q.set("mode", input.mode);
  if (input.alignLevelId) q.set("alignLevelId", input.alignLevelId);
  if (input.alignAssetId) q.set("alignAssetId", input.alignAssetId);
  return `/bim-viewer?${q.toString()}`;
}

export function parseBuildingWorkspaceMode(
  raw: string | null | undefined,
  opts?: { alignActive?: boolean },
): BuildingWorkspaceMode {
  if (raw === "edit" || raw === "work") return raw;
  // Align/match deep-links without mode always mean mapping setup.
  if (opts?.alignActive) return "edit";
  return "work";
}

export function workspaceHrefFromIfcAsset(
  asset: BuildingAsset,
  projectId: string,
  buildingId: string,
  locationId: string,
  extras?: Pick<WorkspaceHrefInput, "levelId" | "view" | "mode" | "alignLevelId" | "alignAssetId">,
): string {
  return buildWorkspaceHref({
    fileId: asset.id,
    fileName: asset.fileName,
    projectId,
    buildingId,
    locationId,
    fileVersionId: asset.fileVersionId,
    ...extras,
  });
}
