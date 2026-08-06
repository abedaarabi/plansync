import { describe, expect, it } from "vitest";
import {
  requireBimProPlusAccess,
  requireOmBillingAccess,
  requireProPlusAccess,
  stripeSubscriptionRequiresCheckout,
} from "./planFeatureGates.js";

const paid = { subscriptionStatus: "active" as const };

describe("stripeSubscriptionRequiresCheckout", () => {
  it("flags canceled and incomplete_expired", () => {
    expect(stripeSubscriptionRequiresCheckout("canceled")).toBe(true);
    expect(stripeSubscriptionRequiresCheckout("incomplete_expired")).toBe(true);
  });

  it("allows active, trialing, past_due, and cancel-at-period-end active", () => {
    expect(stripeSubscriptionRequiresCheckout("active")).toBe(false);
    expect(stripeSubscriptionRequiresCheckout("trialing")).toBe(false);
    expect(stripeSubscriptionRequiresCheckout("past_due")).toBe(false);
    expect(stripeSubscriptionRequiresCheckout("incomplete")).toBe(false);
  });
});

describe("Team API gates (Pro+ / O&M)", () => {
  it("blocks Team from takeoff/materials/proposals-style Pro+", () => {
    const gate = requireProPlusAccess({ ...paid, billingPlan: "team" });
    expect(gate).toEqual({ error: "Pro subscription required", status: 402 });
  });

  it("allows Pro and Enterprise for Pro+", () => {
    expect(requireProPlusAccess({ ...paid, billingPlan: "pro" })).toBeNull();
    expect(requireProPlusAccess({ ...paid, billingPlan: "enterprise" })).toBeNull();
  });

  it("blocks Team from BIM with BIM-specific message", () => {
    expect(requireBimProPlusAccess({ ...paid, billingPlan: "team" })).toEqual({
      error: "Pro subscription required for BIM",
      status: 402,
    });
  });

  it("blocks Team and Pro from O&M; allows Enterprise", () => {
    expect(requireOmBillingAccess({ ...paid, billingPlan: "team" })).toEqual({
      error: "Enterprise subscription required for O&M",
      status: 402,
    });
    expect(requireOmBillingAccess({ ...paid, billingPlan: "pro" })).toEqual({
      error: "Enterprise subscription required for O&M",
      status: 402,
    });
    expect(requireOmBillingAccess({ ...paid, billingPlan: "enterprise" })).toBeNull();
  });
});
