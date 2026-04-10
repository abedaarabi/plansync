import { describe, expect, it } from "vitest";
import { isWorkspaceOmBilling, isWorkspacePro } from "./subscription.js";

describe("isWorkspacePro", () => {
  it("treats active as Pro", () => {
    expect(isWorkspacePro({ subscriptionStatus: "active" })).toBe(true);
  });

  it("treats trialing with Stripe subscription as Pro", () => {
    expect(
      isWorkspacePro({
        subscriptionStatus: "trialing",
        stripeSubscriptionId: "sub_1",
      }),
    ).toBe(true);
  });

  it("treats trialing without Stripe as Pro until currentPeriodEnd", () => {
    const future = new Date(Date.now() + 86400_000);
    expect(
      isWorkspacePro({
        subscriptionStatus: "trialing",
        stripeSubscriptionId: null,
        currentPeriodEnd: future,
      }),
    ).toBe(true);
  });
});

describe("isWorkspaceOmBilling", () => {
  it("requires Pro", () => {
    expect(
      isWorkspaceOmBilling({
        subscriptionStatus: null,
        billingPlan: "enterprise",
      }),
    ).toBe(false);
  });

  it("allows Enterprise when Pro", () => {
    expect(
      isWorkspaceOmBilling({
        subscriptionStatus: "active",
        billingPlan: "enterprise",
      }),
    ).toBe(true);
  });

  it("denies explicit Pro tier O&M", () => {
    expect(
      isWorkspaceOmBilling({
        subscriptionStatus: "active",
        billingPlan: "pro",
      }),
    ).toBe(false);
  });

  it("grandfathers null billingPlan when Pro", () => {
    expect(
      isWorkspaceOmBilling({
        subscriptionStatus: "active",
        billingPlan: null,
      }),
    ).toBe(true);
  });
});
