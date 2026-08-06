import { describe, expect, it } from "vitest";
import { isWorkspaceOmBilling, isWorkspacePro, isWorkspaceProPlus } from "./subscription.js";

describe("isWorkspacePro", () => {
  it("treats active as paid cloud (Team / Pro / Enterprise)", () => {
    expect(isWorkspacePro({ subscriptionStatus: "active" })).toBe(true);
  });

  it("denies free / canceled", () => {
    expect(isWorkspacePro({ subscriptionStatus: null })).toBe(false);
    expect(isWorkspacePro({ subscriptionStatus: "canceled" })).toBe(false);
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

  it("denies expired app-only trial", () => {
    const past = new Date(Date.now() - 86400_000);
    expect(
      isWorkspacePro({
        subscriptionStatus: "trialing",
        stripeSubscriptionId: null,
        currentPeriodEnd: past,
      }),
    ).toBe(false);
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

  it("denies Team tier O&M", () => {
    expect(
      isWorkspaceOmBilling({
        subscriptionStatus: "active",
        billingPlan: "team",
      }),
    ).toBe(false);
  });
});

describe("isWorkspaceProPlus", () => {
  it("allows Pro and Enterprise", () => {
    expect(isWorkspaceProPlus({ subscriptionStatus: "active", billingPlan: "pro" })).toBe(true);
    expect(isWorkspaceProPlus({ subscriptionStatus: "active", billingPlan: "enterprise" })).toBe(
      true,
    );
  });

  it("denies Team", () => {
    expect(isWorkspaceProPlus({ subscriptionStatus: "active", billingPlan: "team" })).toBe(false);
  });

  it("denies free even with pro billingPlan", () => {
    expect(isWorkspaceProPlus({ subscriptionStatus: null, billingPlan: "pro" })).toBe(false);
  });

  it("grandfathers null billingPlan", () => {
    expect(isWorkspaceProPlus({ subscriptionStatus: "active", billingPlan: null })).toBe(true);
  });
});

/** Feature matrix used by UI gating — keep in sync with frontend client helpers. */
describe("launch plan feature matrix", () => {
  const paid = { subscriptionStatus: "active" as const };

  it("Team: cloud yes, Pro+ no, O&M no", () => {
    const ws = { ...paid, billingPlan: "team" };
    expect(isWorkspacePro(ws)).toBe(true);
    expect(isWorkspaceProPlus(ws)).toBe(false);
    expect(isWorkspaceOmBilling(ws)).toBe(false);
  });

  it("Pro: cloud yes, Pro+ yes, O&M no", () => {
    const ws = { ...paid, billingPlan: "pro" };
    expect(isWorkspacePro(ws)).toBe(true);
    expect(isWorkspaceProPlus(ws)).toBe(true);
    expect(isWorkspaceOmBilling(ws)).toBe(false);
  });

  it("Enterprise: cloud yes, Pro+ yes, O&M yes", () => {
    const ws = { ...paid, billingPlan: "enterprise" };
    expect(isWorkspacePro(ws)).toBe(true);
    expect(isWorkspaceProPlus(ws)).toBe(true);
    expect(isWorkspaceOmBilling(ws)).toBe(true);
  });
});
