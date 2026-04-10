/** Subset of workspace fields from `/api/v1/me` — keep in sync with backend `isWorkspacePro`. */
export type WorkspaceProFields = {
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | Date | null;
  stripeSubscriptionId?: string | null;
  billingPlan?: string | null;
};

/**
 * Matches backend `isWorkspacePro` — Pro for `active`, Stripe `trialing`, or in-app trial before
 * `currentPeriodEnd`.
 */
export function isWorkspaceProClient(ws: WorkspaceProFields | null | undefined): boolean {
  if (!ws) return false;
  const s = ws.subscriptionStatus;
  if (s === "active") return true;
  if (s === "trialing") {
    if (ws.stripeSubscriptionId) return true;
    const end = ws.currentPeriodEnd;
    if (end == null) return false;
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(endMs)) return false;
    return endMs > Date.now();
  }
  return false;
}

/** O&M billing — matches backend `isWorkspaceOmBilling`. */
export function isWorkspaceOmBillingClient(ws: WorkspaceProFields | null | undefined): boolean {
  if (!ws || !isWorkspaceProClient(ws)) return false;
  if (ws.billingPlan === "enterprise") return true;
  if (ws.billingPlan == null) return true;
  return false;
}

/** Whole days remaining in trial, clamped at 0. Returns null for invalid/missing dates. */
export function trialDaysLeft(currentPeriodEnd: string | Date | null | undefined): number | null {
  if (!currentPeriodEnd) return null;
  const endMs = new Date(currentPeriodEnd).getTime();
  if (!Number.isFinite(endMs)) return null;
  const diff = endMs - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}
