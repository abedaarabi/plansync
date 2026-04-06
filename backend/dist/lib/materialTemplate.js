import { randomUUID } from "node:crypto";
import { z } from "zod";
export const MATERIAL_TEMPLATE_VERSION = 1;
export const MAX_CUSTOM_MATERIAL_FIELDS = 20;
const KEY_RE = /^[a-z][a-z0-9_]{0,62}$/;
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
    const fallback = `field_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    return KEY_RE.test(fallback) ? fallback : `f_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
/** Lenient parse for stored JSON (GET responses, after migrations). */
export function parseMaterialTemplateJson(raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return { version: MATERIAL_TEMPLATE_VERSION, fields: [] };
    }
    const o = raw;
    const version = typeof o.version === "number" && Number.isFinite(o.version)
        ? Math.floor(o.version)
        : MATERIAL_TEMPLATE_VERSION;
    const fieldsIn = Array.isArray(o.fields) ? o.fields : [];
    const fields = [];
    for (const item of fieldsIn) {
        if (!item || typeof item !== "object" || Array.isArray(item))
            continue;
        const f = item;
        const id = typeof f.id === "string" && f.id.trim() ? f.id.trim() : randomUUID();
        let key = typeof f.key === "string" ? f.key.trim().toLowerCase() : "";
        if (!KEY_RE.test(key)) {
            key = slugifyMaterialFieldKey(typeof f.label === "string" ? f.label : key || "field");
        }
        const label = typeof f.label === "string" ? f.label.trim() : "";
        if (!label || label.length > 120)
            continue;
        const tr = f.type;
        const type = tr === "number" || tr === "currency" ? tr : "text";
        const required = Boolean(f.required);
        const order = typeof f.order === "number" && Number.isFinite(f.order) ? Math.floor(f.order) : fields.length;
        fields.push({ id, key, label, type, required, order });
    }
    fields.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return { version, fields: fields.slice(0, MAX_CUSTOM_MATERIAL_FIELDS) };
}
const fieldPatchSchema = z.object({
    id: z.string().min(1).max(80).optional(),
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    type: z.enum(["text", "number", "currency"]),
    required: z.boolean().optional(),
    order: z.number().int().min(0).max(999),
});
const templatePatchSchema = z.object({
    version: z.number().int().positive().optional(),
    fields: z.array(fieldPatchSchema).max(MAX_CUSTOM_MATERIAL_FIELDS),
});
export function parseMaterialTemplatePatchBody(body) {
    const parsed = templatePatchSchema.safeParse(body);
    if (!parsed.success) {
        return { ok: false, error: "Invalid template payload" };
    }
    const seenKeys = new Set();
    const fields = [];
    for (const f of parsed.data.fields) {
        const key = f.key.trim().toLowerCase();
        if (!KEY_RE.test(key)) {
            return {
                ok: false,
                error: `Invalid key for "${f.label}": use lowercase letters, numbers, underscores; start with a letter.`,
            };
        }
        if (seenKeys.has(key)) {
            return { ok: false, error: `Duplicate field key: ${key}` };
        }
        seenKeys.add(key);
        fields.push({
            id: (f.id?.trim() || randomUUID()),
            key,
            label: f.label.trim(),
            type: f.type,
            required: f.required ?? false,
            order: f.order,
        });
    }
    fields.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key, undefined, { sensitivity: "base" }));
    return {
        ok: true,
        template: {
            version: parsed.data.version ?? MATERIAL_TEMPLATE_VERSION,
            fields,
        },
    };
}
export function templateToDbJson(t) {
    return {
        version: t.version,
        fields: t.fields.map((f) => ({
            id: f.id,
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            order: f.order,
        })),
    };
}
function coerceValue(val, type) {
    if (val === undefined || val === null || val === "") {
        return { ok: true, value: null };
    }
    if (type === "text") {
        const s = typeof val === "string" ? val.trim() : String(val).trim();
        return { ok: true, value: s || null };
    }
    if (type === "number") {
        const n = typeof val === "number" ? val : Number(String(val).replace(/,/g, ""));
        if (!Number.isFinite(n)) {
            return { ok: false, error: "Invalid number" };
        }
        return { ok: true, value: n };
    }
    const s = typeof val === "number" && Number.isFinite(val)
        ? String(val)
        : String(val).trim().replace(/,/g, "");
    if (!s)
        return { ok: true, value: null };
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Invalid currency value" };
    }
    return { ok: true, value: s };
}
function readJsonObject(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
        return { ...v };
    }
    return {};
}
/** Full replace: only template keys kept; validates required. */
export function normalizeCustomAttributes(input, template) {
    const raw = input && typeof input === "object" && !Array.isArray(input)
        ? input
        : {};
    const out = {};
    for (const f of template.fields) {
        const v = raw[f.key];
        const c = coerceValue(v, f.type);
        if (!c.ok) {
            return { ok: false, error: `${f.label}: ${c.error}` };
        }
        if (c.value === null && f.required) {
            return { ok: false, error: `Missing required field: ${f.label}` };
        }
        if (c.value !== null) {
            out[f.key] = c.value;
        }
        else if (!f.required) {
            out[f.key] = null;
        }
    }
    return { ok: true, attributes: out };
}
/** Merge patch into existing JSON object; validates all template fields after merge. */
export function mergeCustomAttributes(existing, patch, template) {
    const base = readJsonObject(existing);
    const patchObj = patch && typeof patch === "object" && !Array.isArray(patch)
        ? patch
        : {};
    const merged = { ...base, ...patchObj };
    return normalizeCustomAttributes(merged, template);
}
export function jsonObjectForResponse(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
        return { ...v };
    }
    return {};
}
