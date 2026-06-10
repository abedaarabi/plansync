import { z } from "zod";

export type WorkOrderChecklistItem = {
  id: string;
  label: string;
  type: "checkbox" | "passfail" | "text" | "photo";
  required?: boolean;
};

export type WorkOrderChecklistResult = {
  itemId: string;
  outcome: "pass" | "fail" | "na" | "done" | null;
  note?: string;
};

const itemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(500),
  type: z.enum(["checkbox", "passfail", "text", "photo"]).optional(),
  required: z.boolean().optional(),
});

export function parseWorkOrderProcedure(v: unknown): WorkOrderChecklistItem[] {
  if (!Array.isArray(v)) return [];
  const out: WorkOrderChecklistItem[] = [];
  for (const raw of v) {
    const parsed = itemSchema.safeParse(raw);
    if (!parsed.success) continue;
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

export function parseWorkOrderProcedureResults(v: unknown): WorkOrderChecklistResult[] {
  if (!Array.isArray(v)) return [];
  const out: WorkOrderChecklistResult[] = [];
  for (const raw of v) {
    const parsed = resultSchema.safeParse(raw);
    if (!parsed.success) continue;
    out.push({
      itemId: parsed.data.itemId.trim(),
      outcome: parsed.data.outcome,
      note: parsed.data.note?.trim() || undefined,
    });
  }
  return out;
}

export function procedureResultsToJsonValue(
  rows: WorkOrderChecklistResult[],
): import("@prisma/client").Prisma.InputJsonValue {
  return rows as unknown as import("@prisma/client").Prisma.InputJsonValue;
}

export function procedureToJsonValue(
  rows: WorkOrderChecklistItem[],
): import("@prisma/client").Prisma.InputJsonValue {
  return rows as unknown as import("@prisma/client").Prisma.InputJsonValue;
}

const partUsedSchema = z.object({
  partName: z.string().min(1).max(200),
  qty: z.number().positive().max(100_000),
  unitCost: z.number().min(0).max(1_000_000).optional(),
  inventoryItemId: z.string().optional(),
});

export type WorkOrderPartUsed = z.infer<typeof partUsedSchema>;

export function parsePartsUsedJson(v: unknown): WorkOrderPartUsed[] {
  if (!Array.isArray(v)) return [];
  const out: WorkOrderPartUsed[] = [];
  for (const raw of v) {
    const parsed = partUsedSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function partsUsedToJsonValue(
  rows: WorkOrderPartUsed[],
): import("@prisma/client").Prisma.InputJsonValue {
  return rows as unknown as import("@prisma/client").Prisma.InputJsonValue;
}

/** Returns error message if required checklist items are incomplete. */
export function validateProcedureCompletion(
  procedure: WorkOrderChecklistItem[],
  results: WorkOrderChecklistResult[],
): string | null {
  if (procedure.length === 0) return null;
  const byId = new Map(results.map((r) => [r.itemId, r]));
  for (const item of procedure) {
    if (!item.required) continue;
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
