import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isWorkspaceOmBillingClient,
  isWorkspaceProClient,
  isWorkspaceProPlusClient,
  trialDaysLeft,
} from "./workspaceSubscription";

describe("isWorkspaceProClient", () => {
  it("matches paid cloud access", () => {
    expect(isWorkspaceProClient({ subscriptionStatus: "active" })).toBe(true);
    expect(isWorkspaceProClient(null)).toBe(false);
    expect(isWorkspaceProClient({ subscriptionStatus: "canceled" })).toBe(false);
  });

  it("honors app-only trial window", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(
      isWorkspaceProClient({
        subscriptionStatus: "trialing",
        stripeSubscriptionId: null,
        currentPeriodEnd: future,
      }),
    ).toBe(true);
    expect(
      isWorkspaceProClient({
        subscriptionStatus: "trialing",
        stripeSubscriptionId: null,
        currentPeriodEnd: past,
      }),
    ).toBe(false);
  });
});

describe("launch plan feature matrix (client)", () => {
  const paid = { subscriptionStatus: "active" as const };

  it("Team: paid cloud only", () => {
    const ws = { ...paid, billingPlan: "team" };
    expect(isWorkspaceProClient(ws)).toBe(true);
    expect(isWorkspaceProPlusClient(ws)).toBe(false);
    expect(isWorkspaceOmBillingClient(ws)).toBe(false);
  });

  it("Pro: takeoff / BIM / proposals", () => {
    const ws = { ...paid, billingPlan: "pro" };
    expect(isWorkspaceProClient(ws)).toBe(true);
    expect(isWorkspaceProPlusClient(ws)).toBe(true);
    expect(isWorkspaceOmBillingClient(ws)).toBe(false);
  });

  it("Enterprise: Pro+ and O&M", () => {
    const ws = { ...paid, billingPlan: "enterprise" };
    expect(isWorkspaceProClient(ws)).toBe(true);
    expect(isWorkspaceProPlusClient(ws)).toBe(true);
    expect(isWorkspaceOmBillingClient(ws)).toBe(true);
  });

  it("grandfathers null billingPlan for Pro+ and O&M", () => {
    const ws = { ...paid, billingPlan: null };
    expect(isWorkspaceProPlusClient(ws)).toBe(true);
    expect(isWorkspaceOmBillingClient(ws)).toBe(true);
  });
});

describe("trialDaysLeft", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns whole days remaining", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    expect(trialDaysLeft("2026-08-08T12:00:00.000Z")).toBe(2);
  });

  it("clamps past dates to 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    expect(trialDaysLeft("2026-08-01T12:00:00.000Z")).toBe(0);
  });

  it("returns null for missing / invalid", () => {
    expect(trialDaysLeft(null)).toBeNull();
    expect(trialDaysLeft("not-a-date")).toBeNull();
  });
});
