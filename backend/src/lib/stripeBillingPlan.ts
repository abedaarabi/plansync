import type Stripe from "stripe";
import type { PaidBillingPlan } from "../config/product.js";
import type { Env } from "./env.js";
import { resolveEnterpriseMonthlyPriceId } from "./stripeEnterprisePrice.js";
import { isExtraSeatSubscriptionItem } from "./stripeExtraSeatPrice.js";
import { resolveProMonthlyPriceId } from "./stripeProPrice.js";
import { resolveTeamMonthlyPriceId } from "./stripeTeamPrice.js";

export type StripePriceEnv = Pick<
  Env,
  "STRIPE_PRICE_TEAM_MONTHLY" | "STRIPE_PRICE_PRO_MONTHLY" | "STRIPE_PRICE_ENTERPRISE_MONTHLY"
>;

function parsePaidBillingPlan(raw: string | null | undefined): PaidBillingPlan | null {
  if (raw === "team" || raw === "pro" || raw === "enterprise") return raw;
  return null;
}

function priceIdOfItem(item: Stripe.SubscriptionItem): string | null {
  const p = item.price;
  if (typeof p === "string") return p;
  return p?.id ?? null;
}

function priceObjectOfItem(item: Stripe.SubscriptionItem): Stripe.Price | null {
  const p = item.price;
  if (p && typeof p === "object" && !("deleted" in p && (p as { deleted?: boolean }).deleted)) {
    return p;
  }
  return null;
}

const PRICE_META_TO_PLAN: Record<string, PaidBillingPlan> = {
  team: "team",
  team_monthly: "team",
  pro: "pro",
  pro_monthly: "pro",
  enterprise: "enterprise",
  enterprise_monthly: "enterprise",
};

const LOOKUP_KEY_TO_PLAN: Record<string, PaidBillingPlan> = {
  plansync_team_monthly_usd: "team",
  plansync_pro_monthly_usd: "pro",
  plansync_pro_monthly_usd_v2: "pro",
  plansync_enterprise_monthly_usd: "enterprise",
  plansync_enterprise_monthly_usd_v2: "enterprise",
};

/**
 * Infer tier from Stripe price/product metadata or known lookup keys (incl. legacy).
 * Used when the subscription still points at an older catalog price after a price bump.
 */
export function inferBillingPlanFromPriceShape(
  price: Pick<Stripe.Price, "lookup_key" | "metadata" | "unit_amount"> & {
    product?: string | Stripe.Product | Stripe.DeletedProduct | null;
  },
): PaidBillingPlan | null {
  const fromMeta = PRICE_META_TO_PLAN[price.metadata?.plansync ?? ""];
  if (fromMeta) return fromMeta;

  const product = price.product;
  if (product && typeof product === "object" && "metadata" in product) {
    const fromProduct = PRICE_META_TO_PLAN[product.metadata?.plansync ?? ""];
    if (fromProduct) return fromProduct;
  }

  return LOOKUP_KEY_TO_PLAN[price.lookup_key ?? ""] ?? null;
}

async function expandPriceForPlanInference(
  stripe: Stripe,
  price: Stripe.Price,
): Promise<Stripe.Price> {
  const needsExpand =
    (!price.lookup_key && !price.metadata?.plansync) || typeof price.product === "string";
  if (!needsExpand) return price;
  try {
    return await stripe.prices.retrieve(price.id, { expand: ["product"] });
  } catch {
    return price;
  }
}

/**
 * Maps subscription line items to Team / Pro / Enterprise.
 * Order: live catalog price ids → subscription metadata → price/product shape.
 */
// fallow-ignore-next-line complexity
export async function inferBillingPlanFromSubscription(
  stripe: Stripe,
  env: StripePriceEnv,
  sub: Stripe.Subscription,
): Promise<PaidBillingPlan | null> {
  const teamId = await resolveTeamMonthlyPriceId(stripe, env.STRIPE_PRICE_TEAM_MONTHLY);
  const proId = await resolveProMonthlyPriceId(stripe, env.STRIPE_PRICE_PRO_MONTHLY);
  const entId = await resolveEnterpriseMonthlyPriceId(stripe, env.STRIPE_PRICE_ENTERPRISE_MONTHLY);

  const items = sub.items?.data ?? [];
  for (const item of items) {
    const pid = priceIdOfItem(item);
    if (!pid) continue;
    if (pid === entId) return "enterprise";
    if (pid === proId) return "pro";
    if (pid === teamId) return "team";
  }

  const fromMeta = parsePaidBillingPlan(sub.metadata?.planTier);
  if (fromMeta) return fromMeta;

  for (const item of items) {
    const raw = priceObjectOfItem(item);
    if (!raw?.id) continue;
    const price = await expandPriceForPlanInference(stripe, raw);
    const inferred = inferBillingPlanFromPriceShape(price);
    if (inferred) return inferred;
  }

  return null;
}

export async function resolvePriceIdForBillingPlan(
  stripe: Stripe,
  env: StripePriceEnv,
  plan: PaidBillingPlan,
): Promise<string> {
  if (plan === "team") {
    return resolveTeamMonthlyPriceId(stripe, env.STRIPE_PRICE_TEAM_MONTHLY);
  }
  if (plan === "enterprise") {
    return resolveEnterpriseMonthlyPriceId(stripe, env.STRIPE_PRICE_ENTERPRISE_MONTHLY);
  }
  return resolveProMonthlyPriceId(stripe, env.STRIPE_PRICE_PRO_MONTHLY);
}

/** Prefer the plan line item (never an extra-seat add-on). */
export function pickSubscriptionLineItem(
  sub: Stripe.Subscription,
  currentPriceId: string | null,
): Stripe.SubscriptionItem | null {
  const items = (sub.items?.data ?? []).filter((item) => !isExtraSeatSubscriptionItem(item));
  if (currentPriceId) {
    const match = items.find((item) => priceIdOfItem(item) === currentPriceId);
    if (match) return match;
  }
  return items[0] ?? null;
}
