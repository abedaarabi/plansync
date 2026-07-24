import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";

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

/** Update the browser URL without navigation (keeps the viewer session alive). */
export function syncFederationViewerUrl(projectId: string, members: BimFederationMember[]): void {
  if (typeof window === "undefined") return;
  const url = buildFederationViewerUrl(projectId, members);
  window.history.replaceState(window.history.state, "", url);
}

export function buildFederationViewerUrl(
  projectId: string,
  members: BimFederationMember[],
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

  for (const src of sources) {
    for (const el of src.index.elements) {
      const enriched: BimQuantityEntry = {
        ...el,
        sourceFileVersionId: src.fileVersionId,
        sourceModelId: src.modelId,
        sourceLabel: src.label,
      };
      elements.push(enriched);

      let typeAgg = byType[el.ifcType];
      if (!typeAgg) {
        typeAgg = { ifcType: el.ifcType, count: 0, guids: [] };
        byType[el.ifcType] = typeAgg;
      }
      typeAgg.count += 1;
      typeAgg.guids.push(el.guid);

      const level = el.level ?? "Unassigned";
      let levelAgg = byLevel[level];
      if (!levelAgg) {
        levelAgg = { level, count: 0, guids: [] };
        byLevel[level] = levelAgg;
      }
      levelAgg.count += 1;
      levelAgg.guids.push(el.guid);
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
  };
}
