import type { BimVisibilityGroup } from "./bimEngine";

export type BimDiscipline = {
  id: string;
  label: string;
  categories: BimVisibilityGroup[];
};

const DISCIPLINE_RULES: { id: string; label: string; test: RegExp }[] = [
  {
    id: "structure",
    label: "Structure",
    test: /beam|column|footing|pile|member|plate|reinfor|struct|foundation/i,
  },
  {
    id: "electrical",
    label: "Electrical",
    test: /electric|cable|light|lamp|switch|outlet|panel|transform|conduit/i,
  },
  {
    id: "mechanical",
    label: "Mechanical",
    test: /duct|hvac|fan|chiller|boiler|mech|pipe|flow|pump|valve|air/i,
  },
  {
    id: "mep",
    label: "MEP",
    test: /distribution|terminal|sanitary|plumb|sprinkler|fire|drain|sewer/i,
  },
  {
    id: "architecture",
    label: "Architecture",
    test: /wall|door|window|slab|roof|stair|ramp|covering|furniture|space|room|curtain|railing/i,
  },
];

/** Groups IFC categories into BIM 360-style discipline folders. */
// fallow-ignore-next-line complexity
export function groupCategoriesByDiscipline(categories: BimVisibilityGroup[]): BimDiscipline[] {
  const buckets = new Map<string, BimDiscipline>();
  for (const rule of DISCIPLINE_RULES) {
    buckets.set(rule.id, { id: rule.id, label: rule.label, categories: [] });
  }
  const other: BimDiscipline = { id: "other", label: "Other", categories: [] };

  for (const cat of categories) {
    const rule = DISCIPLINE_RULES.find((r) => r.test.test(cat.name));
    if (rule) buckets.get(rule.id)!.categories.push(cat);
    else other.categories.push(cat);
  }

  const out = DISCIPLINE_RULES.map((r) => buckets.get(r.id)!).filter(
    (d) => d.categories.length > 0,
  );
  if (other.categories.length > 0) out.push(other);
  return out;
}

export function filterVisibilityGroups(
  groups: BimVisibilityGroup[],
  query: string,
): BimVisibilityGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter((g) => g.name.toLowerCase().includes(q));
}
