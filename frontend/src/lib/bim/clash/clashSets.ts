import type { BimClashSetDef, BimClashSetRule } from "@plansync/shared/bimClashTypes";
import type { BimQuantityEntry, BimQuantityIndex } from "@plansync/shared/bimTypes";
import { disciplineForIfcType } from "@/lib/bim/discipline";

export type ResolvedClashElement = {
  guid: string;
  fileVersionId: string;
  modelId: string | null;
  ifcType: string | null;
  name: string | null;
  level: string | null;
  discipline: string;
};

/** MEP is an umbrella trade for clash selection (ducts/pipes/elec often split). */
function expandDisciplineValues(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of values) {
    const v = raw.toLowerCase();
    out.add(v);
    if (v === "mep") {
      out.add("mechanical");
      out.add("electrical");
    }
  }
  return out;
}

// fallow-ignore-next-line complexity
function entryMatchesRule(entry: BimQuantityEntry, rule: BimClashSetRule): boolean {
  const values = new Set(rule.values.map((v) => v.toLowerCase()));
  switch (rule.field) {
    case "model": {
      const mid = (entry.sourceModelId ?? entry.sourceFileVersionId ?? "").toLowerCase();
      const label = (entry.sourceLabel ?? "").toLowerCase();
      const fvid = (entry.sourceFileVersionId ?? "").toLowerCase();
      if (values.has(mid) || values.has(label) || values.has(fvid)) return true;
      // Match `fileId:fileVersionId` rules against either half.
      for (const v of values) {
        if (fvid && (v === fvid || v.endsWith(`:${fvid}`))) return true;
        if (mid && (v === mid || mid.endsWith(`:${v}`) || v.endsWith(`:${mid}`))) return true;
      }
      return false;
    }
    case "discipline": {
      const d = (entry.discipline ?? disciplineForIfcType(entry.ifcType)).toLowerCase();
      return expandDisciplineValues(rule.values).has(d);
    }
    case "ifcType":
      return values.has(entry.ifcType.toLowerCase());
    case "level":
      return values.has((entry.level ?? "").toLowerCase());
    default:
      return false;
  }
}

function entryMatchesSet(entry: BimQuantityEntry, set: BimClashSetDef): boolean {
  if (set.rules.length === 0) return false;
  // Rules within a set are AND; values within a rule are OR.
  return set.rules.every((rule) => entryMatchesRule(entry, rule));
}

export function resolveClashSet(
  index: BimQuantityIndex | null | undefined,
  set: BimClashSetDef,
  fallbackFileVersionId?: string | null,
): ResolvedClashElement[] {
  if (!index?.elements?.length) return [];
  const out: ResolvedClashElement[] = [];
  for (const entry of index.elements) {
    if (!entry.guid || !entryMatchesSet(entry, set)) continue;
    const fileVersionId = entry.sourceFileVersionId ?? fallbackFileVersionId ?? index.fileVersionId;
    if (!fileVersionId) continue;
    out.push({
      guid: entry.guid,
      fileVersionId,
      modelId: entry.sourceModelId ?? null,
      ifcType: entry.ifcType,
      name: entry.name,
      level: entry.level,
      discipline: entry.discipline ?? disciplineForIfcType(entry.ifcType),
    });
  }
  return out;
}

export function disciplineSetDef(label: string): BimClashSetDef {
  return {
    label,
    rules: [{ field: "discipline", values: [label] }],
  };
}

/** Build a set from a loaded model, optional IFC types, and optional level. */
export function buildClashSetDef(args: {
  modelId: string;
  modelName: string;
  ifcTypes?: string[];
  level?: string | null;
}): BimClashSetDef {
  const modelLabel = displayModelLabel(args.modelName);
  const types = (args.ifcTypes ?? []).filter(Boolean);
  const label =
    types.length === 0
      ? modelLabel
      : types.length === 1
        ? `${modelLabel} · ${types[0]}`
        : `${modelLabel} · ${types.length} types`;
  const rules: BimClashSetRule[] = [{ field: "model", values: [args.modelId] }];
  if (types.length > 0) rules.push({ field: "ifcType", values: types });
  if (args.level) rules.push({ field: "level", values: [args.level] });
  return { label, rules };
}

function entryMatchesModelId(entry: BimQuantityEntry, modelId: string): boolean {
  return entryMatchesRule(entry, { field: "model", values: [modelId] });
}

/** IFC types present in a loaded model (for what-vs-what filters). */
export function ifcTypeCountsForModel(
  index: BimQuantityIndex | null | undefined,
  modelId: string | null | undefined,
): { ifcType: string; count: number }[] {
  if (!index?.elements?.length || !modelId) return [];
  const counts = new Map<string, number>();
  for (const entry of index.elements) {
    if (!entry.guid || !entryMatchesModelId(entry, modelId)) continue;
    counts.set(entry.ifcType, (counts.get(entry.ifcType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([ifcType, count]) => ({ ifcType, count }))
    .sort((a, b) => b.count - a.count || a.ifcType.localeCompare(b.ifcType));
}

export function modelIdFromSet(set: BimClashSetDef): string | null {
  return set.rules.find((r) => r.field === "model")?.values[0] ?? null;
}

export function ifcTypesFromSet(set: BimClashSetDef): string[] {
  return set.rules.find((r) => r.field === "ifcType")?.values ?? [];
}

export function levelFromSet(set: BimClashSetDef): string | null {
  return set.rules.find((r) => r.field === "level")?.values[0] ?? null;
}

/** Strip IFC extension for picker labels. */
export function displayModelLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed.replace(/\.(ifc|ifczip)$/i, "") || trimmed || "Model";
}

/** Prefer Structure as A and MEP-like as B when auto-picking a pair. */
export function sortModelsForClashPair<T extends { name: string }>(models: T[]): T[] {
  const rank = (name: string) => {
    const n = name.toLowerCase();
    if (/struct|str\b|steel|frame|beton|concrete/.test(n)) return 0;
    if (/arch|archi|architektur/.test(n)) return 1;
    if (/mep|mech|hvac|elec|plumb|pipe|duct/.test(n)) return 2;
    return 3;
  };
  return [...models].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}
