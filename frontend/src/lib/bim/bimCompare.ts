import { BIM_PALETTE } from "@/lib/bim/bimPalette";

export type BimCompareKind = "added" | "modified" | "deleted";

export type BimCompareRow = {
  guid: string;
  name: string | null;
  ifcType: string | null;
  kind: BimCompareKind;
};

export type BimCompareCounts = {
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
  baseLive: number;
  currentLive: number;
};

export type BimElementChanges = {
  baseFileVersionId: string;
  compareFileVersionId: string;
  baseVersion: number;
  compareVersion: number;
  added: BimCompareRow[];
  modified: BimCompareRow[];
  deleted: BimCompareRow[];
  counts: BimCompareCounts;
};

export type BimElementFieldDiff = {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
};

export type BimElementCompare = {
  guid: string;
  kind: BimCompareKind;
  name: string | null;
  ifcType: string | null;
  fields: BimElementFieldDiff[];
};

export type BimCompareRevision = {
  id: string;
  version: number;
  bimReady?: boolean;
  bimPublishedAt?: string | null;
};

export const COMPARE_COLORS = {
  added: BIM_PALETTE.status.success,
  modified: BIM_PALETTE.status.warning,
  deleted: BIM_PALETTE.status.danger,
} as const;

export const COMPARE_STYLE_IDS = {
  added: "compare:added",
  modified: "compare:modified",
  deleted: "compare:deleted",
} as const;

export const COMPARE_KIND_LABEL: Record<BimCompareKind, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Removed",
};

export type BimCompareVisibleKinds = Record<BimCompareKind, boolean>;

export const DEFAULT_COMPARE_VISIBLE_KINDS: BimCompareVisibleKinds = {
  added: true,
  modified: true,
  deleted: true,
};

export function isCompareStyleId(styleId: string): boolean {
  return styleId.startsWith("compare:");
}

/**
 * When resolving a GUID to a specific revision, skip fragment models we cannot
 * attribute. Matching `!entry` as a wildcard paints modified GUIDs onto the
 * overlay (previous version), which is then hidden — so only deletions show.
 */
export function fragmentModelMatchesFileVersion(
  wantFileVersionId: string | null | undefined,
  entryFileVersionId: string | null | undefined,
): boolean {
  const want = wantFileVersionId?.trim();
  if (!want) return true;
  const got = entryFileVersionId?.trim();
  if (!got) return false;
  return got === want;
}

/** Index hits without drawable geometry cannot be highlighted — keep scanning. */
export function guidIndexHitIsDrawable(
  drawable: Set<number> | null | undefined,
  localId: number,
): boolean {
  return Boolean(drawable?.has(localId));
}

export function compareChangedCount(counts: BimCompareCounts | null | undefined): number {
  if (!counts) return 0;
  return counts.added + counts.modified + counts.deleted;
}

export function pickDefaultBaseVersion(
  versions: BimCompareRevision[],
  currentId: string,
  preferredId?: string | null,
): string | null {
  if (preferredId && preferredId !== currentId && versions.some((v) => v.id === preferredId)) {
    return preferredId;
  }
  const current = versions.find((v) => v.id === currentId);
  const older = versions
    .filter((v) => v.id !== currentId)
    .filter((v) => v.bimReady !== false)
    .filter((v) => current == null || v.version < current.version)
    .sort((a, b) => {
      const published = Number(Boolean(b.bimPublishedAt)) - Number(Boolean(a.bimPublishedAt));
      if (published !== 0) return published;
      return b.version - a.version;
    });
  return older[0]?.id ?? null;
}

export function listCompareIfcTypes(changes: BimElementChanges | null): string[] {
  if (!changes) return [];
  const types = new Set<string>();
  for (const row of [...changes.added, ...changes.modified, ...changes.deleted]) {
    if (row.ifcType) types.add(row.ifcType);
  }
  return [...types].sort((a, b) => a.localeCompare(b));
}

export function filterCompareRows(
  changes: BimElementChanges | null,
  opts: {
    query: string;
    ifcType: string | null;
    visibleKinds: BimCompareVisibleKinds;
  },
): BimCompareRow[] {
  if (!changes) return [];
  const q = opts.query.trim().toLowerCase();
  const rows: BimCompareRow[] = [];
  if (opts.visibleKinds.added) rows.push(...changes.added);
  if (opts.visibleKinds.modified) rows.push(...changes.modified);
  if (opts.visibleKinds.deleted) rows.push(...changes.deleted);
  return rows.filter((row) => {
    if (opts.ifcType && row.ifcType !== opts.ifcType) return false;
    if (!q) return true;
    const name = (row.name ?? "").toLowerCase();
    const type = (row.ifcType ?? "").toLowerCase();
    const guid = row.guid.toLowerCase();
    return name.includes(q) || type.includes(q) || guid.includes(q);
  });
}

export function compareRowLabel(row: BimCompareRow): string {
  const name = row.name?.trim();
  if (name) return name;
  const type = row.ifcType?.replace(/^Ifc/i, "") ?? "Element";
  return type;
}

export function withGeometryFieldFallback(
  data: BimElementCompare | null,
  selectedGuid: string | null,
  selectedKind: BimCompareKind | null,
  modified: BimCompareRow[] | undefined,
): BimElementCompare | null {
  if (!selectedGuid || selectedKind !== "modified") return data;
  if (data && data.fields.length > 0) return data;
  const row = modified?.find((r) => r.guid === selectedGuid);
  if (!row) return data;
  return {
    guid: selectedGuid,
    kind: "modified",
    name: data?.name ?? row.name,
    ifcType: data?.ifcType ?? row.ifcType,
    fields: [COMPARE_GEOMETRY_FIELD],
  };
}

export type CompareGuidBox = {
  min: [number, number, number];
  max: [number, number, number];
};

export type CompareGeometrySets = {
  currentGuids: string[];
  baseGuids: string[];
  movedGuids: string[];
};

/** ~1cm in metres or millimetres. */
export function compareGeometryEpsilon(units: "m" | "mm"): number {
  return units === "mm" ? 10 : 0.01;
}

function guidBoxesDiffer(a: CompareGuidBox, b: CompareGuidBox, epsilon: number): boolean {
  for (let i = 0; i < 3; i++) {
    if (Math.abs(a.min[i]! - b.min[i]!) > epsilon) return true;
    if (Math.abs(a.max[i]! - b.max[i]!) > epsilon) return true;
  }
  return false;
}

export function geometryCompareSets(
  current: Map<string, CompareGuidBox>,
  base: Map<string, CompareGuidBox>,
  epsilon: number,
): CompareGeometrySets | null {
  if (current.size === 0 || base.size === 0) return null;
  const movedGuids: string[] = [];
  for (const [guid, box] of current) {
    const prior = base.get(guid);
    if (!prior) continue;
    if (guidBoxesDiffer(box, prior, epsilon)) movedGuids.push(guid);
  }
  return {
    currentGuids: [...current.keys()],
    baseGuids: [...base.keys()],
    movedGuids,
  };
}

function metaFromRows(
  rows: BimCompareRow[],
  extra?: Map<string, { name: string | null; ifcType: string | null }>,
): Map<string, { name: string | null; ifcType: string | null }> {
  const out = extra
    ? new Map(extra)
    : new Map<string, { name: string | null; ifcType: string | null }>();
  for (const row of rows) {
    if (!out.has(row.guid)) out.set(row.guid, { name: row.name, ifcType: row.ifcType });
  }
  return out;
}

function rowFor(
  guid: string,
  kind: BimCompareKind,
  meta: Map<string, { name: string | null; ifcType: string | null }>,
): BimCompareRow {
  const hit = meta.get(guid);
  return { guid, name: hit?.name ?? null, ifcType: hit?.ifcType ?? null, kind };
}

/**
 * Drawable GUID presence is the source of truth for added/removed in the 3D
 * scene. Metadata-only rows from the API are kept when they have no geometry.
 */
// fallow-ignore-next-line complexity
export function mergeCompareWithGeometry(
  api: BimElementChanges,
  geo: CompareGeometrySets | null,
  extraMeta?: Map<string, { name: string | null; ifcType: string | null }>,
): BimElementChanges {
  if (!geo) return api;
  const meta = metaFromRows([...api.added, ...api.modified, ...api.deleted], extraMeta);
  const current = new Set(geo.currentGuids);
  const base = new Set(geo.baseGuids);
  const moved = new Set(geo.movedGuids);
  const apiModified = new Set(api.modified.map((r) => r.guid));

  const added: BimCompareRow[] = [];
  const modified: BimCompareRow[] = [];
  const deleted: BimCompareRow[] = [];
  const addedIds = new Set<string>();
  const modifiedIds = new Set<string>();
  const deletedIds = new Set<string>();

  for (const guid of current) {
    if (!base.has(guid)) {
      added.push(rowFor(guid, "added", meta));
      addedIds.add(guid);
    } else if (moved.has(guid) || apiModified.has(guid)) {
      modified.push(rowFor(guid, "modified", meta));
      modifiedIds.add(guid);
    }
  }
  for (const guid of base) {
    if (current.has(guid)) continue;
    deleted.push(rowFor(guid, "deleted", meta));
    deletedIds.add(guid);
  }

  for (const row of api.added) {
    if (current.has(row.guid) || base.has(row.guid) || addedIds.has(row.guid)) continue;
    added.push(row);
    addedIds.add(row.guid);
  }
  for (const row of api.deleted) {
    if (current.has(row.guid) || base.has(row.guid) || deletedIds.has(row.guid)) continue;
    deleted.push(row);
    deletedIds.add(row.guid);
  }
  for (const row of api.modified) {
    if (addedIds.has(row.guid) || deletedIds.has(row.guid) || modifiedIds.has(row.guid)) continue;
    modified.push(row);
    modifiedIds.add(row.guid);
  }

  const unchanged = Math.max(0, current.size - added.length - modified.length);
  return {
    ...api,
    added,
    modified,
    deleted,
    counts: {
      added: added.length,
      modified: modified.length,
      deleted: deleted.length,
      unchanged,
      baseLive: base.size,
      currentLive: current.size,
    },
  };
}

const COMPARE_GEOMETRY_FIELD: BimElementFieldDiff = {
  key: "geometry",
  label: "Geometry",
  before: "Previous",
  after: "Current",
};
