import type { BimElementQuantities } from "@/lib/bim/types";

export type BimModelQuantityRollup = {
  count: number;
  length: number | null;
  area: number | null;
  volume: number | null;
};

type QuantityKind = "count" | "length" | "area" | "volume";

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "").replace(/²/g, "2").replace(/³/g, "3");
}

// fallow-ignore-next-line complexity
function unitKind(unit: string): QuantityKind | "other" {
  const u = normalizeUnit(unit);
  if (["ea", "each", "nr", "no", "unit", "pcs", "pc"].includes(u)) return "count";
  if (["m3", "m^3", "cum", "ft3", "cuft", "cf", "mm3"].includes(u)) return "volume";
  if (["m2", "m^2", "sqm", "ft2", "sqft", "mm2"].includes(u)) return "area";
  if (["m", "mm", "ft", "lf", "lm", "linm", "meter", "metre", "meters", "metres"].includes(u)) {
    return "length";
  }
  return "other";
}

// fallow-ignore-next-line complexity
function valueForKind(rollup: BimModelQuantityRollup, kind: QuantityKind): number | null {
  switch (kind) {
    case "count":
      return rollup.count > 0 ? rollup.count : null;
    case "length":
      return rollup.length;
    case "area":
      return rollup.area;
    case "volume":
      return rollup.volume;
  }
}

// fallow-ignore-next-line complexity
export function rollupBimQuantities(
  quantities: BimElementQuantities[],
  elementCount: number,
): BimModelQuantityRollup {
  let length = 0;
  let area = 0;
  let volume = 0;
  let hasLength = false;
  let hasArea = false;
  let hasVolume = false;

  for (const q of quantities) {
    if (q.length != null && Number.isFinite(q.length)) {
      length += q.length;
      hasLength = true;
    }
    if (q.area != null && Number.isFinite(q.area)) {
      area += q.area;
      hasArea = true;
    }
    if (q.volume != null && Number.isFinite(q.volume)) {
      volume += q.volume;
      hasVolume = true;
    }
  }

  return {
    count: Math.max(elementCount, quantities.length),
    length: hasLength ? length : null,
    area: hasArea ? area : null,
    volume: hasVolume ? volume : null,
  };
}

/** Pick the best model quantity for a catalog unit (editable default in the takeoff dialog). */
// fallow-ignore-next-line complexity
function pickModelQuantity(rollup: BimModelQuantityRollup, materialUnit?: string): number {
  const preferred = materialUnit ? unitKind(materialUnit) : "count";
  if (preferred !== "other") {
    const v = valueForKind(rollup, preferred);
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }

  for (const kind of ["volume", "area", "length", "count"] as const) {
    const v = valueForKind(rollup, kind);
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }

  return Math.max(rollup.count, 1);
}

const DEFAULT_UNIT_BY_KIND: Record<QuantityKind, string> = {
  count: "ea",
  length: "m",
  area: "m²",
  volume: "m³",
};

/** Default quantity + unit from model rollup; material unit steers which model metric is used. */
// fallow-ignore-next-line complexity
export function pickModelQuantityAndUnit(
  rollup: BimModelQuantityRollup,
  materialUnit?: string,
): { quantity: number; unit: string } {
  if (materialUnit?.trim()) {
    const unit = materialUnit.trim();
    return { quantity: pickModelQuantity(rollup, unit), unit };
  }

  for (const kind of ["volume", "area", "length", "count"] as const) {
    const v = valueForKind(rollup, kind);
    if (v != null && Number.isFinite(v) && v > 0) {
      return { quantity: v, unit: DEFAULT_UNIT_BY_KIND[kind] };
    }
  }

  return { quantity: Math.max(rollup.count, 1), unit: "ea" };
}

export function formatModelQuantity(value: number): string {
  if (!Number.isFinite(value)) return "1";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
}

// fallow-ignore-next-line complexity
export function modelQuantityHint(rollup: BimModelQuantityRollup): string | null {
  const parts: string[] = [];
  if (rollup.count > 0) parts.push(`${rollup.count} ea`);
  if (rollup.length != null) parts.push(`${formatModelQuantity(rollup.length)} m`);
  if (rollup.area != null) parts.push(`${formatModelQuantity(rollup.area)} m²`);
  if (rollup.volume != null) parts.push(`${formatModelQuantity(rollup.volume)} m³`);
  return parts.length ? parts.join(" · ") : null;
}

function parseQuantityFromString(raw: string | null | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

// fallow-ignore-next-line complexity
export function parseQuantitiesFromPropertyRows(
  rows: { label: string; value: string }[],
): BimElementQuantities {
  const out: BimElementQuantities = {};
  for (const row of rows) {
    const label = row.label.trim();
    const lower = label.toLowerCase();
    const n = parseQuantityFromString(row.value);
    if (n == null) continue;

    if (label === "LengthValue" || lower === "lengthvalue") out.length = n;
    else if (label === "AreaValue" || lower === "areavalue") out.area = n;
    else if (label === "VolumeValue" || lower === "volumevalue") out.volume = n;
    else if (label === "CountValue" || lower === "countvalue") out.count = n;
    else if (out.area == null && /\b(area|grossarea|netarea|surfacearea)\b/i.test(lower))
      out.area = n;
    else if (out.volume == null && /\b(volume|grossvolume|netvolume)\b/i.test(lower))
      out.volume = n;
    else if (out.length == null && /\b(length|perimeter|width|height)\b/i.test(lower))
      out.length = n;
  }
  return out;
}

// fallow-ignore-next-line complexity
export function mergeElementQuantities(...parts: BimElementQuantities[]): BimElementQuantities {
  const out: BimElementQuantities = {};
  for (const p of parts) {
    if (p.length != null && out.length == null) out.length = p.length;
    if (p.area != null && out.area == null) out.area = p.area;
    if (p.volume != null && out.volume == null) out.volume = p.volume;
    if (p.count != null && out.count == null) out.count = p.count;
    if (p.weight != null && out.weight == null) out.weight = p.weight;
  }
  return out;
}
