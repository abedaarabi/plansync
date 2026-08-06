import { describe, expect, it } from "vitest";
import { BILLING_COMPARE_ROWS, BILLING_PLAN_CATALOG, billingPlanById } from "./billingPlanCatalog";
import {
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_MONTHLY_PRICE_USD,
  TEAM_MONTHLY_PRICE_USD,
} from "./productPricing";

describe("BILLING_PLAN_CATALOG", () => {
  it("includes Team, Pro, and Enterprise once each", () => {
    expect(BILLING_PLAN_CATALOG.map((p) => p.id)).toEqual(["team", "pro", "enterprise"]);
  });

  it("uses productPricing list prices", () => {
    expect(billingPlanById("team").price).toBe(TEAM_MONTHLY_PRICE_USD);
    expect(billingPlanById("pro").price).toBe(PRO_MONTHLY_PRICE_USD);
    expect(billingPlanById("enterprise").price).toBe(ENTERPRISE_MONTHLY_PRICE_USD);
  });

  it("marks Pro as the highlighted plan", () => {
    expect(billingPlanById("pro").highlight).toBe(true);
    expect(billingPlanById("team").highlight).toBeFalsy();
  });

  it("lists features for every plan", () => {
    for (const plan of BILLING_PLAN_CATALOG) {
      expect(plan.features.length).toBeGreaterThanOrEqual(4);
      expect(plan.audience.length).toBeGreaterThan(10);
    }
  });
});

describe("BILLING_COMPARE_ROWS", () => {
  it("keeps Team out of Pro+ and O&M rows", () => {
    const takeoff = BILLING_COMPARE_ROWS.find((r) => r.feature.toLowerCase().includes("takeoff"));
    const bim = BILLING_COMPARE_ROWS.find((r) => r.feature.toLowerCase().includes("bim"));
    const om = BILLING_COMPARE_ROWS.find((r) => r.feature.toLowerCase().includes("o&m"));

    expect(takeoff?.team).toBe(false);
    expect(takeoff?.pro).toBe(true);
    expect(bim?.team).toBe(false);
    expect(bim?.pro).toBe(true);
    expect(om?.team).toBe(false);
    expect(om?.pro).toBe(false);
    expect(om?.enterprise).toBe(true);
  });

  it("gives all paid tiers cloud collaboration", () => {
    const cloud = BILLING_COMPARE_ROWS.find((r) =>
      r.feature.toLowerCase().includes("cloud drawings"),
    );
    expect(cloud).toEqual({
      feature: "Cloud drawings, issues & RFIs",
      team: true,
      pro: true,
      enterprise: true,
    });
  });
});
