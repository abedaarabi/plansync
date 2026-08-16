import { ENTERPRISE_MONTHLY_PRICE_USD } from "../config/listPrices.js";
import { resolveStripeMonthlyPriceId } from "./stripeMonthlyPriceResolve.js";
/**
 * PlanSync Enterprise — monthly USD (includes O&M). Keep amounts aligned with
 * `frontend/src/lib/productPricing.ts` via `config/listPrices.ts`.
 *
 * Lookup key is versioned (`_v2`) so auto-resolve creates the new $299 price
 * instead of reusing a legacy $99 catalog entry.
 */
const ENTERPRISE_PLAN_PRODUCT_NAME = "PlanSync Enterprise";
const ENTERPRISE_PLAN_LOOKUP_KEY = "plansync_enterprise_monthly_usd_v2";
const ENTERPRISE_PLAN_CURRENCY = "usd";
const ENTERPRISE_PLAN_MONTHLY_UNIT_AMOUNT = ENTERPRISE_MONTHLY_PRICE_USD * 100;
/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_ENTERPRISE_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `ENTERPRISE_PLAN_LOOKUP_KEY`.
 */
export async function resolveEnterpriseMonthlyPriceId(stripe, envPriceId) {
    return resolveStripeMonthlyPriceId(stripe, envPriceId, {
        envVarName: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
        autoCreateHint: "auto-create the $299/mo Enterprise price",
        productName: ENTERPRISE_PLAN_PRODUCT_NAME,
        productMetadata: { plansync: "enterprise" },
        lookupKey: ENTERPRISE_PLAN_LOOKUP_KEY,
        currency: ENTERPRISE_PLAN_CURRENCY,
        unitAmount: ENTERPRISE_PLAN_MONTHLY_UNIT_AMOUNT,
        priceMetadata: { plansync: "enterprise_monthly" },
        resolveErrorMessage: "Could not create or resolve Enterprise monthly Stripe price",
    });
}
