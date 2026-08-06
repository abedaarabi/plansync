import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_INCLUDED_SEATS,
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_INCLUDED_SEATS,
  PRO_MONTHLY_PRICE_USD,
  TEAM_INCLUDED_SEATS,
  TEAM_MONTHLY_PRICE_USD,
  paidPlanLabel,
} from "./productPricing";

/** Must match backend `config/listPrices.ts` and seat packs in `config/product.ts`. */
describe("productPricing", () => {
  it("locks launch list prices", () => {
    expect(TEAM_MONTHLY_PRICE_USD).toBe(99);
    expect(PRO_MONTHLY_PRICE_USD).toBe(179);
    expect(ENTERPRISE_MONTHLY_PRICE_USD).toBe(299);
  });

  it("locks included seats", () => {
    expect(TEAM_INCLUDED_SEATS).toBe(5);
    expect(PRO_INCLUDED_SEATS).toBe(5);
    expect(ENTERPRISE_INCLUDED_SEATS).toBe(10);
  });

  it("labels paid plans", () => {
    expect(paidPlanLabel("team")).toBe("Team");
    expect(paidPlanLabel("pro")).toBe("Pro");
    expect(paidPlanLabel("enterprise")).toBe("Enterprise");
    expect(paidPlanLabel(null)).toBeNull();
  });
});
