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
  return out;
}
