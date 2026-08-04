import { describe, expect, it, vi } from "vitest";
import { processStripeWebhookOnce } from "./stripeWebhookProcess.js";

describe("processStripeWebhookOnce", () => {
  it("skips handler when event was already processed", async () => {
    const handle = vi.fn(async () => {});
    const markProcessed = vi.fn(async () => {});
    const result = await processStripeWebhookOnce(
      "evt_1",
      {
        hasProcessed: async () => true,
        markProcessed,
      },
      handle,
    );
    expect(result).toEqual({ status: "duplicate" });
    expect(handle).not.toHaveBeenCalled();
    expect(markProcessed).not.toHaveBeenCalled();
  });

  it("does not mark processed when handler fails (Stripe can retry)", async () => {
    const markProcessed = vi.fn(async () => {});
    const result = await processStripeWebhookOnce(
      "evt_fail",
      {
        hasProcessed: async () => false,
        markProcessed,
      },
      async () => {
        throw new Error("db down");
      },
    );
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBeInstanceOf(Error);
    }
    expect(markProcessed).not.toHaveBeenCalled();
  });

  it("marks processed only after handler succeeds", async () => {
    const order: string[] = [];
    const result = await processStripeWebhookOnce(
      "evt_ok",
      {
        hasProcessed: async () => false,
        markProcessed: async () => {
          order.push("mark");
        },
      },
      async () => {
        order.push("handle");
      },
    );
    expect(result).toEqual({ status: "ok" });
    expect(order).toEqual(["handle", "mark"]);
  });

  it("allows a retry after a prior failure to run the handler again", async () => {
    const processed = new Set<string>();
    const store = {
      hasProcessed: async (id: string) => processed.has(id),
      markProcessed: async (id: string) => {
        processed.add(id);
      },
    };

    const first = await processStripeWebhookOnce("evt_retry", store, async () => {
      throw new Error("transient");
    });
    expect(first.status).toBe("failed");
    expect(processed.has("evt_retry")).toBe(false);

    const second = await processStripeWebhookOnce("evt_retry", store, async () => {
      /* unlock Pro */
    });
    expect(second).toEqual({ status: "ok" });
    expect(processed.has("evt_retry")).toBe(true);
  });

  it("treats concurrent markProcessed races as success when the event ends up marked", async () => {
    const processed = new Set<string>();
    const result = await processStripeWebhookOnce(
      "evt_race",
      {
        hasProcessed: async (id) => processed.has(id),
        markProcessed: async (id) => {
          processed.add(id);
          throw new Error("Unique constraint failed");
        },
      },
      async () => {
        /* unlock Pro */
      },
    );
    expect(result).toEqual({ status: "ok" });
  });
});
