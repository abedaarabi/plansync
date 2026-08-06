import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { WorkspaceRole } from "@prisma/client";

const retrieveSub = vi.hoisted(() => vi.fn());
const updateSub = vi.hoisted(() => vi.fn());
const createCheckout = vi.hoisted(() => vi.fn());
const findMember = vi.hoisted(() => vi.fn());
const findWorkspace = vi.hoisted(() => vi.fn());
const updateWorkspace = vi.hoisted(() => vi.fn());
const resolvePriceId = vi.hoisted(() => vi.fn());
const inferPlan = vi.hoisted(() => vi.fn());

vi.mock("stripe", () => ({
  default: class Stripe {
    subscriptions = {
      retrieve: (...args: unknown[]) => retrieveSub(...args),
      update: (...args: unknown[]) => updateSub(...args),
    };
    checkout = {
      sessions: {
        create: (...args: unknown[]) => createCheckout(...args),
      },
    };
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    workspaceMember: {
      findUnique: (...args: unknown[]) => findMember(...args),
    },
    workspace: {
      findUnique: (...args: unknown[]) => findWorkspace(...args),
      update: (...args: unknown[]) => updateWorkspace(...args),
    },
  },
}));

vi.mock("../lib/stripeBillingPlan.js", () => ({
  resolvePriceIdForBillingPlan: (...args: unknown[]) => resolvePriceId(...args),
  inferBillingPlanFromSubscription: (...args: unknown[]) => inferPlan(...args),
  pickSubscriptionLineItem: vi.fn(),
}));

vi.mock("../lib/activity.js", () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock("../lib/stripeWebhookProcess.js", () => ({
  processStripeWebhookOnce: vi.fn(),
}));

import { stripeRoutes } from "./stripe.js";

const env = {
  STRIPE_SECRET_KEY: "sk_test_unit",
  PUBLIC_APP_URL: "http://localhost:3000",
  STRIPE_CHECKOUT_ALLOW_PROMOTION_CODES: true,
} as never;

const auth = {
  api: {
    getSession: async () => ({
      user: {
        id: "user_1",
        email: "admin@example.com",
        name: "Admin",
        emailVerified: true,
      },
      session: { id: "sess_1", userId: "user_1", expiresAt: new Date(Date.now() + 60_000) },
    }),
  },
};

function app() {
  const h = new Hono();
  h.route("/api/stripe", stripeRoutes(env, auth));
  return h;
}

describe("POST /api/stripe/change-subscription-plan", () => {
  beforeEach(() => {
    retrieveSub.mockReset();
    updateSub.mockReset();
    createCheckout.mockReset();
    findMember.mockReset();
    findWorkspace.mockReset();
    updateWorkspace.mockReset();
    resolvePriceId.mockReset();
    inferPlan.mockReset();

    findMember.mockResolvedValue({ role: WorkspaceRole.SUPER_ADMIN });
    findWorkspace.mockResolvedValue({
      id: "ws_1",
      billingPlan: "pro",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
    });
    resolvePriceId.mockResolvedValue("price_enterprise");
    updateWorkspace.mockResolvedValue({});
  });

  it("returns 409 requires_checkout when Stripe subscription is canceled", async () => {
    retrieveSub.mockResolvedValue({
      status: "canceled",
      current_period_end: Math.floor(Date.now() / 1000),
      items: { data: [] },
    });

    const res = await app().request("/api/stripe/change-subscription-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_1", plan: "enterprise" }),
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: "requires_checkout",
      plan: "enterprise",
    });
    expect(updateSub).not.toHaveBeenCalled();
    expect(updateWorkspace).toHaveBeenCalled();
  });

  it("updates an active subscription to the target price", async () => {
    retrieveSub
      .mockResolvedValueOnce({
        id: "sub_1",
        status: "active",
        items: {
          data: [{ id: "si_1", price: { id: "price_pro" } }],
        },
      })
      .mockResolvedValueOnce({
        id: "sub_1",
        status: "active",
        items: {
          data: [{ id: "si_1", price: { id: "price_enterprise" } }],
        },
      });
    inferPlan.mockResolvedValueOnce("pro").mockResolvedValueOnce("enterprise");
    updateSub.mockResolvedValue({ id: "sub_1", status: "active" });

    const { pickSubscriptionLineItem } = await import("../lib/stripeBillingPlan.js");
    vi.mocked(pickSubscriptionLineItem).mockReturnValue({
      id: "si_1",
      price: { id: "price_pro" },
    } as never);

    const res = await app().request("/api/stripe/change-subscription-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_1", plan: "enterprise" }),
    });

    expect(res.status).toBe(200);
    expect(updateSub).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      plan: "enterprise",
      alreadyOnPlan: false,
    });
  });
});

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    createCheckout.mockReset();
    findMember.mockReset();
    findWorkspace.mockReset();
    resolvePriceId.mockReset();

    findMember.mockResolvedValue({ role: WorkspaceRole.SUPER_ADMIN });
    findWorkspace.mockResolvedValue({
      id: "ws_1",
      stripeCustomerId: null,
    });
    resolvePriceId.mockResolvedValue("price_team");
    createCheckout.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
  });

  it("creates a Stripe Checkout session for the requested plan", async () => {
    const res = await app().request("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_1", plan: "team" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/session",
    });
    expect(resolvePriceId).toHaveBeenCalledWith(expect.anything(), env, "team");
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        metadata: { workspaceId: "ws_1", planTier: "team" },
      }),
    );
  });
});
