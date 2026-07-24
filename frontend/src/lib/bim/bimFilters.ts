import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";
import { buildColorizeLegend, type ColorizeLegendEntry } from "@/lib/bim/colorizePalette";
import { filterBimElements } from "@/lib/bim/elementSearch";

// fallow-ignore-next-line complexity
function filterBimElementsForSearch(
  index: BimQuantityIndex | null,
  query: string,
  limit = 200,
): BimQuantityEntry[] {
  const q = query.trim().toLowerCase();
  if (!index || !q) return [];

  const byGuid = new Map(index.elements.map((e) => [e.guid, e]));
  const seen = new Set<string>();
  const out: BimQuantityEntry[] = [];

  const pushGuid = (guid: string) => {
    if (seen.has(guid)) return;
    const el = byGuid.get(guid);
    if (!el) return;
    seen.add(guid);
    out.push(el);
  };

  // Match IFC categories first (e.g. "door" → IfcDoor, "duct" → IfcDuctSegment).
  for (const t of Object.values(index.byType)) {
    const label = t.ifcType.replace(/^Ifc/i, "").toLowerCase();
    if (!t.ifcType.toLowerCase().includes(q) && !label.includes(q)) continue;
    for (const guid of t.guids) {
      pushGuid(guid);
      if (out.length >= limit) return out;
    }
  }

  for (const el of filterBimElements(index, query, limit)) {
    pushGuid(el.guid);
    if (out.length >= limit) return out;
  }

  return out;
}

export type BimFilterField =
  | "level"
  | "ifcType"
  | "material"
  | "discipline"
  | "name"
  | "model"
  | "any";

export type BimFilterOp = "eq" | "contains" | "exists";

export type BimFilterRule = {
  id: string;
  field: BimFilterField;
  op: BimFilterOp;
  value: string;
  /** Display label for UI chips (e.g. "Category", "FireRating"). */
  label?: string;
};

export type BimFilterVisualize = "isolate" | "ghost" | "none";

export type BimColorizeConfig = {
  enabled: boolean;
  field: BimFilterField;
  label?: string;
};

export type BimFilterState = {
  rules: BimFilterRule[];
  textQuery: string;
  visualize: BimFilterVisualize;
  colorize: BimColorizeConfig | null;
};

export const EMPTY_BIM_FILTER_STATE: BimFilterState = {
  rules: [],
  textQuery: "",
  visualize: "ghost",
  colorize: null,
};

export type BimFilterFieldOption = {
  field: BimFilterField;
  label: string;
  quickAccess?: boolean;
};

export const BIM_FILTER_FIELD_OPTIONS: BimFilterFieldOption[] = [
  { field: "model", label: "Model / file", quickAccess: true },
  { field: "ifcType", label: "Category", quickAccess: true },
  { field: "level", label: "Level", quickAccess: true },
  { field: "material", label: "Material" },
  { field: "discipline", label: "Discipline" },
  { field: "name", label: "Name" },
];

export function createFilterRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIfcType(value: string): string {
  const trimmed = value.trim();
  if (/^ifc/i.test(trimmed)) return trimmed;
  return trimmed.startsWith("Ifc") ? trimmed : `Ifc${trimmed}`;
}

// fallow-ignore-next-line complexity
function fieldValue(el: BimQuantityEntry, field: BimFilterField): string | null {
  switch (field) {
    case "level":
      return el.level;
    case "ifcType":
      return el.ifcType;
    case "material":
      return el.material;
    case "discipline":
      return el.discipline;
    case "name":
      return el.name;
    case "model":
      return el.sourceLabel ?? el.sourceFileVersionId ?? null;
    default:
      return null;
  }
}

// fallow-ignore-next-line complexity
function compareField(raw: string | null, op: BimFilterOp, expected: string): boolean {
  if (op === "exists") return raw != null && raw.trim() !== "";
  if (raw == null) return false;
  const left = raw.trim().toLowerCase();
  const right = expected.trim().toLowerCase();
  if (op === "eq") return left === right;
  return left.includes(right);
}

function matchesAnyField(el: BimQuantityEntry, op: BimFilterOp, expected: string): boolean {
  const parts = [
    el.name,
    el.ifcType,
    el.level,
    el.material,
    el.discipline,
    el.sourceLabel,
    el.guid,
  ].filter(Boolean) as string[];
  if (op === "exists") return parts.some((p) => p.trim() !== "");
  const right = expected.trim().toLowerCase();
  return parts.some((p) => {
    const left = p.toLowerCase();
    return op === "eq" ? left === right : left.includes(right);
  });
}

// fallow-ignore-next-line complexity
function matchesRule(el: BimQuantityEntry, rule: BimFilterRule): boolean {
  if (rule.field === "any") return matchesAnyField(el, rule.op, rule.value);
  let raw = fieldValue(el, rule.field);
  if (rule.field === "ifcType" && raw && rule.op === "eq") {
    const normalized = normalizeIfcType(rule.value);
    return compareField(raw, "eq", normalized) || compareField(raw, "eq", rule.value);
  }
  return compareField(raw, rule.op, rule.value);
}

// fallow-ignore-next-line complexity
export function matchFilteredElements(
  index: BimQuantityIndex | null,
  state: BimFilterState,
): BimQuantityEntry[] {
  if (!index) return [];
  const text = state.textQuery.trim();
  let pool: BimQuantityEntry[] = index.elements;

  if (text) {
    const textHits = new Set(
      filterBimElementsForSearch(index, text, index.elements.length).map((e) => e.guid),
    );
    pool = pool.filter((e) => textHits.has(e.guid));
  }

  if (state.rules.length === 0) {
    return text ? pool : [];
  }

  return pool.filter((el) => state.rules.every((rule) => matchesRule(el, rule)));
}

// fallow-ignore-next-line complexity
function colorizeValueForElement(el: BimQuantityEntry, config: BimColorizeConfig): string {
  if (config.field === "any") {
    return el.name ?? el.ifcType ?? "(empty)";
  }
  const raw = fieldValue(el, config.field);
  return raw?.trim() || "(empty)";
}

export function buildColorizeFromElements(
  elements: BimQuantityEntry[],
  config: BimColorizeConfig,
): ColorizeLegendEntry[] {
  const entries = elements.map((el) => ({
    guid: el.guid,
    value: colorizeValueForElement(el, config),
  }));
  return buildColorizeLegend(entries);
}

// fallow-ignore-next-line complexity
export function ruleLabel(rule: BimFilterRule): string {
  const fieldLabel =
    rule.label ?? BIM_FILTER_FIELD_OPTIONS.find((o) => o.field === rule.field)?.label ?? rule.field;
  if (rule.op === "exists") return `${fieldLabel} exists`;
  if (rule.op === "contains") return `${fieldLabel} contains "${rule.value}"`;
  return `${fieldLabel} = ${rule.value}`;
}

export function hasActiveFilter(state: BimFilterState): boolean {
  return state.textQuery.trim() !== "" || state.rules.length > 0;
}

/** Map a property-panel row to a filter rule (Dalux click-to-filter). */
// fallow-ignore-next-line complexity
export function ruleFromPropertyRow(
  group: string,
  property: string,
  value: string,
): BimFilterRule | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const base = {
    id: createFilterRuleId(),
    op: "eq" as const,
    value: trimmed,
  };

  if (group === "General") {
    if (property === "Category") {
      return { ...base, field: "ifcType", label: "Category", value: normalizeIfcType(trimmed) };
    }
    if (property === "Level") return { ...base, field: "level", label: "Level" };
    if (property === "Name") return { ...base, field: "name", label: "Name" };
    if (property === "Model") return { ...base, field: "model", label: "Model" };
  }

  if (group === "Appearance" && property === "Material") {
    return { ...base, field: "material", label: "Material" };
  }

  return {
    ...base,
    field: "any",
    label: `${group} · ${property}`,
  };
}

// fallow-ignore-next-line complexity
export function parseFilterState(raw: unknown): BimFilterState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rules = Array.isArray(o.rules) ? o.rules : [];
  const parsedRules: BimFilterRule[] = [];
  for (const r of rules) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const field = rec.field;
    const op = rec.op;
    const value = rec.value;
    if (typeof field !== "string" || typeof op !== "string") continue;
    if (!["level", "ifcType", "material", "discipline", "name", "model", "any"].includes(field)) {
      continue;
    }
    if (!["eq", "contains", "exists"].includes(op)) continue;
    parsedRules.push({
      id: typeof rec.id === "string" ? rec.id : createFilterRuleId(),
      field: field as BimFilterField,
      op: op as BimFilterOp,
      value: typeof value === "string" ? value : "",
      label: typeof rec.label === "string" ? rec.label : undefined,
    });
  }

  const visualize =
    o.visualize === "isolate" || o.visualize === "ghost" || o.visualize === "none"
      ? o.visualize
      : o.visualize === "hide_others"
        ? "ghost"
        : "ghost";

  let colorize: BimColorizeConfig | null = null;
  if (o.colorize && typeof o.colorize === "object") {
    const c = o.colorize as Record<string, unknown>;
    if (c.enabled === true && typeof c.field === "string") {
      if (
        ["level", "ifcType", "material", "discipline", "name", "model", "any"].includes(c.field)
      ) {
        colorize = {
          enabled: true,
          field: c.field as BimFilterField,
          label: typeof c.label === "string" ? c.label : undefined,
        };
      }
    }
  }

  return {
    rules: parsedRules,
    textQuery: typeof o.textQuery === "string" ? o.textQuery : "",
    visualize,
    colorize,
  };
}

export function filterStateHasColorize(state: BimFilterState | null | undefined): boolean {
  return Boolean(state?.colorize?.enabled);
}

export type FilterFieldValueOption = {
  value: string;
  label: string;
  count?: number;
};

function formatIfcTypeLabel(ifcType: string): string {
  return ifcType.replace(/^Ifc/i, "");
}

/** All distinct values for a filter field — uses byType/byLevel aggregates when available. */
// fallow-ignore-next-line complexity
export function listFilterFieldValues(
  index: BimQuantityIndex | null,
  field: BimFilterField,
  query = "",
): FilterFieldValueOption[] {
  if (!index) return [];
  const q = query.trim().toLowerCase();

  if (field === "ifcType") {
    return Object.values(index.byType)
      .filter((t) => {
        const label = formatIfcTypeLabel(t.ifcType).toLowerCase();
        return !q || t.ifcType.toLowerCase().includes(q) || label.includes(q);
      })
      .sort((a, b) => b.count - a.count || a.ifcType.localeCompare(b.ifcType))
      .map((t) => ({
        value: t.ifcType,
        label: formatIfcTypeLabel(t.ifcType),
        count: t.count,
      }));
  }

  if (field === "level") {
    return Object.values(index.byLevel)
      .filter((l) => !q || l.level.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count || a.level.localeCompare(b.level))
      .map((l) => ({ value: l.level, label: l.level, count: l.count }));
  }

  const counts = new Map<string, number>();
  for (const el of index.elements) {
    let v: string | null = null;
    switch (field) {
      case "material":
        v = el.material;
        break;
      case "discipline":
        v = el.discipline;
        break;
      case "name":
        v = el.name;
        break;
      case "model":
        v = el.sourceLabel ?? el.sourceFileVersionId ?? null;
        break;
      default:
        break;
    }
    if (!v?.trim()) continue;
    const key = v.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([value]) => !q || value.toLowerCase().includes(q))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }));
}
