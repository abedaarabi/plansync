import {
  isWorkspaceOmBilling,
  isWorkspaceProPlus,
  type WorkspaceBillingPlanFields,
} from "./subscription.js";

/** Stripe statuses that cannot change subscription items (price / plan). */
export function stripeSubscriptionRequiresCheckout(status: string): boolean {
  return status === "canceled" || status === "incomplete_expired";
}

export function requireProPlusAccess(workspace: WorkspaceBillingPlanFields): {
  error: string;
  status: 402;
} | null {
  if (!isWorkspaceProPlus(workspace)) {
    return { error: "Pro subscription required", status: 402 };
  }
  return null;
}

export function requireOmBillingAccess(workspace: WorkspaceBillingPlanFields): {
  error: string;
  status: 402;
} | null {
  if (!isWorkspaceOmBilling(workspace)) {
    return { error: "Enterprise subscription required for O&M", status: 402 };
  }
  return null;
}

/** BIM-specific copy (same gate as Pro+). */
export function requireBimProPlusAccess(workspace: WorkspaceBillingPlanFields): {
  error: string;
  status: 402;
} | null {
  if (!isWorkspaceProPlus(workspace)) {
    return { error: "Pro subscription required for BIM", status: 402 };
  }
  return null;
}
