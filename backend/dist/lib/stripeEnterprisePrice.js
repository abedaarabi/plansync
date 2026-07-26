import { resolveStripeMonthlyPriceId } from "./stripeMonthlyPriceResolve.js";
/**
 * PlanSync Enterprise — monthly USD (includes O&M). Keep amounts aligned with
 * `frontend/src/lib/productPricing.ts`.
 */
const ENTERPRISE_PLAN_PRODUCT_NAME = "PlanSync Enterprise";
const ENTERPRISE_PLAN_LOOKUP_KEY = "plansync_enterprise_monthly_usd";
const ENTERPRISE_PLAN_CURRENCY = "usd";
const ENTERPRISE_PLAN_MONTHLY_USD = 99;
const ENTERPRISE_PLAN_MONTHLY_UNIT_AMOUNT = ENTERPRISE_PLAN_MONTHLY_USD * 100;
/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_ENTERPRISE_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `ENTERPRISE_PLAN_LOOKUP_KEY`.
 */
export async function resolveEnterpriseMonthlyPriceId(stripe, envPriceId) {
    return resolveStripeMonthlyPriceId(stripe, envPriceId, {
        envVarName: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
        autoCreateHint: "auto-create the $99/mo price",
        productName: ENTERPRISE_PLAN_PRODUCT_NAME,
        productMetadata: { plansync: "enterprise" },
        lookupKey: ENTERPRISE_PLAN_LOOKUP_KEY,
        currency: ENTERPRISE_PLAN_CURRENCY,
        unitAmount: ENTERPRISE_PLAN_MONTHLY_UNIT_AMOUNT,
        priceMetadata: { plansync: "enterprise_monthly" },
        resolveErrorMessage: "Could not create or resolve Enterprise monthly Stripe price",
    });
}
