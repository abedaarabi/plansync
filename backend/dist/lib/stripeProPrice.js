/**
 * PlanSync Pro — monthly USD. Keep amounts aligned with the marketing site
 * (`frontend/src/lib/productPricing.ts`).
 */
export const PRO_PLAN_PRODUCT_NAME = "PlanSync Pro";
export const PRO_PLAN_LOOKUP_KEY = "plansync_pro_monthly_usd";
export const PRO_PLAN_CURRENCY = "usd";
/** Whole USD (display); Stripe uses cents via PRO_PLAN_MONTHLY_UNIT_AMOUNT. */
export const PRO_PLAN_MONTHLY_USD = 49;
export const PRO_PLAN_MONTHLY_UNIT_AMOUNT = PRO_PLAN_MONTHLY_USD * 100;
function assertLooksLikeStripePriceId(id) {
    const lower = id.slice(0, 3).toLowerCase();
    if (lower === "sk_" || lower === "rk_" || id.startsWith("pk_")) {
        throw new Error("STRIPE_PRICE_PRO_MONTHLY must be a Price id (price_… from Stripe Dashboard), not an API key. Put sk_test_… / sk_live_… only in STRIPE_SECRET_KEY. Or remove STRIPE_PRICE_PRO_MONTHLY to auto-create the $49/mo price.");
    }
    if (!id.startsWith("price_")) {
        throw new Error("STRIPE_PRICE_PRO_MONTHLY should look like price_xxxxxxxx (Product catalog → your price). Remove it to use the built-in $49/mo price instead.");
    }
}
/**
 * Returns a `price_…` id for Checkout. Uses `STRIPE_PRICE_PRO_MONTHLY` when set;
 * otherwise finds or creates an active recurring price with `PRO_PLAN_LOOKUP_KEY`.
 */
export async function resolveProMonthlyPriceId(stripe, envPriceId) {
    const trimmed = envPriceId?.trim();
    if (trimmed) {
        assertLooksLikeStripePriceId(trimmed);
        return trimmed;
    }
    const list = await stripe.prices.list({
        lookup_keys: [PRO_PLAN_LOOKUP_KEY],
        active: true,
        limit: 1,
    });
    const hit = list.data[0];
    if (hit)
        return hit.id;
    const product = await stripe.products.create({
        name: PRO_PLAN_PRODUCT_NAME,
        metadata: { plansync: "pro" },
    });
    try {
        const price = await stripe.prices.create({
            currency: PRO_PLAN_CURRENCY,
            unit_amount: PRO_PLAN_MONTHLY_UNIT_AMOUNT,
            recurring: { interval: "month" },
            product: product.id,
            lookup_key: PRO_PLAN_LOOKUP_KEY,
            metadata: { plansync: "pro_monthly" },
        });
        return price.id;
    }
    catch {
        const again = await stripe.prices.list({
            lookup_keys: [PRO_PLAN_LOOKUP_KEY],
            active: true,
            limit: 1,
        });
        const p = again.data[0];
        if (p)
            return p.id;
        throw new Error("Could not create or resolve Pro monthly Stripe price");
    }
}
