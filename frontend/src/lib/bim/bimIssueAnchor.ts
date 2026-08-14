import type { IssueBimAnchor } from "@/lib/api-client/core-issues-takeoff";
import type { BimSelection } from "@/components/bim-viewer/bimEngine";

function selectionModelMeta(
  selection: BimSelection,
): Pick<IssueBimAnchor, "fileId" | "fileVersionId" | "modelFileName"> {
  const fileId = selection.modelId.split(":")[0]?.trim() || undefined;
  return {
    fileId,
    fileVersionId: selection.fileVersionId ?? undefined,
    modelFileName: selection.sourceLabel?.trim() || undefined,
  };
}

// fallow-ignore-next-line complexity
export function selectionToBimAnchor(selection: BimSelection): IssueBimAnchor | undefined {
  const modelMeta = selectionModelMeta(selection);
  const guid = selection.ifcGuid?.trim();
  if (guid) {
    return {
      ifcGuid: guid,
      localId: selection.localId,
      name: selection.name ?? undefined,
      ifcType: selection.ifcType ?? undefined,
      spatialPath: selection.storey ? [selection.storey] : undefined,
      position: selection.position ?? undefined,
      ...modelMeta,
    };
  }
  if (selection.position) {
    return {
      ifcGuid: "viewport-markup",
      localId: selection.localId,
      name: selection.name ?? undefined,
      ifcType: selection.ifcType ?? undefined,
      spatialPath: selection.storey ? [selection.storey] : undefined,
      position: selection.position,
      ...modelMeta,
    };
  }
  return undefined;
}
