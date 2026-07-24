import type { IssueBimAnchor } from "@/lib/api-client/core-issues-takeoff";
import type { BimSelection } from "@/components/bim-viewer/bimEngine";

// fallow-ignore-next-line complexity
export function selectionToBimAnchor(selection: BimSelection): IssueBimAnchor | undefined {
  const guid = selection.ifcGuid?.trim();
  if (guid) {
    return {
      ifcGuid: guid,
      localId: selection.localId,
      name: selection.name ?? undefined,
      ifcType: selection.ifcType ?? undefined,
      spatialPath: selection.storey ? [selection.storey] : undefined,
      position: selection.position ?? undefined,
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
    };
  }
  return undefined;
}
