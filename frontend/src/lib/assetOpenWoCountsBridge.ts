/** Bridge open WO counts onto PDF asset pins without prop-drilling PdfPageView. */

let counts: Record<string, number> = {};
const listeners = new Set<() => void>();

/** Count open / in-progress work orders per asset for plan pin badges. */
export function countOpenWorkOrdersByAssetId(
  rows: Array<{ assetId?: string | null; status: string }>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const wo of rows) {
    if (!wo.assetId) continue;
    if (wo.status !== "OPEN" && wo.status !== "IN_PROGRESS") continue;
    next[wo.assetId] = (next[wo.assetId] ?? 0) + 1;
  }
  return next;
}

export function setAssetOpenWoCounts(next: Record<string, number>): void {
  counts = next;
  for (const l of listeners) l();
}

export function getAssetOpenWoCount(assetId: string | undefined | null): number {
  if (!assetId) return 0;
  return counts[assetId] ?? 0;
}

export function subscribeAssetOpenWoCounts(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}
