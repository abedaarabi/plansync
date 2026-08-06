/** Fields needed to decide paid cloud access (matches typical `Workspace` / API workspace JSON). */
export type WorkspaceSubscriptionFields = {
  subscriptionStatus: string | null;
  currentPeriodEnd?: Date | string | null;
  stripeSubscriptionId?: string | null;
};

/** Adds `billingPlan` for Team / Pro / Enterprise. */
export type WorkspaceBillingPlanFields = WorkspaceSubscriptionFields & {
  billingPlan?: string | null;
};

/**
 * Paid cloud APIs: `active`, Stripe-managed trial (`trialing` + subscription id), or
 * app-only trial (`trialing` without Stripe) until `currentPeriodEnd`.
 * Covers Team, Pro, and Enterprise.
 */
export function isWorkspacePro(ws: WorkspaceSubscriptionFields): boolean {
  const s = ws.subscriptionStatus;
  if (s === "active") return true;
  if (s === "trialing") {
    if (ws.stripeSubscriptionId) return true;
    const end = ws.currentPeriodEnd;
    if (end == null) return false;
    const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime();
    if (!Number.isFinite(endMs)) return false;
    return endMs > Date.now();
  }
  return false;
}

/**
 * Pro+ features (takeoff, proposals, BIM, clash): Pro and Enterprise, or legacy
 * workspaces with `billingPlan` null. Explicit `team` does not include these.
 */
export function isWorkspaceProPlus(ws: WorkspaceBillingPlanFields): boolean {
  if (!isWorkspacePro(ws)) return false;
  if (ws.billingPlan === "team") return false;
  return true;
}

/**
 * Operations & Maintenance (O&M) billing: Enterprise subscribers, or legacy workspaces
 * (`billingPlan` null) that already have paid access — keeps existing customers grandfathered.
 * Explicit `team` / `pro` tiers do not include O&M.
 */
export function isWorkspaceOmBilling(ws: WorkspaceBillingPlanFields): boolean {
  if (!isWorkspacePro(ws)) return false;
  if (ws.billingPlan === "enterprise") return true;
  if (ws.billingPlan == null) return true;
  return false;
}
