import type Stripe from "stripe";
import { resolveStripeMonthlyPriceId } from "./stripeMonthlyPriceResolve.js";

/**
 * PlanSync Pro — monthly USD. Keep amounts aligned with the marketing site
 * (`frontend/src/lib/productPricing.ts`).
 */
const PRO_PLAN_PRODUCT_NAME = "PlanSync Pro";
const PRO_PLAN_LOOKUP_KEY = "plansync_pro_monthly_usd";
const PRO_PLAN_CURRENCY = "usd";
/** Whole USD (display); Stripe uses cents via PRO_PLAN_MONTHLY_UNIT_AMOUNT. */
const PRO_PLAN_MONTHLY_USD = 49;
const PRO_PLAN_MONTHLY_UNIT_AMOUNT = PRO_PLAN_MONTHLY_USD * 100;

/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_PRO_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `PRO_PLAN_LOOKUP_KEY`.
 */
export async function resolveProMonthlyPriceId(
  stripe: Stripe,
  envPriceId?: string | null,
): Promise<string> {
  return resolveStripeMonthlyPriceId(stripe, envPriceId, {
    envVarName: "STRIPE_PRICE_PRO_MONTHLY",
    autoCreateHint: "auto-create the $49/mo price",
    productName: PRO_PLAN_PRODUCT_NAME,
    productMetadata: { plansync: "pro" },
    lookupKey: PRO_PLAN_LOOKUP_KEY,
    currency: PRO_PLAN_CURRENCY,
    unitAmount: PRO_PLAN_MONTHLY_UNIT_AMOUNT,
    priceMetadata: { plansync: "pro_monthly" },
    resolveErrorMessage: "Could not create or resolve Pro monthly Stripe price",
  });
}
