import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeWorkspaceSubscriptionPlan,
  StripePlanChangeRequiresCheckoutError,
} from "./core-workspace-portal";

describe("changeWorkspaceSubscriptionPlan", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws StripePlanChangeRequiresCheckoutError on 409 requires_checkout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "This subscription was canceled. Start checkout again.",
              code: "requires_checkout",
              plan: "pro",
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(changeWorkspaceSubscriptionPlan("ws_1", "pro")).rejects.toMatchObject({
      name: "StripePlanChangeRequiresCheckoutError",
      plan: "pro",
    });
    await expect(changeWorkspaceSubscriptionPlan("ws_1", "pro")).rejects.toBeInstanceOf(
      StripePlanChangeRequiresCheckoutError,
    );
  });

  it("returns alreadyOnPlan when the API reports no change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, alreadyOnPlan: true, plan: "team" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(changeWorkspaceSubscriptionPlan("ws_1", "team")).resolves.toEqual({
      alreadyOnPlan: true,
      plan: "team",
    });
  });
});
