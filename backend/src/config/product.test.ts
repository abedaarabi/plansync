import { describe, expect, it } from "vitest";
import { extraSeatMonthlyUsdForBillingPlan, includedSeatsForBillingPlan } from "./product.js";

describe("includedSeatsForBillingPlan", () => {
  it("returns plan seats", () => {
    expect(includedSeatsForBillingPlan("team")).toBe(5);
    expect(includedSeatsForBillingPlan("pro")).toBe(5);
    expect(includedSeatsForBillingPlan("enterprise")).toBe(10);
  });

  it("defaults unknown / null to Pro seat pack", () => {
    expect(includedSeatsForBillingPlan(null)).toBe(5);
    expect(includedSeatsForBillingPlan(undefined)).toBe(5);
    expect(includedSeatsForBillingPlan("other")).toBe(5);
  });
});

describe("extraSeatMonthlyUsdForBillingPlan", () => {
  it("returns plan overage prices", () => {
    expect(extraSeatMonthlyUsdForBillingPlan("team")).toBe(15);
    expect(extraSeatMonthlyUsdForBillingPlan("pro")).toBe(19);
    expect(extraSeatMonthlyUsdForBillingPlan("enterprise")).toBe(25);
  });

  it("defaults unknown / null to Team overage", () => {
    expect(extraSeatMonthlyUsdForBillingPlan(null)).toBe(15);
    expect(extraSeatMonthlyUsdForBillingPlan("other")).toBe(15);
  });
});
