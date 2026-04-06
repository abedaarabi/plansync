import type { Prisma } from "@prisma/client";

export type TakeoffPricingPublic = {
  projectDiscountPct: string;
  itemDiscountPctByKey: Record<string, string>;
};

function clampPct(raw: string | number): string {
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n)) return "0";
  return String(Math.max(0, Math.min(100, n)));
}

export function cloneSettingsJson(raw: unknown): Record<string, unknown> {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function parseTakeoffPricingFromSettingsJson(settingsJson: unknown): TakeoffPricingPublic {
  if (settingsJson == null || typeof settingsJson !== "object" || Array.isArray(settingsJson)) {
    return { projectDiscountPct: "0", itemDiscountPctByKey: {} };
  }
  const root = settingsJson as Record<string, unknown>;
  const t = root.takeoffPricing;
  if (t == null || typeof t !== "object" || Array.isArray(t)) {
    return { projectDiscountPct: "0", itemDiscountPctByKey: {} };
  }
  const o = t as Record<string, unknown>;
  const projectDiscountPct =
    typeof o.projectDiscountPct === "string" || typeof o.projectDiscountPct === "number"
      ? clampPct(o.projectDiscountPct)
      : "0";
  const itemDiscountPctByKey: Record<string, string> = {};
  const items = o.itemDiscountPctByKey;
  if (items != null && typeof items === "object" && !Array.isArray(items)) {
    for (const [k, v] of Object.entries(items as Record<string, unknown>)) {
      if (!k) continue;
      if (typeof v === "string" || typeof v === "number") {
        itemDiscountPctByKey[k] = clampPct(v);
      }
    }
  }
  return { projectDiscountPct, itemDiscountPctByKey };
}

export type TakeoffPricingPatch = {
  projectDiscountPct?: string | number;
  itemDiscountPctByKey?: Record<string, string | number>;
};

export function mergeTakeoffPricingIntoSettingsJson(
  settingsJson: unknown,
  patch: TakeoffPricingPatch,
): Prisma.InputJsonValue {
  const cur = parseTakeoffPricingFromSettingsJson(settingsJson);
  const next: TakeoffPricingPublic = {
    projectDiscountPct:
      patch.projectDiscountPct !== undefined
        ? clampPct(patch.projectDiscountPct)
        : cur.projectDiscountPct,
    itemDiscountPctByKey:
      patch.itemDiscountPctByKey !== undefined
        ? Object.fromEntries(
            Object.entries(patch.itemDiscountPctByKey)
              .filter(([k]) => Boolean(k))
              .map(([k, v]) => [k, clampPct(v)]),
          )
        : { ...cur.itemDiscountPctByKey },
  };
  const raw = cloneSettingsJson(settingsJson);
  raw.takeoffPricing = {
    projectDiscountPct: next.projectDiscountPct,
    itemDiscountPctByKey: next.itemDiscountPctByKey,
  };
  return raw as Prisma.InputJsonValue;
}
