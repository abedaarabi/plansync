import type Stripe from "stripe";
import type { Env } from "./env.js";
import { resolveEnterpriseMonthlyPriceId } from "./stripeEnterprisePrice.js";
import { resolveProMonthlyPriceId } from "./stripeProPrice.js";

/**
 * Maps subscription line items to `pro` / `enterprise` using resolved catalog price ids.
 * Returns null when no known PlanSync recurring price is present.
 */
export async function inferBillingPlanFromSubscription(
  stripe: Stripe,
  env: Pick<Env, "STRIPE_PRICE_PRO_MONTHLY" | "STRIPE_PRICE_ENTERPRISE_MONTHLY">,
  sub: Stripe.Subscription,
): Promise<"pro" | "enterprise" | null> {
  const proId = await resolveProMonthlyPriceId(stripe, env.STRIPE_PRICE_PRO_MONTHLY);
  const entId = await resolveEnterpriseMonthlyPriceId(stripe, env.STRIPE_PRICE_ENTERPRISE_MONTHLY);
  const items = sub.items?.data ?? [];
  for (const item of items) {
    const p = item.price;
    const pid = typeof p === "string" ? p : p?.id;
    if (!pid) continue;
    if (pid === entId) return "enterprise";
    if (pid === proId) return "pro";
  }
  return null;
}
