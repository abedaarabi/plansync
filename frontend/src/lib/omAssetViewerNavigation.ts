import { assetHasSheetPin } from "@/lib/assetPinFocus";
import type { OmAssetRow } from "@/lib/api-client";
import type { CloudFile } from "@/types/projects";

export type OmAssetViewerMode = "place" | "focus";

export function omAssetHasBimLink(
  asset: Pick<OmAssetRow, "bimAnchor" | "fileId" | "fileVersionId">,
): boolean {
  return Boolean(asset.bimAnchor?.ifcGuid?.trim() && asset.fileId && asset.fileVersionId);
}

/** Relative URL to open the BIM viewer focused on the linked element. */
export function omAssetBimViewerHref(projectId: string, asset: OmAssetRow): string | null {
  const guid = asset.bimAnchor?.ifcGuid?.trim();
  if (!guid || !asset.fileId || !asset.fileVersionId || !asset.file || !asset.fileVersion) {
    return null;
  }
  const q = new URLSearchParams({
    fileId: asset.fileId,
    name: asset.file.name,
    projectId,
    fileVersionId: asset.fileVersionId,
    version: String(asset.fileVersion.version),
    guid,
    omAssetId: asset.id,
  });
  return `/bim-viewer?${q.toString()}`;
}

export function buildOmAssetViewerQuery(
  projectId: string,
  file: CloudFile,
  asset: Pick<OmAssetRow, "id" | "tag" | "name" | "annotationId" | "pageNumber">,
  fileVersion: { id: string; version: number },
  mode: OmAssetViewerMode,
): URLSearchParams {
  const q = new URLSearchParams({
    fileId: file.id,
    name: file.name,
    projectId,
    fileVersionId: fileVersion.id,
    version: String(fileVersion.version),
    omAssetId: asset.id,
    omAssetTag: encodeURIComponent(asset.tag),
    omAssetName: encodeURIComponent(asset.name),
  });
  if (mode === "place") {
    q.set("omAssetLink", "1");
  } else {
    q.set("omAssetFocus", "1");
    if (asset.annotationId) q.set("omAssetAnnotationId", asset.annotationId);
    if (asset.pageNumber != null && asset.pageNumber >= 1) {
      q.set("page", String(asset.pageNumber));
    }
  }
  return q;
}

/** Open linked drawing to zoom the equipment pin, or start placement when no pin yet. */
export function omAssetViewerMode(asset: OmAssetRow): OmAssetViewerMode {
  return assetHasSheetPin(asset) ? "focus" : "place";
}

export function omAssetViewerHref(
  projectId: string,
  file: CloudFile,
  asset: OmAssetRow,
  fileVersion: { id: string; version: number },
  mode?: OmAssetViewerMode,
): string {
  const m = mode ?? omAssetViewerMode(asset);
  return `/viewer?${buildOmAssetViewerQuery(projectId, file, asset, fileVersion, m).toString()}`;
}
