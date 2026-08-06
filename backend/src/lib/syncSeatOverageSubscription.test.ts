import { beforeEach, describe, expect, it, vi } from "vitest";

const countSeatPressure = vi.hoisted(() => vi.fn());
const resolveExtraSeat = vi.hoisted(() => vi.fn());
const retrieve = vi.hoisted(() => vi.fn());
const createItem = vi.hoisted(() => vi.fn());
const updateItem = vi.hoisted(() => vi.fn());
const delItem = vi.hoisted(() => vi.fn());

vi.mock("./seatPressure.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./seatPressure.js")>();
  return {
    ...mod,
    countSeatPressure: (...args: unknown[]) => countSeatPressure(...args),
  };
});

vi.mock("./stripeExtraSeatPrice.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./stripeExtraSeatPrice.js")>();
  return {
    ...mod,
    resolveExtraSeatMonthlyPriceId: (...args: unknown[]) => resolveExtraSeat(...args),
  };
});

import { syncSeatOverageSubscription } from "./syncSeatOverageSubscription.js";
import type Stripe from "stripe";

function stripeMock(): Stripe {
  return {
    subscriptions: { retrieve: (...args: unknown[]) => retrieve(...args) },
    subscriptionItems: {
      create: (...args: unknown[]) => createItem(...args),
      update: (...args: unknown[]) => updateItem(...args),
      del: (...args: unknown[]) => delItem(...args),
    },
  } as unknown as Stripe;
}

const paidWs = {
  id: "ws_1",
  billingPlan: "enterprise" as const,
  subscriptionStatus: "active",
  stripeSubscriptionId: "sub_1",
};

describe("syncSeatOverageSubscription", () => {
  beforeEach(() => {
    countSeatPressure.mockReset();
    resolveExtraSeat.mockReset();
    retrieve.mockReset();
    createItem.mockReset();
    updateItem.mockReset();
    delItem.mockReset();
    resolveExtraSeat.mockResolvedValue("price_ent_seat");
  });

  it("skips when there is no Stripe subscription", async () => {
    const result = await syncSeatOverageSubscription(stripeMock(), {} as never, {
      ...paidWs,
      stripeSubscriptionId: null,
    });
    expect(result).toEqual({ ok: false, skipped: "no_subscription" });
  });

  it("creates a seat line item when overage is positive", async () => {
    countSeatPressure.mockResolvedValue(12);
    retrieve.mockResolvedValue({
      id: "sub_1",
      status: "active",
      items: { data: [{ id: "si_plan", price: { id: "price_ent", metadata: {} } }] },
    });
    createItem.mockResolvedValue({ id: "si_seat" });

    const result = await syncSeatOverageSubscription(stripeMock(), {} as never, paidWs);

    expect(result).toEqual({ ok: true, overage: 2, action: "created" });
    expect(createItem).toHaveBeenCalledWith({
      subscription: "sub_1",
      price: "price_ent_seat",
      quantity: 2,
      proration_behavior: "create_prorations",
    });
  });

  it("updates quantity when the seat item already exists", async () => {
    countSeatPressure.mockResolvedValue(13);
    retrieve.mockResolvedValue({
      id: "sub_1",
      status: "active",
      items: {
        data: [
          { id: "si_plan", price: { id: "price_ent", metadata: {} } },
          {
            id: "si_seat",
            quantity: 1,
            price: {
              id: "price_ent_seat",
              metadata: { plansync: "enterprise_extra_seat_monthly" },
            },
          },
        ],
      },
    });

    const result = await syncSeatOverageSubscription(stripeMock(), {} as never, paidWs);

    expect(result).toEqual({ ok: true, overage: 3, action: "updated" });
    expect(updateItem).toHaveBeenCalledWith("si_seat", {
      quantity: 3,
      proration_behavior: "create_prorations",
    });
  });

  it("removes the seat item when overage returns to zero", async () => {
    countSeatPressure.mockResolvedValue(8);
    retrieve.mockResolvedValue({
      id: "sub_1",
      status: "active",
      items: {
        data: [
          { id: "si_plan", price: { id: "price_ent", metadata: {} } },
          {
            id: "si_seat",
            quantity: 2,
            price: {
              id: "price_ent_seat",
              metadata: { plansync: "enterprise_extra_seat_monthly" },
            },
          },
        ],
      },
    });

    const result = await syncSeatOverageSubscription(stripeMock(), {} as never, paidWs);

    expect(result).toEqual({ ok: true, overage: 0, action: "removed" });
    expect(delItem).toHaveBeenCalledWith("si_seat", {
      proration_behavior: "create_prorations",
    });
  });
});
