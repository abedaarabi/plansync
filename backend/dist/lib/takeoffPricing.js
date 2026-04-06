function clampPct(raw) {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(n))
        return "0";
    return String(Math.max(0, Math.min(100, n)));
}
export function cloneSettingsJson(raw) {
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        return { ...raw };
    }
    return {};
}
export function parseTakeoffPricingFromSettingsJson(settingsJson) {
    if (settingsJson == null || typeof settingsJson !== "object" || Array.isArray(settingsJson)) {
        return { projectDiscountPct: "0", itemDiscountPctByKey: {} };
    }
    const root = settingsJson;
    const t = root.takeoffPricing;
    if (t == null || typeof t !== "object" || Array.isArray(t)) {
        return { projectDiscountPct: "0", itemDiscountPctByKey: {} };
    }
    const o = t;
    const projectDiscountPct = typeof o.projectDiscountPct === "string" || typeof o.projectDiscountPct === "number"
        ? clampPct(o.projectDiscountPct)
        : "0";
    const itemDiscountPctByKey = {};
    const items = o.itemDiscountPctByKey;
    if (items != null && typeof items === "object" && !Array.isArray(items)) {
        for (const [k, v] of Object.entries(items)) {
            if (!k)
                continue;
            if (typeof v === "string" || typeof v === "number") {
                itemDiscountPctByKey[k] = clampPct(v);
            }
        }
    }
    return { projectDiscountPct, itemDiscountPctByKey };
}
export function mergeTakeoffPricingIntoSettingsJson(settingsJson, patch) {
    const cur = parseTakeoffPricingFromSettingsJson(settingsJson);
    const next = {
        projectDiscountPct: patch.projectDiscountPct !== undefined
            ? clampPct(patch.projectDiscountPct)
            : cur.projectDiscountPct,
        itemDiscountPctByKey: patch.itemDiscountPctByKey !== undefined
            ? Object.fromEntries(Object.entries(patch.itemDiscountPctByKey)
                .filter(([k]) => Boolean(k))
                .map(([k, v]) => [k, clampPct(v)]))
            : { ...cur.itemDiscountPctByKey },
    };
    const raw = cloneSettingsJson(settingsJson);
    raw.takeoffPricing = {
        projectDiscountPct: next.projectDiscountPct,
        itemDiscountPctByKey: next.itemDiscountPctByKey,
    };
    return raw;
}
