import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_MONTHLY_PRICE_USD,
  TEAM_MONTHLY_PRICE_USD,
} from "./listPrices.js";

/** Launch pricing contract — must match frontend `productPricing.ts`. */
describe("listPrices", () => {
  it("locks Team / Pro / Enterprise monthly USD", () => {
    expect(TEAM_MONTHLY_PRICE_USD).toBe(99);
    expect(PRO_MONTHLY_PRICE_USD).toBe(179);
    expect(ENTERPRISE_MONTHLY_PRICE_USD).toBe(299);
  });

  it("keeps Pro above Team and Enterprise above Pro", () => {
    expect(PRO_MONTHLY_PRICE_USD).toBeGreaterThan(TEAM_MONTHLY_PRICE_USD);
    expect(ENTERPRISE_MONTHLY_PRICE_USD).toBeGreaterThan(PRO_MONTHLY_PRICE_USD);
  });
});
