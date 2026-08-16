import { createHash } from "node:crypto";
const FLOAT_PRECISION = 6;
/** Keys excluded from metadata hash (volatile export noise). */
const HASH_EXCLUDE_KEYS = new Set([
    "generatedAt",
    "fileVersionId",
    "sourceFileVersionId",
    "sourceModelId",
    "sourceLabel",
]);
function roundFloat(n) {
    const f = 10 ** FLOAT_PRECISION;
    return Math.round(n * f) / f;
}
function normalizeValue(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "number")
        return roundFloat(value);
    if (typeof value === "string")
        return value.trim();
    if (Array.isArray(value))
        return value.map(normalizeValue);
    if (typeof value === "object")
        return sortKeys(value);
    return value;
}
function sortKeys(obj) {
    const out = {};
    for (const key of Object.keys(obj).sort()) {
        if (HASH_EXCLUDE_KEYS.has(key))
            continue;
        out[key] = normalizeValue(obj[key]);
    }
    return out;
}
/** Canonical metadata payload for hashing (stable across re-exports). */
export function canonicalElementMetadata(entry) {
    return sortKeys({
        guid: entry.guid,
        ifcType: entry.ifcType,
        name: entry.name,
        level: entry.level,
        material: entry.material,
        discipline: entry.discipline,
        surfaceColor: entry.surfaceColor ?? null,
        quantities: entry.quantities,
        quantitySource: entry.quantitySource,
        lodFlags: entry.lodFlags,
    });
}
export function hashElementMetadata(entry) {
    const canonical = JSON.stringify(canonicalElementMetadata(entry));
    return createHash("sha256").update(canonical, "utf8").digest("hex");
}
export function hashBufferSha256(buf) {
    return createHash("sha256").update(buf).digest("hex");
}
