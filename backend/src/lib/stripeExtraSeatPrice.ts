import type Stripe from "stripe";
import { extraSeatMonthlyUsdForBillingPlan, type PaidBillingPlan } from "../config/product.js";
import type { Env } from "./env.js";
import { resolveStripeMonthlyPriceId } from "./stripeMonthlyPriceResolve.js";

export type StripeExtraSeatPriceEnv = Pick<
  Env,
  | "STRIPE_PRICE_TEAM_EXTRA_SEAT_MONTHLY"
  | "STRIPE_PRICE_PRO_EXTRA_SEAT_MONTHLY"
  | "STRIPE_PRICE_ENTERPRISE_EXTRA_SEAT_MONTHLY"
>;

const EXTRA_SEAT_META: Record<PaidBillingPlan, string> = {
  team: "team_extra_seat_monthly",
  pro: "pro_extra_seat_monthly",
  enterprise: "enterprise_extra_seat_monthly",
};

const EXTRA_SEAT_LOOKUP: Record<PaidBillingPlan, string> = {
  team: "plansync_team_extra_seat_monthly_usd",
  pro: "plansync_pro_extra_seat_monthly_usd",
  enterprise: "plansync_enterprise_extra_seat_monthly_usd",
};

const EXTRA_SEAT_PRODUCT_META: Record<PaidBillingPlan, string> = {
  team: "team_extra_seat",
  pro: "pro_extra_seat",
  enterprise: "enterprise_extra_seat",
};

function isExtraSeatPlansyncMeta(meta: string | null | undefined): boolean {
  return (
    meta === "team_extra_seat_monthly" ||
    meta === "pro_extra_seat_monthly" ||
    meta === "enterprise_extra_seat_monthly" ||
    meta === "team_extra_seat" ||
    meta === "pro_extra_seat" ||
    meta === "enterprise_extra_seat"
  );
}

function isExtraSeatLookupKey(key: string | null | undefined): boolean {
  return Boolean(key && key.includes("extra_seat_monthly"));
}

/** True when a subscription line item is an extra-seat add-on (any paid tier). */
export function isExtraSeatSubscriptionItem(item: Stripe.SubscriptionItem): boolean {
  const price = item.price;
  if (!price || typeof price === "string") return false;
  if (isExtraSeatPlansyncMeta(price.metadata?.plansync)) return true;
  if (isExtraSeatLookupKey(price.lookup_key)) return true;
  const product = price.product;
  if (product && typeof product === "object" && "metadata" in product) {
    return isExtraSeatPlansyncMeta(product.metadata?.plansync);
  }
  return false;
}

export async function resolveExtraSeatMonthlyPriceId(
  stripe: Stripe,
  env: StripeExtraSeatPriceEnv,
  plan: PaidBillingPlan,
): Promise<string> {
  const usd = extraSeatMonthlyUsdForBillingPlan(plan);
  const envKey =
    plan === "team"
      ? "STRIPE_PRICE_TEAM_EXTRA_SEAT_MONTHLY"
      : plan === "enterprise"
        ? "STRIPE_PRICE_ENTERPRISE_EXTRA_SEAT_MONTHLY"
        : "STRIPE_PRICE_PRO_EXTRA_SEAT_MONTHLY";
  const envPriceId =
    plan === "team"
      ? env.STRIPE_PRICE_TEAM_EXTRA_SEAT_MONTHLY
      : plan === "enterprise"
        ? env.STRIPE_PRICE_ENTERPRISE_EXTRA_SEAT_MONTHLY
        : env.STRIPE_PRICE_PRO_EXTRA_SEAT_MONTHLY;

  const label = plan === "team" ? "Team" : plan === "enterprise" ? "Enterprise" : "Pro";
  return resolveStripeMonthlyPriceId(stripe, envPriceId, {
    envVarName: envKey,
    autoCreateHint: `auto-create the $${usd}/mo ${label} extra-seat price`,
    productName: `PlanSync ${label} extra seat`,
    productMetadata: { plansync: EXTRA_SEAT_PRODUCT_META[plan] },
    lookupKey: EXTRA_SEAT_LOOKUP[plan],
    currency: "usd",
    unitAmount: usd * 100,
    priceMetadata: { plansync: EXTRA_SEAT_META[plan] },
    resolveErrorMessage: `Could not create or resolve ${label} extra-seat Stripe price`,
  });
}
