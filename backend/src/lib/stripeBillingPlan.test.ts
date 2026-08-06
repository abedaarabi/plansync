import { describe, expect, it } from "vitest";
import { inferBillingPlanFromPriceShape, pickSubscriptionLineItem } from "./stripeBillingPlan.js";
import type Stripe from "stripe";

describe("inferBillingPlanFromPriceShape", () => {
  it("reads price metadata", () => {
    expect(
      inferBillingPlanFromPriceShape({
        lookup_key: null,
        metadata: { plansync: "team_monthly" },
        unit_amount: 9900,
      }),
    ).toBe("team");
    expect(
      inferBillingPlanFromPriceShape({
        lookup_key: null,
        metadata: { plansync: "pro_monthly" },
        unit_amount: 17900,
      }),
    ).toBe("pro");
  });

  it("reads product metadata", () => {
    expect(
      inferBillingPlanFromPriceShape({
        lookup_key: null,
        metadata: {},
        unit_amount: 100,
        product: {
          id: "prod_1",
          object: "product",
          active: true,
          metadata: { plansync: "enterprise" },
        } as unknown as Stripe.Product,
      }),
    ).toBe("enterprise");
  });

  it("recognizes current and legacy lookup keys", () => {
    expect(
      inferBillingPlanFromPriceShape({
        lookup_key: "plansync_pro_monthly_usd",
        metadata: {},
        unit_amount: 4900,
      }),
    ).toBe("pro");
    expect(
      inferBillingPlanFromPriceShape({
        lookup_key: "plansync_pro_monthly_usd_v2",
        metadata: {},
        unit_amount: 17900,
      }),
    ).toBe("pro");
    expect(
      inferBillingPlanFromPriceShape({
        lookup_key: "plansync_enterprise_monthly_usd_v2",
        metadata: {},
        unit_amount: 29900,
      }),
    ).toBe("enterprise");
  });
});

describe("pickSubscriptionLineItem", () => {
  const items = [
    { id: "si_a", price: { id: "price_old" } },
    { id: "si_b", price: { id: "price_new" } },
  ] as unknown as Stripe.SubscriptionItem[];

  it("matches by price id when present", () => {
    const sub = { items: { data: items } } as Stripe.Subscription;
    expect(pickSubscriptionLineItem(sub, "price_new")?.id).toBe("si_b");
  });

  it("falls back to the first item when price id is unknown", () => {
    const sub = { items: { data: items } } as Stripe.Subscription;
    expect(pickSubscriptionLineItem(sub, "price_missing")?.id).toBe("si_a");
    expect(pickSubscriptionLineItem(sub, null)?.id).toBe("si_a");
  });
});
