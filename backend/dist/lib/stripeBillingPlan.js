import { resolveEnterpriseMonthlyPriceId } from "./stripeEnterprisePrice.js";
import { isExtraSeatSubscriptionItem } from "./stripeExtraSeatPrice.js";
import { resolveProMonthlyPriceId } from "./stripeProPrice.js";
import { resolveTeamMonthlyPriceId } from "./stripeTeamPrice.js";
function parsePaidBillingPlan(raw) {
    if (raw === "team" || raw === "pro" || raw === "enterprise")
        return raw;
    return null;
}
function priceIdOfItem(item) {
    const p = item.price;
    if (typeof p === "string")
        return p;
    return p?.id ?? null;
}
function priceObjectOfItem(item) {
    const p = item.price;
    if (p && typeof p === "object" && !("deleted" in p && p.deleted)) {
        return p;
    }
    return null;
}
const PRICE_META_TO_PLAN = {
    team: "team",
    team_monthly: "team",
    pro: "pro",
    pro_monthly: "pro",
    enterprise: "enterprise",
    enterprise_monthly: "enterprise",
};
const LOOKUP_KEY_TO_PLAN = {
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
export function inferBillingPlanFromPriceShape(price) {
    const fromMeta = PRICE_META_TO_PLAN[price.metadata?.plansync ?? ""];
    if (fromMeta)
        return fromMeta;
    const product = price.product;
    if (product && typeof product === "object" && "metadata" in product) {
        const fromProduct = PRICE_META_TO_PLAN[product.metadata?.plansync ?? ""];
        if (fromProduct)
            return fromProduct;
    }
    return LOOKUP_KEY_TO_PLAN[price.lookup_key ?? ""] ?? null;
}
async function expandPriceForPlanInference(stripe, price) {
    const needsExpand = (!price.lookup_key && !price.metadata?.plansync) || typeof price.product === "string";
    if (!needsExpand)
        return price;
    try {
        return await stripe.prices.retrieve(price.id, { expand: ["product"] });
    }
    catch {
        return price;
    }
}
/**
 * Maps subscription line items to Team / Pro / Enterprise.
 * Order: live catalog price ids → subscription metadata → price/product shape.
 */
// fallow-ignore-next-line complexity
export async function inferBillingPlanFromSubscription(stripe, env, sub) {
    const teamId = await resolveTeamMonthlyPriceId(stripe, env.STRIPE_PRICE_TEAM_MONTHLY);
    const proId = await resolveProMonthlyPriceId(stripe, env.STRIPE_PRICE_PRO_MONTHLY);
    const entId = await resolveEnterpriseMonthlyPriceId(stripe, env.STRIPE_PRICE_ENTERPRISE_MONTHLY);
    const items = sub.items?.data ?? [];
    for (const item of items) {
        const pid = priceIdOfItem(item);
        if (!pid)
            continue;
        if (pid === entId)
            return "enterprise";
        if (pid === proId)
            return "pro";
        if (pid === teamId)
            return "team";
    }
    const fromMeta = parsePaidBillingPlan(sub.metadata?.planTier);
    if (fromMeta)
        return fromMeta;
    for (const item of items) {
        const raw = priceObjectOfItem(item);
        if (!raw?.id)
            continue;
        const price = await expandPriceForPlanInference(stripe, raw);
        const inferred = inferBillingPlanFromPriceShape(price);
        if (inferred)
            return inferred;
    }
    return null;
}
export async function resolvePriceIdForBillingPlan(stripe, env, plan) {
    if (plan === "team") {
        return resolveTeamMonthlyPriceId(stripe, env.STRIPE_PRICE_TEAM_MONTHLY);
    }
    if (plan === "enterprise") {
        return resolveEnterpriseMonthlyPriceId(stripe, env.STRIPE_PRICE_ENTERPRISE_MONTHLY);
    }
    return resolveProMonthlyPriceId(stripe, env.STRIPE_PRICE_PRO_MONTHLY);
}
/** Prefer the plan line item (never an extra-seat add-on). */
export function pickSubscriptionLineItem(sub, currentPriceId) {
    const items = (sub.items?.data ?? []).filter((item) => !isExtraSeatSubscriptionItem(item));
    if (currentPriceId) {
        const match = items.find((item) => priceIdOfItem(item) === currentPriceId);
        if (match)
            return match;
    }
    return items[0] ?? null;
}
