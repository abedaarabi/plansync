import { PRO_MONTHLY_PRICE_USD } from "../config/listPrices.js";
import { resolveStripeMonthlyPriceId } from "./stripeMonthlyPriceResolve.js";
/**
 * PlanSync Pro — monthly USD. Keep amounts aligned with the marketing site
 * (`frontend/src/lib/productPricing.ts`) via `config/listPrices.ts`.
 *
 * Lookup key is versioned (`_v2`) so auto-resolve creates the new $179 price
 * instead of reusing a legacy $49 catalog entry.
 */
const PRO_PLAN_PRODUCT_NAME = "PlanSync Pro";
const PRO_PLAN_LOOKUP_KEY = "plansync_pro_monthly_usd_v2";
const PRO_PLAN_CURRENCY = "usd";
const PRO_PLAN_MONTHLY_UNIT_AMOUNT = PRO_MONTHLY_PRICE_USD * 100;
/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_PRO_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `PRO_PLAN_LOOKUP_KEY`.
 */
export async function resolveProMonthlyPriceId(stripe, envPriceId) {
    return resolveStripeMonthlyPriceId(stripe, envPriceId, {
        envVarName: "STRIPE_PRICE_PRO_MONTHLY",
        autoCreateHint: "auto-create the $179/mo Pro price",
        productName: PRO_PLAN_PRODUCT_NAME,
        productMetadata: { plansync: "pro" },
        lookupKey: PRO_PLAN_LOOKUP_KEY,
        currency: PRO_PLAN_CURRENCY,
        unitAmount: PRO_PLAN_MONTHLY_UNIT_AMOUNT,
        priceMetadata: { plansync: "pro_monthly" },
        resolveErrorMessage: "Could not create or resolve Pro monthly Stripe price",
    });
}
