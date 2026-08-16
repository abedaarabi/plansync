import { isWorkspaceOmBilling, isWorkspaceProPlus, } from "./subscription.js";
/** Stripe statuses that cannot change subscription items (price / plan). */
export function stripeSubscriptionRequiresCheckout(status) {
    return status === "canceled" || status === "incomplete_expired";
}
export function requireProPlusAccess(workspace) {
    if (!isWorkspaceProPlus(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
export function requireOmBillingAccess(workspace) {
    if (!isWorkspaceOmBilling(workspace)) {
        return { error: "Enterprise subscription required for O&M", status: 402 };
    }
    return null;
}
/** BIM-specific copy (same gate as Pro+). */
export function requireBimProPlusAccess(workspace) {
    if (!isWorkspaceProPlus(workspace)) {
        return { error: "Pro subscription required for BIM", status: 402 };
    }
    return null;
}
