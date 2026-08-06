import Stripe from "stripe";
import { includedSeatsForBillingPlan, type PaidBillingPlan } from "../config/product.js";
import type { Env } from "./env.js";
import { prisma } from "./prisma.js";
import { countSeatPressure, seatOverageQuantity } from "./seatPressure.js";
import { isWorkspacePro } from "./subscription.js";
import {
  isExtraSeatSubscriptionItem,
  resolveExtraSeatMonthlyPriceId,
  type StripeExtraSeatPriceEnv,
} from "./stripeExtraSeatPrice.js";

function parsePaidBillingPlan(raw: string | null | undefined): PaidBillingPlan {
  if (raw === "team" || raw === "pro" || raw === "enterprise") return raw;
  // Legacy paid workspaces (null billingPlan) use Pro seat pack.
  return "pro";
}

function priceIdOfItem(item: Stripe.SubscriptionItem): string | null {
  const p = item.price;
  if (typeof p === "string") return p;
  return p?.id ?? null;
}

const PRORATE = { proration_behavior: "create_prorations" as const };

export type SyncSeatOverageResult =
  | { ok: true; overage: number; action: "noop" | "updated" | "created" | "removed" }
  | { ok: false; skipped: string };

async function deleteSubscriptionItems(
  stripe: Stripe,
  items: Stripe.SubscriptionItem[],
): Promise<void> {
  for (const item of items) {
    await stripe.subscriptionItems.del(item.id, PRORATE);
  }
}

async function setSeatOverageQuantity(
  stripe: Stripe,
  subscriptionId: string,
  matching: Stripe.SubscriptionItem | undefined,
  seatPriceId: string,
  overage: number,
  clearedObsolete: boolean,
): Promise<SyncSeatOverageResult> {
  if (overage === 0) {
    if (matching) {
      await stripe.subscriptionItems.del(matching.id, PRORATE);
      return { ok: true, overage: 0, action: "removed" };
    }
    return { ok: true, overage: 0, action: clearedObsolete ? "removed" : "noop" };
  }

  if (matching) {
    if (matching.quantity === overage) {
      return { ok: true, overage, action: clearedObsolete ? "updated" : "noop" };
    }
    await stripe.subscriptionItems.update(matching.id, { quantity: overage, ...PRORATE });
    return { ok: true, overage, action: "updated" };
  }

  await stripe.subscriptionItems.create({
    subscription: subscriptionId,
    price: seatPriceId,
    quantity: overage,
    ...PRORATE,
  });
  return { ok: true, overage, action: "created" };
}

/**
 * Align the Stripe subscription's extra-seat line item with current seat pressure.
 * Quantity = max(0, pressure − included seats). When 0, the seat item is removed.
 */
export async function syncSeatOverageSubscription(
  stripe: Stripe,
  env: StripeExtraSeatPriceEnv,
  workspace: {
    id: string;
    billingPlan: string | null;
    subscriptionStatus: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd?: Date | string | null;
  },
): Promise<SyncSeatOverageResult> {
  if (!workspace.stripeSubscriptionId) {
    return { ok: false, skipped: "no_subscription" };
  }
  if (!isWorkspacePro(workspace)) {
    return { ok: false, skipped: "not_paid" };
  }

  const plan = parsePaidBillingPlan(workspace.billingPlan);
  const pressure = await countSeatPressure(workspace.id);
  const overage = seatOverageQuantity(pressure, includedSeatsForBillingPlan(plan));
  const seatPriceId = await resolveExtraSeatMonthlyPriceId(stripe, env, plan);

  const sub = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId, {
    expand: ["items.data.price.product"],
  });
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return { ok: false, skipped: "subscription_inactive" };
  }

  const seatItems = (sub.items?.data ?? []).filter(isExtraSeatSubscriptionItem);
  const matching = seatItems.find((item) => priceIdOfItem(item) === seatPriceId);
  const obsolete = seatItems.filter((item) => priceIdOfItem(item) !== seatPriceId);
  await deleteSubscriptionItems(stripe, obsolete);

  return setSeatOverageQuantity(
    stripe,
    sub.id,
    matching,
    seatPriceId,
    overage,
    obsolete.length > 0,
  );
}

/** Best-effort sync after seat-pressure changes — never fails the caller. */
export async function syncWorkspaceSeatOverageSafe(env: Env, workspaceId: string): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) return;
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        billingPlan: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        currentPeriodEnd: true,
      },
    });
    if (!ws) return;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const result = await syncSeatOverageSubscription(stripe, env, ws);
    if (result.ok && result.action !== "noop") {
      console.info(
        `[stripe] seat overage sync workspace=${workspaceId} overage=${result.overage} action=${result.action}`,
      );
    }
  } catch (e) {
    console.error(`[stripe] seat overage sync failed workspace=${workspaceId}`, e);
  }
}
