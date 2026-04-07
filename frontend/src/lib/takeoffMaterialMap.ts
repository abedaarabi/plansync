import type { MaterialRow } from "@/lib/api-client";
import type { TakeoffMeasurementType, TakeoffUnit } from "@/lib/takeoffTypes";

/** Map catalog unit strings onto takeoff display units for the current measure kind. */
export function normalizeMaterialUnitToTakeoff(
  materialUnit: string,
  kind: TakeoffMeasurementType,
  allowed: TakeoffUnit[],
): TakeoffUnit {
  const u = materialUnit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("²", "2")
    .replace("³", "3");

  if (kind === "count") {
    if (allowed.includes("ea")) return "ea";
    return allowed[0];
  }

  const map: Record<string, TakeoffUnit> = {
    ea: "ea",
    each: "ea",
    nr: "ea",
    no: "ea",
    unit: "ea",
    m: "m",
    meter: "m",
    metres: "m",
    lm: "m",
    linm: "m",
    mm: "mm",
    ft: "ft",
    lf: "ft",
    kg: "kg",
    m2: "m²",
    sqm: "m²",
    "m^2": "m²",
    m3: "m³",
    cum: "m³",
    "m^3": "m³",
    mm3: "mm³",
    ft3: "ft³",
    cuft: "ft³",
    cf: "ft³",
    mm2: "mm²",
    ft2: "ft²",
    sqft: "ft²",
  };

  const resolved = map[u];
  if (resolved && allowed.includes(resolved)) return resolved;

  for (const a of allowed) {
    const al = a.toLowerCase().replace("²", "2");
    if (u === al) return a;
  }

  return allowed[0];
}

export function materialUnitPriceAsNumber(m: MaterialRow): number | undefined {
  if (m.unitPrice == null || m.unitPrice === "") return undefined;
  const n = Number(m.unitPrice);
  return Number.isFinite(n) ? n : undefined;
}
