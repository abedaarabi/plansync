import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";

// fallow-ignore-next-line complexity
export function filterBimElements(
  index: BimQuantityIndex | null,
  query: string,
  limit = 50,
): BimQuantityEntry[] {
  const q = query.trim().toLowerCase();
  if (!index || !q) return [];
  const matches: BimQuantityEntry[] = [];
  for (const el of index.elements) {
    if (
      el.guid.toLowerCase().includes(q) ||
      (el.name?.toLowerCase().includes(q) ?? false) ||
      el.ifcType.toLowerCase().includes(q) ||
      (el.level?.toLowerCase().includes(q) ?? false) ||
      (el.sourceLabel?.toLowerCase().includes(q) ?? false)
    ) {
      matches.push(el);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
