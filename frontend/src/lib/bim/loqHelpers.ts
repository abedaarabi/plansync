import type { BimLoqReport, BimQuantityIndex } from "@/lib/bim/types";

/** Backward-compatible authored color coverage from LOQ or quantity index. */
// fallow-ignore-next-line complexity
export function resolveAuthoredColorPct(
  loq: BimLoqReport | null,
  index: BimQuantityIndex | null,
): number {
  if (loq && typeof loq.pctAuthoredColor === "number") return loq.pctAuthoredColor;
  if (!index?.elements?.length) return 0;
  const withColor = index.elements.filter((e) => e.lodFlags?.color).length;
  return Math.round((withColor / index.elements.length) * 100);
}
