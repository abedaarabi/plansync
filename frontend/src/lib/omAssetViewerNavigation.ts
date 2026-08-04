import { assetHasSheetPin } from "@/lib/assetPinFocus";
import type { OmAssetRow } from "@/lib/api-client";
import { isIfcFile, isPdfFile } from "@/lib/isPdfFile";
import type { CloudFile, FileVersion } from "@/types/projects";

export type OmAssetViewerMode = "place" | "focus";

/** True when the asset has a BIM element anchor (may also have a separate PDF drawing). */
export function omAssetHasBimLink(
  asset: Pick<OmAssetRow, "bimAnchor" | "fileId" | "fileVersionId">,
): boolean {
  return Boolean(asset.bimAnchor?.ifcGuid?.trim());
}

function findFileByVersionId(
  files: CloudFile[],
  fileVersionId: string,
): { file: CloudFile; version: FileVersion } | null {
  for (const file of files) {
    const version = file.versions.find((v) => v.id === fileVersionId);
    if (version) return { file, version };
  }
  return null;
}

/** Linked project file when `fileId` points at a PDF drawing. */
export function omAssetLinkedPdfFile(
  asset: Pick<OmAssetRow, "fileId">,
  projectFiles: CloudFile[],
): CloudFile | null {
  if (!asset.fileId) return null;
  const f = projectFiles.find((x) => x.id === asset.fileId);
  return f && isPdfFile(f) ? f : null;
}

/**
 * Resolve the IFC model to open for a BIM-linked asset.
 * Prefers `bimAnchor.fileVersionId` when the asset's primary file is a PDF (or missing).
 */
function omAssetBimModelRef(
  asset: OmAssetRow,
  projectFiles: CloudFile[] = [],
): {
  fileId: string;
  fileVersionId: string;
  fileName: string;
  version: number;
} | null {
  const guid = asset.bimAnchor?.ifcGuid?.trim();
  if (!guid) return null;

  const anchorFv = asset.bimAnchor?.fileVersionId?.trim();
  if (anchorFv) {
    const resolved = findFileByVersionId(projectFiles, anchorFv);
    if (resolved && isIfcFile(resolved.file)) {
      return {
        fileId: resolved.file.id,
        fileVersionId: resolved.version.id,
        fileName: resolved.file.name,
        version: resolved.version.version,
      };
    }
  }

  if (!asset.fileId || !asset.fileVersionId || !asset.file || !asset.fileVersion) return null;
  if (isPdfFile(asset.file)) return null;
  if (projectFiles.length > 0) {
    const f = projectFiles.find((x) => x.id === asset.fileId);
    if (f && !isIfcFile(f) && isPdfFile(f)) return null;
  } else if (asset.file.name && isPdfFile(asset.file)) {
    return null;
  }

  return {
    fileId: asset.fileId,
    fileVersionId: asset.fileVersionId,
    fileName: asset.file.name,
    version: asset.fileVersion.version,
  };
}

export function omAssetCanOpenBim(asset: OmAssetRow, projectFiles: CloudFile[] = []): boolean {
  return omAssetBimModelRef(asset, projectFiles) != null;
}

export function omAssetCanOpenDrawing(
  asset: Pick<OmAssetRow, "fileId">,
  projectFiles: CloudFile[],
): boolean {
  return omAssetLinkedPdfFile(asset, projectFiles) != null;
}

/** Relative URL to open the BIM viewer focused on the linked element. */
export function omAssetBimViewerHref(
  projectId: string,
  asset: OmAssetRow,
  projectFiles: CloudFile[] = [],
): string | null {
  const guid = asset.bimAnchor?.ifcGuid?.trim();
  const model = omAssetBimModelRef(asset, projectFiles);
  if (!guid || !model) return null;
  const q = new URLSearchParams({
    fileId: model.fileId,
    name: model.fileName,
    projectId,
    fileVersionId: model.fileVersionId,
    version: String(model.version),
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
