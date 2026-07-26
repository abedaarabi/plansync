import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as WebIFC from "web-ifc";
const __dirname = dirname(fileURLToPath(import.meta.url));
function wasmDir() {
    const candidates = [
        join(__dirname, "../../../../node_modules/web-ifc"),
        join(__dirname, "../../../node_modules/web-ifc"),
        join(process.cwd(), "node_modules/web-ifc"),
        join(process.cwd(), "../node_modules/web-ifc"),
    ];
    for (const p of candidates) {
        if (existsSync(join(p, "web-ifc-node.wasm")) || existsSync(join(p, "web-ifc.wasm"))) {
            return p.endsWith("/") ? p : `${p}/`;
        }
    }
    const fallback = candidates[0];
    return fallback.endsWith("/") ? fallback : `${fallback}/`;
}
function strVal(v) {
    if (v == null)
        return null;
    if (typeof v === "string") {
        const s = v.trim();
        return s === "" ? null : s;
    }
    if (typeof v === "object" && v !== null && "value" in v) {
        return strVal(v.value);
    }
    return String(v);
}
function numVal(v) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "object" && v !== null && "value" in v) {
        const n = Number(v.value);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}
/** Fast IFCBUILDINGSTOREY-only parse — no element walk. */
export async function extractStoreysFromIfc(ifcBytes) {
    const ifcApi = new WebIFC.IfcAPI();
    ifcApi.SetWasmPath(wasmDir(), true);
    await ifcApi.Init();
    const modelId = ifcApi.OpenModel(ifcBytes);
    const storeys = [];
    const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY, true);
    for (let i = 0; i < storeyIds.size(); i++) {
        const id = storeyIds.get(i);
        try {
            const props = await ifcApi.properties.getItemProperties(modelId, id, false, false);
            const rec = props;
            const name = strVal(rec.Name) ?? strVal(rec.LongName) ?? strVal(rec.Description) ?? `Level ${id}`;
            const elevation = numVal(rec.Elevation);
            storeys.push({
                sourceName: name,
                displayName: name,
                elevationMeters: elevation ?? null,
                elementCount: 0,
            });
        }
        catch {
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
        if (ea != null && eb != null && ea !== eb)
            return ea - eb;
        if (ea != null && eb == null)
            return -1;
        if (ea == null && eb != null)
            return 1;
        return a.sourceName.localeCompare(b.sourceName);
    });
    return storeys;
}
