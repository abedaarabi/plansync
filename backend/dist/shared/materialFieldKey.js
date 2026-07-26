const KEY_RE = /^[a-z][a-z0-9_]{0,62}$/;
function randomKeySuffix(length) {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, length);
}
/** Slug for a custom material template field label. */
export function slugifyMaterialFieldKey(label) {
    const s = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_")
        .slice(0, 63);
    if (KEY_RE.test(s))
        return s;
    const fallback = `field_${randomKeySuffix(10)}`;
    return KEY_RE.test(fallback) ? fallback : `f_${randomKeySuffix(8)}`;
}
