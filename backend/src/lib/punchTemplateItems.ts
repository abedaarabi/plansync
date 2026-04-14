import type { PunchPriority } from "@prisma/client";

export type PunchTemplateItemDraft = {
  title?: string;
  location?: string;
  trade?: string;
  priority?: PunchPriority;
  notes?: string;
};

/**
 * Coerce stored JSON into a list of template line items.
 * Handles Prisma Json arrays, double-encoded JSON strings, and `{ items: [...] }` shapes.
 */
export function normalizePunchTemplateItemsJson(raw: unknown): PunchTemplateItemDraft[] {
  let v: unknown = raw;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      v = JSON.parse(s) as unknown;
    } catch {
      return [];
    }
  }
  if (Array.isArray(v)) return v as PunchTemplateItemDraft[];
  if (
    v &&
    typeof v === "object" &&
    "items" in v &&
    Array.isArray((v as { items: unknown }).items)
  ) {
    return (v as { items: unknown[] }).items as PunchTemplateItemDraft[];
  }
  return [];
}
