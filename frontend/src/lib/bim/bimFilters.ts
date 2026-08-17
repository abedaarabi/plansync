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
  | "typeName"
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
  { field: "ifcType", label: "Category", quickAccess: true },
  { field: "typeName", label: "Type name", quickAccess: true },
  { field: "name", label: "Name", quickAccess: true },
  { field: "level", label: "Level", quickAccess: true },
  { field: "material", label: "Material" },
  { field: "discipline", label: "Discipline", quickAccess: true },
  { field: "model", label: "Model / file", quickAccess: true },
];

const FILTER_FIELD_KEYS: readonly BimFilterField[] = [
  "level",
  "ifcType",
  "typeName",
  "material",
  "discipline",
  "name",
  "model",
  "any",
];

export function createFilterRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIfcType(value: string): string {
  const trimmed = value.trim();
  if (/^ifc/i.test(trimmed)) return trimmed;
  return trimmed.startsWith("Ifc") ? trimmed : `Ifc${trimmed}`;
}

/**
 * IFC entities the viewer never draws: voids cut into hosts and assemblies that
 * only aggregate parts. Revit exports give openings the host wall's Name, so
 * counting them promised e.g. 24 matches when one wall was the only geometry.
 */
const NON_RENDERABLE_IFC_TYPES = new Set([
  "ifcopeningelement",
  "ifcopeningstandardcase",
  "ifcvoidingfeature",
  "ifcvirtualelement",
  "ifcelementassembly",
]);

function isRenderableEntry(el: BimQuantityEntry): boolean {
  return !NON_RENDERABLE_IFC_TYPES.has(el.ifcType.trim().toLowerCase());
}

// fallow-ignore-next-line complexity
function fieldValue(el: BimQuantityEntry, field: BimFilterField): string | null {
  switch (field) {
    case "level":
      return el.level;
    case "ifcType":
      return el.ifcType;
    case "typeName":
      return el.typeName ?? null;
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
    el.typeName,
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
  const raw = fieldValue(el, rule.field);
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
  let pool: BimQuantityEntry[] = index.elements.filter(isRenderableEntry);

  if (text) {
    const textHits = new Set(
      filterBimElementsForSearch(index, text, index.elements.length).map((e) => e.guid),
    );
    pool = pool.filter((e) => textHits.has(e.guid));
  }

  if (state.rules.length === 0) {
    return text ? pool : [];
  }

  // AND across fields, OR within the same field (multi-select Type / Level / …).
  const byField = new Map<BimFilterField, BimFilterRule[]>();
  for (const rule of state.rules) {
    const list = byField.get(rule.field);
    if (list) list.push(rule);
    else byField.set(rule.field, [rule]);
  }

  return pool.filter((el) => {
    for (const group of byField.values()) {
      if (!group.some((rule) => matchesRule(el, rule))) return false;
    }
    return true;
  });
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
    if (property === "Type name") return { ...base, field: "typeName", label: "Type name" };
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
    if (!(FILTER_FIELD_KEYS as readonly string[]).includes(field)) {
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
      if ((FILTER_FIELD_KEYS as readonly string[]).includes(c.field)) {
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

/**
 * All distinct values for a filter field, counted over elements the viewer can
 * actually draw. byType/byLevel/byTypeName aggregates are deliberately not used:
 * they include openings and assemblies, so their counts never matched what a
 * click could highlight.
 */
export function listFilterFieldValues(
  index: BimQuantityIndex | null,
  field: BimFilterField,
  query = "",
): FilterFieldValueOption[] {
  if (!index) return [];
  const q = query.trim().toLowerCase();
  const labelFor = (value: string) => (field === "ifcType" ? formatIfcTypeLabel(value) : value);

  const counts = new Map<string, number>();
  for (const el of index.elements) {
    if (!isRenderableEntry(el)) continue;
    const v = fieldValue(el, field);
    if (!v?.trim()) continue;
    const key = v.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(
      ([value]) =>
        !q || value.toLowerCase().includes(q) || labelFor(value).toLowerCase().includes(q),
    )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: labelFor(value), count }));
}
