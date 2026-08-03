import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";
import { disciplineForIfcType } from "@/lib/bim/discipline";

/** One IFC revision in a federated viewer session. */
export type BimFederationMember = {
  fileId: string;
  fileVersionId: string;
  version?: string | null;
  name: string;
};

export function buildModelId(
  member: Pick<BimFederationMember, "fileId" | "fileVersionId">,
): string {
  return `${member.fileId}:${member.fileVersionId}`;
}

// fallow-ignore-next-line complexity
export function parseFederationMembers(
  primary: BimFederationMember,
  modelsParam: string | null,
): BimFederationMember[] {
  const out: BimFederationMember[] = [primary];
  if (!modelsParam?.trim()) return out;
  try {
    const raw = modelsParam.startsWith("%") ? decodeURIComponent(modelsParam) : modelsParam;
    const extra = JSON.parse(raw) as BimFederationMember[];
    if (!Array.isArray(extra)) return out;
    for (const m of extra) {
      if (!m?.fileId || !m?.fileVersionId) continue;
      if (out.some((x) => x.fileVersionId === m.fileVersionId)) continue;
      out.push({
        fileId: m.fileId,
        fileVersionId: m.fileVersionId,
        version: m.version ?? null,
        name: m.name?.trim() || "Model.ifc",
      });
    }
  } catch {
    /* ignore malformed URL */
  }
  return out;
}

/** Serialize additional federation members for the `models` query param. */
function serializeFederationMembers(members: BimFederationMember[]): string {
  if (members.length <= 1) return "";
  return encodeURIComponent(JSON.stringify(members.slice(1)));
}

/** Workspace query keys preserved when federation membership changes in-viewer. */
const WORKSPACE_PRESERVE_KEYS = [
  "buildingId",
  "locationId",
  "mode",
  "view",
  "levelId",
  "alignLevelId",
  "alignAssetId",
  "previewAssetId",
  "panel",
] as const;

function applyPreservedWorkspaceParams(
  q: URLSearchParams,
  from: URLSearchParams | null | undefined,
): void {
  if (!from) return;
  for (const key of WORKSPACE_PRESERVE_KEYS) {
    const v = from.get(key);
    if (v) q.set(key, v);
  }
}

/** Update the browser URL without navigation (keeps the viewer session alive). */
export function syncFederationViewerUrl(projectId: string, members: BimFederationMember[]): void {
  if (typeof window === "undefined") return;
  const current = new URLSearchParams(window.location.search);
  const url = buildFederationViewerUrl(projectId, members, { preserveFrom: current });
  window.history.replaceState(window.history.state, "", url);
}

export function buildFederationViewerUrl(
  projectId: string,
  members: BimFederationMember[],
  opts?: { preserveFrom?: URLSearchParams | null },
): string {
  const primary = members[0];
  if (!primary) return "/bim-viewer";
  const q = new URLSearchParams({
    fileId: primary.fileId,
    fileVersionId: primary.fileVersionId,
    name: primary.name,
    projectId,
  });
  if (primary.version) q.set("version", primary.version);
  const extra = serializeFederationMembers(members);
  if (extra) q.set("models", extra);
  applyPreservedWorkspaceParams(q, opts?.preserveFrom);
  return `/bim-viewer?${q.toString()}`;
}

export type FederatedQuantitySource = {
  fileVersionId: string;
  modelId: string;
  label: string;
  index: BimQuantityIndex;
};

/** Merge per-model quantity indices for the Objects tab and selection map. */
// fallow-ignore-next-line complexity
export function mergeFederatedQuantityIndices(
  sources: FederatedQuantitySource[],
): BimQuantityIndex | null {
  if (sources.length === 0) return null;
  const elements: BimQuantityEntry[] = [];
  const byType: BimQuantityIndex["byType"] = {};
  const byLevel: BimQuantityIndex["byLevel"] = {};
  let anyPartial = false;

  // fallow-ignore-next-line complexity
  const mergeTypeAgg = (
    ifcType: string,
    count: number,
    guids: string[],
    totals?: { totalLength?: number; totalArea?: number; totalVolume?: number },
  ) => {
    let typeAgg = byType[ifcType];
    if (!typeAgg) {
      typeAgg = { ifcType, count: 0, guids: [] };
      byType[ifcType] = typeAgg;
    }
    typeAgg.count += count;
    typeAgg.guids.push(...guids);
    if (totals?.totalLength != null)
      typeAgg.totalLength = (typeAgg.totalLength ?? 0) + totals.totalLength;
    if (totals?.totalArea != null) typeAgg.totalArea = (typeAgg.totalArea ?? 0) + totals.totalArea;
    if (totals?.totalVolume != null)
      typeAgg.totalVolume = (typeAgg.totalVolume ?? 0) + totals.totalVolume;
  };

  const mergeLevelAgg = (level: string, count: number, guids: string[]) => {
    let levelAgg = byLevel[level];
    if (!levelAgg) {
      levelAgg = { level, count: 0, guids: [] };
      byLevel[level] = levelAgg;
    }
    levelAgg.count += count;
    levelAgg.guids.push(...guids);
  };

  for (const src of sources) {
    if (src.index.partial) anyPartial = true;

    if (src.index.elements.length > 0) {
      for (const el of src.index.elements) {
        const enriched: BimQuantityEntry = {
          ...el,
          sourceFileVersionId: src.fileVersionId,
          sourceModelId: src.modelId,
          sourceLabel: src.label,
        };
        elements.push(enriched);
        mergeTypeAgg(el.ifcType, 1, [el.guid], {
          totalLength: el.quantities.length,
          totalArea: el.quantities.area,
          totalVolume: el.quantities.volume,
        });
        mergeLevelAgg(el.level ?? "Unassigned", 1, [el.guid]);
      }
      continue;
    }

    // Summary indexes strip `elements` but keep guid lists in byType/byLevel.
    // Rebuild stubs so clash sets (and other guid-driven tools) still resolve.
    const levelByGuid = new Map<string, string>();
    for (const agg of Object.values(src.index.byLevel)) {
      mergeLevelAgg(agg.level, agg.count, agg.guids);
      for (const guid of agg.guids) levelByGuid.set(guid, agg.level);
    }
    for (const agg of Object.values(src.index.byType)) {
      mergeTypeAgg(agg.ifcType, agg.count, agg.guids, {
        totalLength: agg.totalLength,
        totalArea: agg.totalArea,
        totalVolume: agg.totalVolume,
      });
      for (const guid of agg.guids) {
        elements.push({
          expressId: 0,
          guid,
          ifcType: agg.ifcType,
          name: null,
          level: levelByGuid.get(guid) ?? null,
          material: null,
          discipline: disciplineForIfcType(agg.ifcType),
          quantities: {},
          quantitySource: "missing",
          lodFlags: {
            identity: true,
            dimensions: false,
            quantities: false,
            material: false,
            color: false,
          },
          sourceFileVersionId: src.fileVersionId,
          sourceModelId: src.modelId,
          sourceLabel: src.label,
        });
      }
    }
  }

  const primary = sources[0]!;
  return {
    version: 1,
    fileVersionId: primary.fileVersionId,
    generatedAt: new Date().toISOString(),
    loq: primary.index.loq,
    elements,
    byType,
    byLevel,
    partial: anyPartial ? true : undefined,
  };
}
