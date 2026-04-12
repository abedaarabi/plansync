/**
 * PlanSync Enterprise — monthly USD (includes O&M). Keep amounts aligned with
 * `frontend/src/lib/productPricing.ts`.
 */
export const ENTERPRISE_PLAN_PRODUCT_NAME = "PlanSync Enterprise";
export const ENTERPRISE_PLAN_LOOKUP_KEY = "plansync_enterprise_monthly_usd";
export const ENTERPRISE_PLAN_CURRENCY = "usd";
export const ENTERPRISE_PLAN_MONTHLY_USD = 99;
export const ENTERPRISE_PLAN_MONTHLY_UNIT_AMOUNT = ENTERPRISE_PLAN_MONTHLY_USD * 100;
function assertLooksLikeStripePriceId(id) {
    const lower = id.slice(0, 3).toLowerCase();
    if (lower === "sk_" || lower === "rk_" || id.startsWith("pk_")) {
        throw new Error("STRIPE_PRICE_ENTERPRISE_MONTHLY must be a Price id (price_… from Stripe Dashboard), not an API key. Put sk_test_… / sk_live_… only in STRIPE_SECRET_KEY. Or remove STRIPE_PRICE_ENTERPRISE_MONTHLY to auto-create the $99/mo price.");
    }
    if (!id.startsWith("price_")) {
        throw new Error("STRIPE_PRICE_ENTERPRISE_MONTHLY should look like price_xxxxxxxx (Product catalog → your price). Remove it to use the built-in $99/mo price instead.");
    }
}
/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_ENTERPRISE_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `ENTERPRISE_PLAN_LOOKUP_KEY`.
 */
export async function resolveEnterpriseMonthlyPriceId(stripe, envPriceId) {
    const trimmed = envPriceId?.trim();
    if (trimmed) {
        assertLooksLikeStripePriceId(trimmed);
        return trimmed;
    }
    const list = await stripe.prices.list({
        lookup_keys: [ENTERPRISE_PLAN_LOOKUP_KEY],
        active: true,
        limit: 1,
    });
    const hit = list.data[0];
    if (hit)
        return hit.id;
    const product = await stripe.products.create({
        name: ENTERPRISE_PLAN_PRODUCT_NAME,
        metadata: { plansync: "enterprise" },
    });
    try {
        const price = await stripe.prices.create({
            currency: ENTERPRISE_PLAN_CURRENCY,
            unit_amount: ENTERPRISE_PLAN_MONTHLY_UNIT_AMOUNT,
            recurring: { interval: "month" },
            product: product.id,
            lookup_key: ENTERPRISE_PLAN_LOOKUP_KEY,
            metadata: { plansync: "enterprise_monthly" },
        });
        return price.id;
    }
    catch {
        const again = await stripe.prices.list({
            lookup_keys: [ENTERPRISE_PLAN_LOOKUP_KEY],
            active: true,
            limit: 1,
        });
        const p = again.data[0];
        if (p)
            return p.id;
        throw new Error("Could not create or resolve Enterprise monthly Stripe price");
    }
}
