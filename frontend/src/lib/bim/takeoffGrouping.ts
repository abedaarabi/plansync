import type { BimQuantityEntry } from "@/lib/bim/types";

export type BimCostGroupSource = "typeName" | "categoryName";

export type BimCostGroup = {
  key: string;
  label: string;
  source: BimCostGroupSource;
  guids: string[];
  count: number;
};

function formatCategoryLabel(ifcType: string): string {
  return ifcType.replace(/^Ifc/i, "") || ifcType;
}

/**
 * Recommended cost/takeoff key: Type name when present; otherwise Category + Name.
 */
export function costGroupKeyForEntry(entry: BimQuantityEntry): {
  key: string;
  label: string;
  source: BimCostGroupSource;
} {
  const typeName = entry.typeName?.trim();
  if (typeName) {
    return { key: `type:${typeName}`, label: typeName, source: "typeName" };
  }
  const category = formatCategoryLabel(entry.ifcType);
  const name = entry.name?.trim();
  const label = name ? `${category} · ${name}` : category || "Unnamed";
  return { key: `fallback:${entry.ifcType}|${name ?? ""}`, label, source: "categoryName" };
}

/** Group elements for takeoff / unit-rate costing. Prefers Type name. */
export function groupEntriesForCost(entries: BimQuantityEntry[]): BimCostGroup[] {
  const map = new Map<string, BimCostGroup>();
  for (const entry of entries) {
    const { key, label, source } = costGroupKeyForEntry(entry);
    let group = map.get(key);
    if (!group) {
      group = { key, label, source, guids: [], count: 0 };
      map.set(key, group);
    }
    group.guids.push(entry.guid);
    group.count += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function recommendedCostGroupingHint(groups: BimCostGroup[]): string {
  if (groups.length === 0) return "";
  const typed = groups.filter((g) => g.source === "typeName").length;
  if (typed === groups.length) {
    return groups.length === 1
      ? "Grouped by Type name (recommended for pricing)"
      : `${groups.length} cost groups by Type name (recommended)`;
  }
  if (typed === 0) {
    return "Type name missing — grouped by Category + Name until the index is rebuilt";
  }
  return `${typed} of ${groups.length} groups use Type name; others fall back to Category + Name`;
}
