/**
 * Coerce stored JSON into a list of template line items.
 * Handles Prisma Json arrays, double-encoded JSON strings, and `{ items: [...] }` shapes.
 */
export function normalizePunchTemplateItemsJson(raw) {
    let v = raw;
    if (typeof v === "string") {
        const s = v.trim();
        if (!s)
            return [];
        try {
            v = JSON.parse(s);
        }
        catch {
            return [];
        }
    }
    if (Array.isArray(v))
        return v;
    if (v &&
        typeof v === "object" &&
        "items" in v &&
        Array.isArray(v.items)) {
        return v.items;
    }
    return [];
}
