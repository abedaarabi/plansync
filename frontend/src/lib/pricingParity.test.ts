import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_INCLUDED_SEATS,
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_INCLUDED_SEATS,
  PRO_MONTHLY_PRICE_USD,
  TEAM_INCLUDED_SEATS,
  TEAM_MONTHLY_PRICE_USD,
} from "./productPricing";
import { BILLING_PLAN_CATALOG } from "./billingPlanCatalog";

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

describe("pricing contract parity (frontend)", () => {
  it("productPricing matches contracts/pricing.json", () => {
    expect(TEAM_MONTHLY_PRICE_USD).toBe(contract.teamMonthlyUsd);
    expect(PRO_MONTHLY_PRICE_USD).toBe(contract.proMonthlyUsd);
    expect(ENTERPRISE_MONTHLY_PRICE_USD).toBe(contract.enterpriseMonthlyUsd);
    expect(TEAM_INCLUDED_SEATS).toBe(contract.teamIncludedSeats);
    expect(PRO_INCLUDED_SEATS).toBe(contract.proIncludedSeats);
    expect(ENTERPRISE_INCLUDED_SEATS).toBe(contract.enterpriseIncludedSeats);
  });

  it("billing catalog prices and extra seats match the contract", () => {
    const byId = Object.fromEntries(BILLING_PLAN_CATALOG.map((p) => [p.id, p]));
    expect(byId.team?.price).toBe(contract.teamMonthlyUsd);
    expect(byId.pro?.price).toBe(contract.proMonthlyUsd);
    expect(byId.enterprise?.price).toBe(contract.enterpriseMonthlyUsd);
    expect(byId.team?.extraSeatUsd).toBe(contract.teamExtraSeatUsd);
    expect(byId.pro?.extraSeatUsd).toBe(contract.proExtraSeatUsd);
    expect(byId.enterprise?.extraSeatUsd).toBe(contract.enterpriseExtraSeatUsd);
  });

  it("backend listPrices.ts exports the same USD amounts", () => {
    const be = readFileSync(join(root, "backend/src/config/listPrices.ts"), "utf8");
    expect(be).toContain(`TEAM_MONTHLY_PRICE_USD = ${contract.teamMonthlyUsd}`);
    expect(be).toContain(`PRO_MONTHLY_PRICE_USD = ${contract.proMonthlyUsd}`);
    expect(be).toContain(`ENTERPRISE_MONTHLY_PRICE_USD = ${contract.enterpriseMonthlyUsd}`);
  });
});
