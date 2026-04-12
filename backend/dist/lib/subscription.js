/**
 * Pro cloud APIs: paid (`active`), Stripe-managed trial (`trialing` + subscription id), or
 * app-only trial (`trialing` without Stripe) until `currentPeriodEnd`.
 */
export function isWorkspacePro(ws) {
    const s = ws.subscriptionStatus;
    if (s === "active")
        return true;
    if (s === "trialing") {
        if (ws.stripeSubscriptionId)
            return true;
        const end = ws.currentPeriodEnd;
        if (end == null)
            return false;
        const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime();
        if (!Number.isFinite(endMs))
            return false;
        return endMs > Date.now();
    }
    return false;
}
/**
 * Operations & Maintenance (O&M) billing: Enterprise subscribers, or legacy workspaces
 * (`billingPlan` null) that already have Pro — keeps existing customers on Pro grandfathered.
 * Explicit `pro` tier does not include O&M.
 */
export function isWorkspaceOmBilling(ws) {
    if (!isWorkspacePro(ws))
        return false;
    if (ws.billingPlan === "enterprise")
        return true;
    if (ws.billingPlan == null)
        return true;
    return false;
}
