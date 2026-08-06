import type Stripe from "stripe";
import { TEAM_MONTHLY_PRICE_USD } from "../config/listPrices.js";
import { resolveStripeMonthlyPriceId } from "./stripeMonthlyPriceResolve.js";

/**
 * PlanSync Team — monthly USD. Keep amounts aligned with
 * `frontend/src/lib/productPricing.ts` via `config/listPrices.ts`.
 */
const TEAM_PLAN_PRODUCT_NAME = "PlanSync Team";
const TEAM_PLAN_LOOKUP_KEY = "plansync_team_monthly_usd";
const TEAM_PLAN_CURRENCY = "usd";
const TEAM_PLAN_MONTHLY_UNIT_AMOUNT = TEAM_MONTHLY_PRICE_USD * 100;

/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_TEAM_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `TEAM_PLAN_LOOKUP_KEY`.
 */
export async function resolveTeamMonthlyPriceId(
  stripe: Stripe,
  envPriceId?: string | null,
): Promise<string> {
  return resolveStripeMonthlyPriceId(stripe, envPriceId, {
    envVarName: "STRIPE_PRICE_TEAM_MONTHLY",
    autoCreateHint: "auto-create the $99/mo Team price",
    productName: TEAM_PLAN_PRODUCT_NAME,
    productMetadata: { plansync: "team" },
    lookupKey: TEAM_PLAN_LOOKUP_KEY,
    currency: TEAM_PLAN_CURRENCY,
    unitAmount: TEAM_PLAN_MONTHLY_UNIT_AMOUNT,
    priceMetadata: { plansync: "team_monthly" },
    resolveErrorMessage: "Could not create or resolve Team monthly Stripe price",
  });
}
