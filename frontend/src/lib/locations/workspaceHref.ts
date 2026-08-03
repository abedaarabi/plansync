import type { BuildingAsset } from "@/lib/api-client/locations";
import type { BimFederationMember } from "@/lib/bim/federation";

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
  /** Preview an unmapped PDF before matching. */
  previewAssetId?: string | null;
  /** Additional federation members (primary is fileId / fileVersionId). */
  models?: BimFederationMember[] | null;
  /** Open a viewer dock on load (e.g. clashes). */
  panel?: string | null;
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
  if (input.previewAssetId) q.set("previewAssetId", input.previewAssetId);
  if (input.panel) q.set("panel", input.panel);
  if (input.models && input.models.length > 0) {
    q.set("models", encodeURIComponent(JSON.stringify(input.models)));
  }
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
  extras?: Pick<
    WorkspaceHrefInput,
    | "levelId"
    | "view"
    | "mode"
    | "alignLevelId"
    | "alignAssetId"
    | "previewAssetId"
    | "models"
    | "panel"
  >,
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

/** Build federated building workspace URL from selected READY IFC assets. */
export function workspaceHrefFromIfcAssets(
  assets: BuildingAsset[],
  projectId: string,
  buildingId: string,
  locationId: string,
  extras?: Pick<
    WorkspaceHrefInput,
    "levelId" | "view" | "mode" | "alignLevelId" | "alignAssetId" | "previewAssetId" | "panel"
  >,
): string | null {
  const ready = assets.filter((a) => a.type === "IFC" && a.status === "READY" && a.fileVersionId);
  if (ready.length === 0) return null;
  const primary = ready[0]!;
  const models: BimFederationMember[] = ready.slice(1).map((a) => ({
    fileId: a.id,
    fileVersionId: a.fileVersionId!,
    version: a.version != null ? String(a.version) : null,
    name: a.fileName,
  }));
  return workspaceHrefFromIfcAsset(primary, projectId, buildingId, locationId, {
    ...extras,
    models: models.length > 0 ? models : null,
  });
}
