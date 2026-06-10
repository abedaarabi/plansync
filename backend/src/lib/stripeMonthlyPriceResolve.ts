import type Stripe from "stripe";
import { assertLooksLikeStripePriceId } from "./stripePriceIdValidation.js";

export type StripeMonthlyPricePlan = {
  envVarName: string;
  autoCreateHint: string;
  productName: string;
  productMetadata: Record<string, string>;
  lookupKey: string;
  currency: string;
  unitAmount: number;
  priceMetadata: Record<string, string>;
  resolveErrorMessage: string;
};

async function activePriceIdForLookup(stripe: Stripe, lookupKey: string): Promise<string | null> {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return list.data[0]?.id ?? null;
}

async function createMonthlyPrice(stripe: Stripe, plan: StripeMonthlyPricePlan): Promise<string> {
  const product = await stripe.products.create({
    name: plan.productName,
    metadata: plan.productMetadata,
  });

  try {
    const price = await stripe.prices.create({
      currency: plan.currency,
      unit_amount: plan.unitAmount,
      recurring: { interval: "month" },
      product: product.id,
      lookup_key: plan.lookupKey,
      metadata: plan.priceMetadata,
    });
    return price.id;
  } catch {
    const retried = await activePriceIdForLookup(stripe, plan.lookupKey);
    if (retried) return retried;
    throw new Error(plan.resolveErrorMessage);
  }
}

export async function resolveStripeMonthlyPriceId(
  stripe: Stripe,
  envPriceId: string | null | undefined,
  plan: StripeMonthlyPricePlan,
): Promise<string> {
  const trimmed = envPriceId?.trim();
  if (trimmed) {
    assertLooksLikeStripePriceId(trimmed, plan.envVarName, plan.autoCreateHint);
    return trimmed;
  }

  const existing = await activePriceIdForLookup(stripe, plan.lookupKey);
  if (existing) return existing;

  return createMonthlyPrice(stripe, plan);
}
