import * as WebIFC from "web-ifc";
import { ifcNumVal, ifcStrVal, webIfcWasmDir } from "./ifcParseUtils.js";

export type StoreyPreview = {
  sourceName: string;
  displayName: string;
  elevationMeters: number | null;
  elementCount: number;
};

/** Fast IFCBUILDINGSTOREY-only parse — no element walk. */
export async function extractStoreysFromIfc(ifcBytes: Uint8Array): Promise<StoreyPreview[]> {
  const ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath(webIfcWasmDir(), true);
  await ifcApi.Init();

  const modelId = ifcApi.OpenModel(ifcBytes);
  const storeys: StoreyPreview[] = [];
  const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY, true);

  for (let i = 0; i < storeyIds.size(); i++) {
    const id = storeyIds.get(i);
    try {
      const props = await ifcApi.properties.getItemProperties(modelId, id, false, false);
      const rec = props as Record<string, unknown>;
      const name =
        ifcStrVal(rec.Name) ??
        ifcStrVal(rec.LongName) ??
        ifcStrVal(rec.Description) ??
        `Level ${id}`;
      const elevation = ifcNumVal(rec.Elevation);
      storeys.push({
        sourceName: name,
        displayName: name,
        elevationMeters: elevation ?? null,
        elementCount: 0,
      });
    } catch {
      storeys.push({
        sourceName: `Level ${id}`,
        displayName: `Level ${id}`,
        elevationMeters: null,
        elementCount: 0,
      });
    }
  }

  ifcApi.CloseModel(modelId);

  storeys.sort((a, b) => {
    const ea = a.elevationMeters;
    const eb = b.elevationMeters;
    if (ea != null && eb != null && ea !== eb) return ea - eb;
    if (ea != null && eb == null) return -1;
    if (ea == null && eb != null) return 1;
    return a.sourceName.localeCompare(b.sourceName);
  });

  return storeys;
}
