import { formatPlacement, placementsDiffer, type ElementPlacement } from "./elementPlacement.js";
import { hashElementMetadata } from "./metadataHash.js";
import type { BimQuantityEntry } from "./types.js";

export type BimElementChangeKind = "added" | "modified" | "deleted";

export type ElementVersionSnapshot = {
  ifcGuid: string;
  name: string | null;
  ifcType: string | null;
  metadataHash: string;
  live: boolean;
};

export type BimChangeRow = {
  guid: string;
  name: string | null;
  ifcType: string | null;
  kind: BimElementChangeKind;
};

export type ElementVersionDiff = {
  added: BimChangeRow[];
  modified: BimChangeRow[];
  deleted: BimChangeRow[];
  unchangedCount: number;
  baseLiveCount: number;
  currentLiveCount: number;
};

export type MetadataFieldDiff = {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
};

const SCALAR_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "ifcType", label: "Category" },
  { key: "typeName", label: "Type" },
  { key: "level", label: "Level" },
  { key: "material", label: "Material" },
  { key: "discipline", label: "Discipline" },
  { key: "surfaceColor", label: "Color" },
  { key: "quantitySource", label: "Quantity source" },
];

const QUANTITY_FIELDS: { key: string; label: string }[] = [
  { key: "count", label: "Count" },
  { key: "length", label: "Length" },
  { key: "area", label: "Area" },
  { key: "volume", label: "Volume" },
];

function toRow(kind: BimElementChangeKind, row: ElementVersionSnapshot): BimChangeRow {
  return { guid: row.ifcGuid, name: row.name, ifcType: row.ifcType, kind };
}

function toIndexRow(kind: BimElementChangeKind, row: BimQuantityEntry): BimChangeRow {
  return { guid: row.guid, name: row.name, ifcType: row.ifcType, kind };
}

function asPlacement(value: unknown): ElementPlacement | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as { x?: unknown; y?: unknown; z?: unknown };
  if (typeof rec.x !== "number" || typeof rec.y !== "number" || typeof rec.z !== "number") {
    return null;
  }
  return { x: rec.x, y: rec.y, z: rec.z };
}

/** Hash-diff live elements between two versions of the same file. */
export function diffElementVersions(
  current: ElementVersionSnapshot[],
  base: ElementVersionSnapshot[],
): ElementVersionDiff {
  const currentLive = new Map<string, ElementVersionSnapshot>();
  for (const row of current) {
    if (row.live) currentLive.set(row.ifcGuid, row);
  }
  const baseLive = new Map<string, ElementVersionSnapshot>();
  for (const row of base) {
    if (row.live) baseLive.set(row.ifcGuid, row);
  }

  const added: BimChangeRow[] = [];
  const modified: BimChangeRow[] = [];
  let unchangedCount = 0;
  for (const [guid, row] of currentLive) {
    const prior = baseLive.get(guid);
    if (!prior) added.push(toRow("added", row));
    else if (prior.metadataHash !== row.metadataHash) modified.push(toRow("modified", row));
    else unchangedCount += 1;
  }

  const deleted: BimChangeRow[] = [];
  for (const [guid, row] of baseLive) {
    if (!currentLive.has(guid)) deleted.push(toRow("deleted", row));
  }

  return {
    added,
    modified,
    deleted,
    unchangedCount,
    baseLiveCount: baseLive.size,
    currentLiveCount: currentLive.size,
  };
}

function liveByGuid(rows: BimQuantityEntry[]): Map<string, BimQuantityEntry> {
  const map = new Map<string, BimQuantityEntry>();
  for (const row of rows) {
    if (row.guid) map.set(row.guid, row);
  }
  return map;
}

function quantityIndexChanged(prior: BimQuantityEntry, row: BimQuantityEntry): boolean {
  return (
    hashElementMetadata(prior) !== hashElementMetadata(row) ||
    placementsDiffer(prior.placement, row.placement)
  );
}

/** GUID presence + metadata/placement diff from two quantity indexes. */
export function diffQuantityIndexElements(
  current: BimQuantityEntry[],
  base: BimQuantityEntry[],
): ElementVersionDiff {
  const currentLive = liveByGuid(current);
  const baseLive = liveByGuid(base);
  const added: BimChangeRow[] = [];
  const modified: BimChangeRow[] = [];
  let unchangedCount = 0;
  for (const [guid, row] of currentLive) {
    const prior = baseLive.get(guid);
    if (!prior) added.push(toIndexRow("added", row));
    else if (quantityIndexChanged(prior, row)) modified.push(toIndexRow("modified", row));
    else unchangedCount += 1;
  }

  const deleted: BimChangeRow[] = [];
  for (const [guid, row] of baseLive) {
    if (!currentLive.has(guid)) deleted.push(toIndexRow("deleted", row));
  }

  return {
    added,
    modified,
    deleted,
    unchangedCount,
    baseLiveCount: baseLive.size,
    currentLiveCount: currentLive.size,
  };
}

function rowMap(rows: BimChangeRow[]): Map<string, BimChangeRow> {
  return new Map(rows.map((row) => [row.guid, row]));
}

/**
 * Index presence wins for added/removed. Modified is the union, minus
 * GUIDs already classified as added or deleted.
 */
// fallow-ignore-next-line complexity
export function mergeElementDiffs(
  versions: ElementVersionDiff,
  index: ElementVersionDiff,
): ElementVersionDiff {
  const added = rowMap(index.added);
  const deleted = rowMap(index.deleted);
  const modified = rowMap(index.modified);

  for (const row of versions.deleted) {
    if (added.has(row.guid) || modified.has(row.guid)) continue;
    deleted.set(row.guid, row);
  }
  for (const row of versions.added) {
    if (deleted.has(row.guid) || modified.has(row.guid)) continue;
    added.set(row.guid, row);
  }
  for (const row of versions.modified) {
    if (added.has(row.guid) || deleted.has(row.guid)) continue;
    modified.set(row.guid, row);
  }

  const currentLiveCount = Math.max(versions.currentLiveCount, index.currentLiveCount);
  const baseLiveCount = Math.max(versions.baseLiveCount, index.baseLiveCount);
  const unchangedCount = Math.max(0, currentLiveCount - added.size - modified.size);

  return {
    added: [...added.values()],
    modified: [...modified.values()],
    deleted: [...deleted.values()],
    unchangedCount,
    baseLiveCount,
    currentLiveCount,
  };
}

function displayValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Field-level diff of two element metadata JSON payloads. */
export function diffElementMetadata(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): MetadataFieldDiff[] {
  const left = before ?? {};
  const right = after ?? {};
  const out: MetadataFieldDiff[] = [];
  for (const field of SCALAR_FIELDS) {
    const prev = displayValue(left[field.key]);
    const next = displayValue(right[field.key]);
    if (prev === next) continue;
    out.push({ key: field.key, label: field.label, before: prev, after: next });
  }
  const qtyBefore = asRecord(left.quantities);
  const qtyAfter = asRecord(right.quantities);
  for (const field of QUANTITY_FIELDS) {
    const prev = displayValue(qtyBefore[field.key]);
    const next = displayValue(qtyAfter[field.key]);
    if (prev === next) continue;
    out.push({
      key: `quantities.${field.key}`,
      label: field.label,
      before: prev,
      after: next,
    });
  }
  const locBefore = formatPlacement(asPlacement(left.placement));
  const locAfter = formatPlacement(asPlacement(right.placement));
  if (locBefore !== locAfter && (locBefore != null || locAfter != null)) {
    out.push({ key: "placement", label: "Location", before: locBefore, after: locAfter });
  }
  return out;
}
