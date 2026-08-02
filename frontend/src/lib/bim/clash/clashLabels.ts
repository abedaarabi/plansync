import type { BimQuantityIndex } from "@plansync/shared/bimTypes";
import type { BimClashRow, ClashElementRef } from "@/lib/api-client/bim-clash";
import { clashTypeLabel, formatClashDistanceDetail } from "@/lib/bim/clash/clashStatusStyle";

/** Prefer IFC Name, then type, then short GUID — never show a blank pair label. */
export function clashElementLabel(
  side: { name?: string | null; ifcType?: string | null } | null | undefined,
  guid: string,
): string {
  const name = side?.name?.trim();
  if (name) return name;
  const type = side?.ifcType?.trim();
  if (type) return type.replace(/^Ifc/, "");
  return guid.slice(0, 8);
}

function shortIfcType(ifcType: string | null | undefined): string {
  if (!ifcType?.trim()) return "Element";
  return ifcType.replace(/^Ifc/, "");
}

/** Rich description body when promoting a clash to an Issue. */
export function clashIssueDescription(clash: BimClashRow): string {
  const a = clashElementLabel(clash.elementA, clash.guidA);
  const b = clashElementLabel(clash.elementB, clash.guidB);
  const typeA = shortIfcType(clash.elementA?.ifcType);
  const typeB = shortIfcType(clash.elementB?.ifcType);
  const lines = [
    `${clashTypeLabel(clash.clashType)} clash · ${formatClashDistanceDetail(clash.clashType, clash.distanceMm)}`,
    "",
    `Item 1 (green): ${a} · ${typeA}`,
    `Item 2 (red): ${b} · ${typeB}`,
    "",
    `Status: ${clash.status}`,
    `Contact points: ${clash.contactCount}`,
  ];
  return lines.join("\n");
}

function mergeRef(
  existing: ClashElementRef | null,
  guid: string,
  fromIndex: { name: string | null; ifcType: string | null } | undefined,
): ClashElementRef {
  const name = existing?.name?.trim() || fromIndex?.name?.trim() || null;
  const ifcType = existing?.ifcType?.trim() || fromIndex?.ifcType?.trim() || null;
  return {
    name,
    ifcType,
    ifcGuid: existing?.ifcGuid ?? guid,
  };
}

/**
 * Fill missing BimElement names/types from the loaded quantity index so older
 * clash runs (stub elements) still show element × element labels.
 */
export function enrichClashRowsWithQuantityNames(
  clashes: BimClashRow[],
  index: BimQuantityIndex | null | undefined,
): BimClashRow[] {
  if (!clashes.length || !index?.elements?.length) return clashes;

  const byFvGuid = new Map<string, { name: string | null; ifcType: string | null }>();
  const byGuid = new Map<string, { name: string | null; ifcType: string | null }>();
  for (const e of index.elements) {
    if (!e.guid) continue;
    const meta = { name: e.name, ifcType: e.ifcType };
    byGuid.set(e.guid, meta);
    if (e.sourceFileVersionId) {
      byFvGuid.set(`${e.sourceFileVersionId}|${e.guid}`, meta);
    }
  }

  let changed = false;
  const out = clashes.map((c) => {
    const qa = byFvGuid.get(`${c.fileVersionAId}|${c.guidA}`) ?? byGuid.get(c.guidA);
    const qb = byFvGuid.get(`${c.fileVersionBId}|${c.guidB}`) ?? byGuid.get(c.guidB);
    const elementA = mergeRef(c.elementA, c.guidA, qa);
    const elementB = mergeRef(c.elementB, c.guidB, qb);
    if (
      elementA.name === (c.elementA?.name ?? null) &&
      elementA.ifcType === (c.elementA?.ifcType ?? null) &&
      elementB.name === (c.elementB?.name ?? null) &&
      elementB.ifcType === (c.elementB?.ifcType ?? null)
    ) {
      return c;
    }
    changed = true;
    return { ...c, elementA, elementB };
  });
  return changed ? out : clashes;
}
