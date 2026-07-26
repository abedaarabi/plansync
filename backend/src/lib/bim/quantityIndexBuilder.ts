import { gunzipSync } from "node:zlib";
import * as WebIFC from "web-ifc";
import { disciplineForIfcType } from "./discipline.js";
import { ifcNumVal, ifcStrVal, webIfcWasmDir } from "./ifcParseUtils.js";
import { extractSurfaceColorFromMaterials, hasAuthoredSurfaceStyle } from "./surfaceColor.js";
import type {
  BimElementQuantities,
  BimLevelAggregate,
  BimLodFlags,
  BimLoqReport,
  BimQuantityEntry,
  BimQuantityIndex,
  BimTypeAggregate,
} from "./types.js";

type SpatialNode = { expressID: number; type: string; children: SpatialNode[] };

function wasmDir(): string {
  return webIfcWasmDir();
}

function strVal(v: unknown): string | null {
  return ifcStrVal(v);
}

function numVal(v: unknown): number | undefined {
  return ifcNumVal(v);
}

// fallow-ignore-next-line complexity
function parseQuantitiesFromPsets(psets: unknown[]): {
  quantities: BimElementQuantities;
  source: "base" | "qto" | "missing";
} {
  const out: BimElementQuantities = {};
  let source: "base" | "qto" | "missing" = "missing";

  for (const pset of psets) {
    if (!pset || typeof pset !== "object") continue;
    const rec = pset as Record<string, unknown>;
    const psetName = strVal(rec.Name) ?? "";
    const isBase = /basequantit/i.test(psetName);
    const isQto = /^qto_/i.test(psetName) || /quantity/i.test(psetName);
    const quantities = rec.Quantities;
    if (!Array.isArray(quantities)) continue;

    for (const q of quantities) {
      if (!q || typeof q !== "object") continue;
      const qr = q as Record<string, unknown>;
      const len = numVal(qr.LengthValue);
      const area = numVal(qr.AreaValue);
      const vol = numVal(qr.VolumeValue);
      const cnt = numVal(qr.CountValue);
      const wgt = numVal(qr.WeightValue);
      if (len != null) out.length = len;
      if (area != null) out.area = area;
      if (vol != null) out.volume = vol;
      if (cnt != null) out.count = cnt;
      if (wgt != null) out.weight = wgt;
    }
    if (Object.keys(out).length > 0) {
      source = isBase ? "base" : isQto ? "qto" : "base";
    }
  }

  return { quantities: out, source };
}

function materialFromPsets(materials: unknown[]): string | null {
  for (const m of materials) {
    if (!m || typeof m !== "object") continue;
    const name = strVal((m as Record<string, unknown>).Name);
    if (name) return name;
  }
  return null;
}

// fallow-ignore-next-line complexity
function buildLoq(elements: BimQuantityEntry[]): BimLoqReport {
  const total = elements.length;
  let withIdentity = 0;
  let withLevel = 0;
  let withMaterial = 0;
  let withQuantities = 0;
  let withAuthoredColor = 0;

  for (const el of elements) {
    if (el.guid && el.ifcType) withIdentity += 1;
    if (el.level) withLevel += 1;
    if (el.material) withMaterial += 1;
    if (el.quantitySource !== "missing") withQuantities += 1;
    if (el.lodFlags.color) withAuthoredColor += 1;
  }

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const hints: string[] = [];
  if (pct(withQuantities) < 50) {
    hints.push("Enable “Export base quantities” in Revit IFC export (Property Sets tab).");
  }
  if (pct(withMaterial) < 30) {
    hints.push("Export material property sets from the authoring tool for richer LOQ.");
  }
  if (pct(withAuthoredColor) < 40) {
    hints.push(
      "Export surface styles and material appearance (IFC SurfaceStyle / textures) for accurate model colors.",
    );
  }
  if (pct(withLevel) < 40) {
    hints.push("Ensure building storeys and spatial containment are modeled before export.");
  }

  return {
    totalElements: total,
    withIdentity,
    withLevel,
    withMaterial,
    withQuantities,
    withAuthoredColor,
    pctIdentity: pct(withIdentity),
    pctQuantities: pct(withQuantities),
    pctMaterial: pct(withMaterial),
    pctLevel: pct(withLevel),
    pctAuthoredColor: pct(withAuthoredColor),
    recommendedExportHints: hints,
  };
}

function aggregateByType(elements: BimQuantityEntry[]): Record<string, BimTypeAggregate> {
  const out: Record<string, BimTypeAggregate> = {};
  for (const el of elements) {
    let agg = out[el.ifcType];
    if (!agg) {
      agg = { ifcType: el.ifcType, count: 0, guids: [] };
      out[el.ifcType] = agg;
    }
    agg.count += 1;
    agg.guids.push(el.guid);
    if (el.quantities.length != null)
      agg.totalLength = (agg.totalLength ?? 0) + el.quantities.length;
    if (el.quantities.area != null) agg.totalArea = (agg.totalArea ?? 0) + el.quantities.area;
    if (el.quantities.volume != null)
      agg.totalVolume = (agg.totalVolume ?? 0) + el.quantities.volume;
  }
  return out;
}

function aggregateByLevel(elements: BimQuantityEntry[]): Record<string, BimLevelAggregate> {
  const out: Record<string, BimLevelAggregate> = {};
  for (const el of elements) {
    const level = el.level ?? "Unassigned";
    let agg = out[level];
    if (!agg) {
      agg = { level, count: 0, guids: [] };
      out[level] = agg;
    }
    agg.count += 1;
    agg.guids.push(el.guid);
  }
  return out;
}

function resolveIfcTypeName(ifcApi: WebIFC.IfcAPI, modelId: number, expressId: number): string {
  try {
    const line = ifcApi.GetLine(modelId, expressId) as { constructor?: { name?: string } };
    const fromCtor = line?.constructor?.name;
    if (fromCtor && fromCtor !== "Object" && fromCtor !== "IfcProduct") return fromCtor;
    const typeCode = ifcApi.GetLineType(modelId, expressId);
    const raw = ifcApi.GetNameFromTypeCode(typeCode);
    if (raw.startsWith("IFC") && raw.length > 3) return `Ifc${raw.slice(3)}`;
    return raw || "IfcProduct";
  } catch {
    return "IfcProduct";
  }
}

async function buildElementStoreyMap(
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
): Promise<Map<number, string>> {
  // fallow-ignore-next-line code-duplication
  const storeyNames = new Map<number, string>();
  const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY, true);
  for (let i = 0; i < storeyIds.size(); i++) {
    const id = storeyIds.get(i);
    try {
      const props = await ifcApi.properties.getItemProperties(modelId, id, false, false);
      storeyNames.set(
        id,
        strVal((props as Record<string, unknown>).Name) ??
          strVal((props as Record<string, unknown>).LongName) ??
          `Level ${id}`,
      );
    } catch {
      storeyNames.set(id, `Level ${id}`);
    }
  }

  const elementToStorey = new Map<number, string>();
  try {
    const root = (await ifcApi.properties.getSpatialStructure(modelId, false)) as SpatialNode;
    const walk = (node: SpatialNode, activeStorey: string | null) => {
      let storey = activeStorey;
      if (/BUILDINGSTOREY/i.test(node.type)) {
        storey = storeyNames.get(node.expressID) ?? `Level ${node.expressID}`;
      }
      if (
        storey &&
        !/PROJECT|SITE|BUILDING|BUILDINGSTOREY|SPACE|REL/i.test(node.type.replace(/^IFC/i, ""))
      ) {
        elementToStorey.set(node.expressID, storey);
      }
      for (const child of node.children) walk(child, storey);
    };
    walk(root, null);
  } catch {
    /* spatial tree optional */
  }
  return elementToStorey;
}

function buildLoqFromLightEntries(
  entries: Pick<BimQuantityEntry, "guid" | "ifcType" | "level">[],
): BimLoqReport {
  const total = entries.length;
  let withIdentity = 0;
  let withLevel = 0;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  for (const el of entries) {
    if (el.guid && el.ifcType) withIdentity += 1;
    if (el.level) withLevel += 1;
  }
  return {
    totalElements: total,
    withIdentity,
    withLevel,
    withMaterial: 0,
    withQuantities: 0,
    withAuthoredColor: 0,
    pctIdentity: pct(withIdentity),
    pctQuantities: 0,
    pctMaterial: 0,
    pctLevel: pct(withLevel),
    pctAuthoredColor: 0,
    recommendedExportHints: [],
  };
}

type IfcSession = {
  ifcApi: WebIFC.IfcAPI;
  modelId: number;
  close: () => void;
};

async function openIfcSession(ifcBytes: Uint8Array): Promise<IfcSession> {
  const ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath(wasmDir(), true);
  await ifcApi.Init();
  const modelId = ifcApi.OpenModel(ifcBytes);
  return {
    ifcApi,
    modelId,
    close: () => {
      ifcApi.CloseModel(modelId);
    },
  };
}

function collectProductIds(ifcApi: WebIFC.IfcAPI, modelId: number): number[] {
  const productIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCPRODUCT, true);
  const allIds: number[] = [];
  for (let i = 0; i < productIds.size(); i++) allIds.push(productIds.get(i));
  return allIds;
}

async function processSummaryExpressId(
  // fallow-ignore-next-line code-duplication
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
  expressId: number,
  storeyMap: Map<number, string>,
): Promise<BimQuantityEntry | null> {
  try {
    const ifcType = resolveIfcTypeName(ifcApi, modelId, expressId);
    const props = await ifcApi.properties.getItemProperties(modelId, expressId, false, false);
    const guid = strVal((props as Record<string, unknown>).GlobalId) ?? `express-${expressId}`;
    const name = strVal((props as Record<string, unknown>).Name);
    const lodFlags: BimLodFlags = {
      identity: Boolean(guid && ifcType),
      dimensions: false,
      quantities: false,
      material: false,
      color: false,
    };
    return {
      expressId,
      guid,
      ifcType,
      name,
      level: storeyMap.get(expressId) ?? null,
      material: null,
      discipline: disciplineForIfcType(ifcType),
      surfaceColor: null,
      quantities: {},
      quantitySource: "missing",
      lodFlags,
    };
  } catch {
    return null;
  }
}

async function processFullExpressId(
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
  expressId: number,
  storeyMap: Map<number, string>,
): Promise<BimQuantityEntry | null> {
  try {
    const ifcType = resolveIfcTypeName(ifcApi, modelId, expressId);
    const props = await ifcApi.properties.getItemProperties(modelId, expressId, false, false);
    const guid = strVal((props as Record<string, unknown>).GlobalId) ?? `express-${expressId}`;
    const name = strVal((props as Record<string, unknown>).Name);

    let psets: unknown[] = [];
    let materials: unknown[] = [];
    try {
      psets = await ifcApi.properties.getPropertySets(modelId, expressId, true, true);
    } catch {
      /* optional */
    }
    try {
      materials = await ifcApi.properties.getMaterialsProperties(modelId, expressId, true, true);
    } catch {
      /* optional */
    }

    const { quantities, source } = parseQuantitiesFromPsets(psets);
    const material = materialFromPsets(materials);
    const surfaceColor = extractSurfaceColorFromMaterials(materials);

    const lodFlags: BimLodFlags = {
      identity: Boolean(guid && ifcType),
      dimensions: Boolean(quantities.length || quantities.area || quantities.volume),
      quantities: source !== "missing",
      material: Boolean(material),
      color: hasAuthoredSurfaceStyle(materials, surfaceColor),
    };

    return {
      expressId,
      guid,
      ifcType,
      name,
      level: storeyMap.get(expressId) ?? null,
      material,
      discipline: disciplineForIfcType(ifcType),
      surfaceColor,
      quantities,
      quantitySource: source,
      lodFlags,
    };
  } catch {
    return null;
  }
}

async function processExpressIdsParallel<T>(
  allIds: number[],
  worker: (expressId: number) => Promise<T | null>,
  onProgress?: (fraction: number) => void,
): Promise<T[]> {
  const results: T[] = [];
  const total = allIds.length;
  const concurrency = Math.min(48, Math.max(1, total));
  let nextIndex = 0;
  let completed = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) break;
      const entry = await worker(allIds[i]!);
      if (entry) results.push(entry);
      completed += 1;
      if (completed % 200 === 0 || completed === total) {
        onProgress?.(completed / Math.max(total, 1));
      }
    }
  });
  await Promise.all(workers);
  onProgress?.(1);
  return results;
}

/** Fast pass — types, levels, and GUID lists without property-set walks. */
export async function buildQuantityIndexSummaryFromIfc(
  ifcBytes: Uint8Array,
  fileVersionId: string,
  onProgress?: (fraction: number) => void,
): Promise<BimQuantityIndex> {
  const session = await openIfcSession(ifcBytes);
  try {
    const storeyMap = await buildElementStoreyMap(session.ifcApi, session.modelId);
    onProgress?.(0.05);
    const allIds = collectProductIds(session.ifcApi, session.modelId);
    const lightEntries = await processExpressIdsParallel(
      allIds,
      (id) => processSummaryExpressId(session.ifcApi, session.modelId, id, storeyMap),
      (fraction) => onProgress?.(0.05 + fraction * 0.95),
    );
    const loq = buildLoqFromLightEntries(lightEntries);
    return {
      version: 1,
      fileVersionId,
      generatedAt: new Date().toISOString(),
      loq,
      elements: [],
      byType: aggregateByType(lightEntries),
      byLevel: aggregateByLevel(lightEntries),
      partial: true,
    };
  } finally {
    session.close();
  }
}

/** Full pass — property sets, materials, and per-element quantities. */
export async function buildQuantityIndexFullFromIfc(
  ifcBytes: Uint8Array,
  fileVersionId: string,
  onProgress?: (fraction: number) => void,
): Promise<BimQuantityIndex> {
  const session = await openIfcSession(ifcBytes);
  try {
    const storeyMap = await buildElementStoreyMap(session.ifcApi, session.modelId);
    onProgress?.(0.02);
    const allIds = collectProductIds(session.ifcApi, session.modelId);
    const elements = await processExpressIdsParallel(
      allIds,
      (id) => processFullExpressId(session.ifcApi, session.modelId, id, storeyMap),
      (fraction) => onProgress?.(0.02 + fraction * 0.98),
    );
    const loq = buildLoq(elements);
    return {
      version: 1,
      fileVersionId,
      generatedAt: new Date().toISOString(),
      loq,
      elements,
      byType: aggregateByType(elements),
      byLevel: aggregateByLevel(elements),
      partial: false,
    };
  } finally {
    session.close();
  }
}

/** Parse stored quantity index JSON safely. */
function parseQuantityIndex(raw: unknown): BimQuantityIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as BimQuantityIndex;
  if (o.version !== 1 || !Array.isArray(o.elements)) return null;
  if (!o.byType || !o.byLevel) return null;
  return o;
}

/** Strip element payloads for incremental API responses. */
export function toQuantityIndexSummary(index: BimQuantityIndex): BimQuantityIndex {
  return {
    ...index,
    elements: [],
    partial: true,
  };
}

/** Decode quantity index bytes from S3 (plain JSON or gzip). */
export function parseQuantityIndexBuffer(buf: Buffer): BimQuantityIndex | null {
  try {
    const text =
      buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
        ? gunzipSync(buf).toString("utf8")
        : buf.toString("utf8");
    return parseQuantityIndex(JSON.parse(text));
  } catch {
    return null;
  }
}
