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
