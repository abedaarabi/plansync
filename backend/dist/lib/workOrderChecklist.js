import { z } from "zod";
const itemSchema = z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(500),
    type: z.enum(["checkbox", "passfail", "text", "photo"]).optional(),
    required: z.boolean().optional(),
});
export function parseWorkOrderProcedure(v) {
    if (!Array.isArray(v))
        return [];
    const out = [];
    for (const raw of v) {
        const parsed = itemSchema.safeParse(raw);
        if (!parsed.success)
            continue;
        out.push({
            id: parsed.data.id.trim(),
            label: parsed.data.label.trim(),
            type: parsed.data.type ?? "checkbox",
            required: parsed.data.required,
        });
    }
    return out;
}
const resultSchema = z.object({
    itemId: z.string().min(1).max(80),
    outcome: z.enum(["pass", "fail", "na", "done"]).nullable(),
    note: z.string().max(2000).optional(),
});
export function parseWorkOrderProcedureResults(v) {
    if (!Array.isArray(v))
        return [];
    const out = [];
    for (const raw of v) {
        const parsed = resultSchema.safeParse(raw);
        if (!parsed.success)
            continue;
        out.push({
            itemId: parsed.data.itemId.trim(),
            outcome: parsed.data.outcome,
            note: parsed.data.note?.trim() || undefined,
        });
    }
    return out;
}
export function procedureResultsToJsonValue(rows) {
    return rows;
}
export function procedureToJsonValue(rows) {
    return rows;
}
const partUsedSchema = z.object({
    partName: z.string().min(1).max(200),
    qty: z.number().positive().max(100_000),
    unitCost: z.number().min(0).max(1_000_000).optional(),
    inventoryItemId: z.string().optional(),
});
export function parsePartsUsedJson(v) {
    if (!Array.isArray(v))
        return [];
    const out = [];
    for (const raw of v) {
        const parsed = partUsedSchema.safeParse(raw);
        if (parsed.success)
            out.push(parsed.data);
    }
    return out;
}
export function partsUsedToJsonValue(rows) {
    return rows;
}
/** Returns error message if required checklist items are incomplete. */
export function validateProcedureCompletion(procedure, results) {
    if (procedure.length === 0)
        return null;
    const byId = new Map(results.map((r) => [r.itemId, r]));
    for (const item of procedure) {
        if (!item.required)
            continue;
        const r = byId.get(item.id);
        if (!r || r.outcome === null) {
            return `Required step incomplete: ${item.label}`;
        }
        if (item.type === "passfail" && r.outcome === "fail") {
            return `Required step failed: ${item.label}`;
        }
        if (item.type === "checkbox" && r.outcome !== "done" && r.outcome !== "pass") {
            return `Required step incomplete: ${item.label}`;
        }
        if (item.type === "text" && !r.note?.trim()) {
            return `Required note missing: ${item.label}`;
        }
    }
    return null;
}
