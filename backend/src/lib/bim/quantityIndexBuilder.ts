import { gunzipSync } from "node:zlib";
import * as WebIFC from "web-ifc";
import { disciplineForIfcType } from "./discipline.js";
import { readElementPlacement } from "./elementPlacement.js";
import { ifcNumVal, ifcStrVal, webIfcWasmDir } from "./ifcParseUtils.js";
import type {
  BimElementQuantities,
  BimLevelAggregate,
  BimLodFlags,
  BimLoqReport,
  BimQuantityEntry,
  BimQuantityIndex,
  BimTypeAggregate,
  BimTypeNameAggregate,
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

function aggregateByTypeName(elements: BimQuantityEntry[]): Record<string, BimTypeNameAggregate> {
  const out: Record<string, BimTypeNameAggregate> = {};
  for (const el of elements) {
    const typeName = el.typeName?.trim();
    if (!typeName) continue;
    let agg = out[typeName];
    if (!agg) {
      agg = { typeName, count: 0, guids: [] };
      out[typeName] = agg;
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

function relatedExpressIds(related: unknown): number[] {
  const list = Array.isArray(related) ? related : related != null ? [related] : [];
  const out: number[] = [];
  for (const item of list) {
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as { value?: unknown; expressID?: unknown };
    const value = rec.value ?? rec.expressID;
    if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  }
  return out;
}

function relatingTypeExpressId(relating: unknown): number | null {
  if (typeof relating === "number" && Number.isFinite(relating)) return relating;
  if (!relating || typeof relating !== "object") return null;
  const rec = relating as { value?: unknown; expressID?: unknown };
  const value = rec.value ?? rec.expressID;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Map product expressId → IfcTypeObject.Name via IfcRelDefinesByType.
 * Built once per IFC open for both summary and full passes.
 */
function buildProductTypeNameMap(ifcApi: WebIFC.IfcAPI, modelId: number): Map<number, string> {
  const out = new Map<number, string>();
  try {
    const relIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCRELDEFINESBYTYPE, true);
    for (let i = 0; i < relIds.size(); i++) {
      const relId = relIds.get(i);
      try {
        const rel = ifcApi.GetLine(modelId, relId) as Record<string, unknown>;
        const typeExpressId = relatingTypeExpressId(rel.RelatingType);
        if (typeExpressId == null) continue;
        let typeName: string | null = null;
        try {
          const typeLine = ifcApi.GetLine(modelId, typeExpressId) as Record<string, unknown>;
          typeName = strVal(typeLine.Name) ?? strVal(typeLine.ObjectType);
        } catch {
          continue;
        }
        if (!typeName) continue;
        for (const expressId of relatedExpressIds(rel.RelatedObjects)) {
          out.set(expressId, typeName);
        }
      } catch {
        /* skip malformed relation */
      }
    }
  } catch {
    /* optional — untyped IFCs */
  }
  return out;
}

function resolveEntryTypeName(
  expressId: number,
  typeNameMap: Map<number, string>,
  objectType: string | null,
): string | null {
  return typeNameMap.get(expressId) ?? objectType ?? null;
}

async function buildElementStoreyMap(
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
): Promise<Map<number, string>> {
  const storeyNames = new Map<number, string>();
  const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY, true);
  for (let i = 0; i < storeyIds.size(); i++) {
    const id = storeyIds.get(i);
    try {
      const line = ifcApi.GetLine(modelId, id) as Record<string, unknown>;
      storeyNames.set(id, strVal(line.Name) ?? strVal(line.LongName) ?? `Level ${id}`);
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

/** Below this size, skip the two-phase summary upload and do one full pass. */
const SINGLE_PASS_MAX_PRODUCTS = 500;

type IfcSession = {
  ifcApi: WebIFC.IfcAPI;
  modelId: number;
  close: () => void;
};

function readProductLineFields(
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
  expressId: number,
): { guid: string; name: string | null; objectType: string | null } {
  const line = ifcApi.GetLine(modelId, expressId) as Record<string, unknown>;
  return {
    guid: strVal(line.GlobalId) ?? `express-${expressId}`,
    name: strVal(line.Name),
    objectType: strVal(line.ObjectType),
  };
}

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

function processSummaryExpressIdSync(
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
  expressId: number,
  storeyMap: Map<number, string>,
  typeNameMap: Map<number, string>,
): BimQuantityEntry | null {
  try {
    const ifcType = resolveIfcTypeName(ifcApi, modelId, expressId);
    const { guid, name, objectType } = readProductLineFields(ifcApi, modelId, expressId);
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
      typeName: resolveEntryTypeName(expressId, typeNameMap, objectType),
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
  typeNameMap: Map<number, string>,
): Promise<BimQuantityEntry | null> {
  try {
    const ifcType = resolveIfcTypeName(ifcApi, modelId, expressId);
    const { guid, name, objectType } = readProductLineFields(ifcApi, modelId, expressId);

    let psets: unknown[] = [];
    try {
      psets = await withTimeout(
        ifcApi.properties
          .getPropertySets(modelId, expressId, true, true)
          .catch(() => [] as unknown[]),
        4000,
        [] as unknown[],
      );
    } catch {
      /* optional */
    }

    const { quantities, source } = parseQuantitiesFromPsets(psets);
    const material = null;
    const surfaceColor = null;

    const lodFlags: BimLodFlags = {
      identity: Boolean(guid && ifcType),
      dimensions: Boolean(quantities.length || quantities.area || quantities.volume),
      quantities: source !== "missing",
      material: false,
      color: false,
    };

    return {
      expressId,
      guid,
      ifcType,
      name,
      typeName: resolveEntryTypeName(expressId, typeNameMap, objectType),
      level: storeyMap.get(expressId) ?? null,
      material,
      discipline: disciplineForIfcType(ifcType),
      surfaceColor,
      placement: readElementPlacement(ifcApi, modelId, expressId),
      quantities,
      quantitySource: source,
      lodFlags,
    };
  } catch {
    return null;
  }
}

async function processExpressIdsSequential<T>(
  allIds: number[],
  worker: (expressId: number) => Promise<T | null>,
  onProgress?: (fraction: number) => void,
): Promise<T[]> {
  const results: T[] = [];
  const total = allIds.length;
  for (let i = 0; i < total; i++) {
    const entry = await worker(allIds[i]!);
    if (entry) results.push(entry);
    if (i === 0 || i === total - 1 || (i + 1) % 100 === 0) {
      onProgress?.((i + 1) / Math.max(total, 1));
    }
  }
  onProgress?.(1);
  return results;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function finalizeSummaryIndex(
  fileVersionId: string,
  lightEntries: BimQuantityEntry[],
): BimQuantityIndex {
  return {
    version: 1,
    fileVersionId,
    generatedAt: new Date().toISOString(),
    loq: buildLoqFromLightEntries(lightEntries),
    elements: [],
    byType: aggregateByType(lightEntries),
    byLevel: aggregateByLevel(lightEntries),
    byTypeName: aggregateByTypeName(lightEntries),
    partial: true,
  };
}

function finalizeFullIndex(fileVersionId: string, elements: BimQuantityEntry[]): BimQuantityIndex {
  return {
    version: 1,
    fileVersionId,
    generatedAt: new Date().toISOString(),
    loq: buildLoq(elements),
    elements,
    byType: aggregateByType(elements),
    byLevel: aggregateByLevel(elements),
    byTypeName: aggregateByTypeName(elements),
    partial: false,
  };
}

export type BuildQuantityIndexPhasedOpts = {
  skipSummary?: boolean;
  onSummaryReady?: (summary: BimQuantityIndex) => Promise<void>;
  onProgress?: (fraction: number, phase: "summary" | "full") => void;
};

/**
 * Single IFC read: optional fast summary (sync GetLine scan), then one full property pass.
 * Small models skip the summary phase entirely.
 */
export async function buildQuantityIndexPhased(
  ifcBytes: Uint8Array,
  fileVersionId: string,
  opts?: BuildQuantityIndexPhasedOpts,
): Promise<BimQuantityIndex> {
  const session = await openIfcSession(ifcBytes);
  try {
    const storeyMap = await buildElementStoreyMap(session.ifcApi, session.modelId);
    const typeNameMap = buildProductTypeNameMap(session.ifcApi, session.modelId);
    const allIds = collectProductIds(session.ifcApi, session.modelId);
    const total = allIds.length;

    opts?.onProgress?.(0.02, total <= SINGLE_PASS_MAX_PRODUCTS ? "full" : "summary");

    if (total <= SINGLE_PASS_MAX_PRODUCTS) {
      const elements = await processExpressIdsSequential(
        allIds,
        (id) => processFullExpressId(session.ifcApi, session.modelId, id, storeyMap, typeNameMap),
        (fraction) => opts?.onProgress?.(0.02 + fraction * 0.98, "full"),
      );
      return finalizeFullIndex(fileVersionId, elements);
    }

    if (!opts?.skipSummary) {
      const lightEntries: BimQuantityEntry[] = [];
      for (let i = 0; i < total; i++) {
        const entry = processSummaryExpressIdSync(
          session.ifcApi,
          session.modelId,
          allIds[i]!,
          storeyMap,
          typeNameMap,
        );
        if (entry) lightEntries.push(entry);
        if (i === 0 || i === total - 1 || (i + 1) % 500 === 0) {
          opts?.onProgress?.(0.02 + ((i + 1) / total) * 0.33, "summary");
        }
      }
      const summary = finalizeSummaryIndex(fileVersionId, lightEntries);
      await opts?.onSummaryReady?.(summary);
    }

    opts?.onProgress?.(0.35, "full");
    const elements = await processExpressIdsSequential(
      allIds,
      (id) => processFullExpressId(session.ifcApi, session.modelId, id, storeyMap, typeNameMap),
      (fraction) => opts?.onProgress?.(0.35 + fraction * 0.65, "full"),
    );
    return finalizeFullIndex(fileVersionId, elements);
  } finally {
    session.close();
  }
}

/** Normalize optional typeName on legacy or partial stored entries. */
export function normalizeQuantityEntryTypeName(entry: BimQuantityEntry): BimQuantityEntry {
  if ("typeName" in entry) {
    const raw = entry.typeName;
    if (raw == null) return { ...entry, typeName: null };
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return { ...entry, typeName: trimmed || null };
  }
  return { ...entry, typeName: null };
}

/** Parse stored quantity index JSON safely (legacy indexes omit typeName). */
export function parseQuantityIndex(raw: unknown): BimQuantityIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as BimQuantityIndex;
  if (o.version !== 1 || !Array.isArray(o.elements)) return null;
  if (!o.byType || !o.byLevel) return null;
  return {
    ...o,
    elements: o.elements.map((el) => normalizeQuantityEntryTypeName(el)),
  };
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
