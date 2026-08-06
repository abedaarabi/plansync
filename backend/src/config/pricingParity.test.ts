import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_MONTHLY_PRICE_USD,
  TEAM_MONTHLY_PRICE_USD,
} from "./listPrices.js";
import { extraSeatMonthlyUsdForBillingPlan, includedSeatsForBillingPlan } from "./product.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const contract = JSON.parse(readFileSync(join(root, "contracts/pricing.json"), "utf8")) as {
  teamMonthlyUsd: number;
  proMonthlyUsd: number;
  enterpriseMonthlyUsd: number;
  teamIncludedSeats: number;
  proIncludedSeats: number;
  enterpriseIncludedSeats: number;
  teamExtraSeatUsd: number;
  proExtraSeatUsd: number;
  enterpriseExtraSeatUsd: number;
};

describe("pricing contract parity (backend)", () => {
  it("listPrices match contracts/pricing.json", () => {
    expect(TEAM_MONTHLY_PRICE_USD).toBe(contract.teamMonthlyUsd);
    expect(PRO_MONTHLY_PRICE_USD).toBe(contract.proMonthlyUsd);
    expect(ENTERPRISE_MONTHLY_PRICE_USD).toBe(contract.enterpriseMonthlyUsd);
  });

  it("seat packs match contracts/pricing.json", () => {
    expect(includedSeatsForBillingPlan("team")).toBe(contract.teamIncludedSeats);
    expect(includedSeatsForBillingPlan("pro")).toBe(contract.proIncludedSeats);
    expect(includedSeatsForBillingPlan("enterprise")).toBe(contract.enterpriseIncludedSeats);
    expect(extraSeatMonthlyUsdForBillingPlan("team")).toBe(contract.teamExtraSeatUsd);
    expect(extraSeatMonthlyUsdForBillingPlan("pro")).toBe(contract.proExtraSeatUsd);
    expect(extraSeatMonthlyUsdForBillingPlan("enterprise")).toBe(contract.enterpriseExtraSeatUsd);
  });

  it("frontend productPricing.ts exports the same USD amounts", () => {
    const fe = readFileSync(join(root, "frontend/src/lib/productPricing.ts"), "utf8");
    expect(fe).toContain(`TEAM_MONTHLY_PRICE_USD = ${contract.teamMonthlyUsd}`);
    expect(fe).toContain(`PRO_MONTHLY_PRICE_USD = ${contract.proMonthlyUsd}`);
    expect(fe).toContain(`ENTERPRISE_MONTHLY_PRICE_USD = ${contract.enterpriseMonthlyUsd}`);
    expect(fe).toContain(`TEAM_INCLUDED_SEATS = ${contract.teamIncludedSeats}`);
    expect(fe).toContain(`PRO_INCLUDED_SEATS = ${contract.proIncludedSeats}`);
    expect(fe).toContain(`ENTERPRISE_INCLUDED_SEATS = ${contract.enterpriseIncludedSeats}`);
  });

  it("billing catalog extra seats match the contract", () => {
    const catalog = readFileSync(join(root, "frontend/src/lib/billingPlanCatalog.ts"), "utf8");
    expect(catalog).toContain(`extraSeatUsd: ${contract.teamExtraSeatUsd}`);
    expect(catalog).toContain(`extraSeatUsd: ${contract.proExtraSeatUsd}`);
    expect(catalog).toContain(`extraSeatUsd: ${contract.enterpriseExtraSeatUsd}`);
  });
});
