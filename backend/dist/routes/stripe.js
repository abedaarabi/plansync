import { Hono } from "hono";
import Stripe from "stripe";
import { ActivityType, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../lib/activity.js";
import { resolveProMonthlyPriceId } from "../lib/stripeProPrice.js";
import { sessionMiddleware } from "../middleware/session.js";
function subscriptionPeriodEnd(sub) {
    const t = sub.current_period_end;
    return typeof t === "number" ? new Date(t * 1000) : null;
}
function stripeThrownMessage(e) {
    if (e &&
        typeof e === "object" &&
        "message" in e &&
        typeof e.message === "string") {
        return e.message;
    }
    if (e instanceof Error)
        return e.message;
    return "Stripe request failed";
}
function checkoutCustomerAndSubscriptionIds(session) {
    const c = session.customer;
    const customerId = typeof c === "string"
        ? c
        : c && typeof c === "object" && "deleted" in c && c.deleted
            ? null
            : c && typeof c === "object" && "id" in c
                ? c.id
                : null;
    const s = session.subscription;
    const subId = typeof s === "string"
        ? s
        : s && typeof s === "object" && "id" in s
            ? s.id
            : null;
    if (!customerId || !subId)
        return null;
    return { customerId, subId };
}
async function persistCheckoutSubscriptionToWorkspace(stripe, wsId, customerId, subId, source) {
    const sub = await stripe.subscriptions.retrieve(subId);
    await prisma.workspace.update({
        where: { id: wsId },
        data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subId,
            subscriptionStatus: sub.status,
            currentPeriodEnd: subscriptionPeriodEnd(sub),
        },
    });
    await logActivity(wsId, ActivityType.SUBSCRIPTION_UPDATED, {
        metadata: { status: sub.status, source },
    });
}
export function stripeRoutes(env, auth) {
    const r = new Hono();
    const needUser = sessionMiddleware(auth);
    r.post("/checkout", needUser, async (c) => {
        if (!env.STRIPE_SECRET_KEY) {
            return c.json({ error: "Stripe not configured" }, 503);
        }
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        let priceId;
        try {
            priceId = await resolveProMonthlyPriceId(stripe, env.STRIPE_PRICE_PRO_MONTHLY);
        }
        catch (e) {
            console.error("[stripe] resolve Pro monthly price failed", e);
            const msg = e instanceof Error ? e.message : "Could not resolve subscription price";
            return c.json({ error: msg }, 400);
        }
        const body = await c.req.json().catch(() => ({}));
        const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
        if (!workspaceId) {
            return c.json({ error: "workspaceId is required" }, 400);
        }
        const user = c.get("user");
        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: user.id } },
        });
        if (!membership || membership.role !== WorkspaceRole.SUPER_ADMIN) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!ws) {
            return c.json({ error: "Workspace not found" }, 404);
        }
        /** `{CHECKOUT_SESSION_ID}` is replaced by Stripe — used to sync DB when webhooks do not reach localhost. */
        const successUrl = `${env.PUBLIC_APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${env.PUBLIC_APP_URL}/dashboard?checkout=cancel`;
        const sessionParams = {
            mode: "subscription",
            allow_promotion_codes: env.STRIPE_CHECKOUT_ALLOW_PROMOTION_CODES,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { workspaceId },
            subscription_data: {
                metadata: { workspaceId },
            },
            client_reference_id: workspaceId,
        };
        if (ws.stripeCustomerId) {
            sessionParams.customer = ws.stripeCustomerId;
        }
        else {
            sessionParams.customer_email = user.email;
        }
        let session;
        try {
            session = await stripe.checkout.sessions.create(sessionParams);
        }
        catch (e) {
            console.error("[stripe] checkout.sessions.create", e);
            return c.json({ error: stripeThrownMessage(e) }, 502);
        }
        if (!session.url) {
            return c.json({ error: "Could not create checkout session" }, 500);
        }
        return c.json({ url: session.url });
    });
    r.post("/portal", needUser, async (c) => {
        if (!env.STRIPE_SECRET_KEY) {
            return c.json({ error: "Stripe not configured" }, 503);
        }
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const body = await c.req.json().catch(() => ({}));
        const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
        if (!workspaceId) {
            return c.json({ error: "workspaceId is required" }, 400);
        }
        const user = c.get("user");
        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: user.id } },
        });
        if (!membership || membership.role !== WorkspaceRole.SUPER_ADMIN) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!ws?.stripeCustomerId) {
            return c.json({ error: "No Stripe customer for this workspace" }, 400);
        }
        let portal;
        try {
            portal = await stripe.billingPortal.sessions.create({
                customer: ws.stripeCustomerId,
                return_url: `${env.PUBLIC_APP_URL}/dashboard`,
            });
        }
        catch (e) {
            console.error("[stripe] billingPortal.sessions.create", e);
            return c.json({ error: stripeThrownMessage(e) }, 502);
        }
        return c.json({ url: portal.url });
    });
    /**
     * Confirms a completed Checkout Session and writes Stripe ids to the workspace (same as the webhook).
     * Use when `stripe listen` / deployed webhooks are unavailable (typical in local dev).
     */
    r.post("/sync-checkout-session", needUser, async (c) => {
        if (!env.STRIPE_SECRET_KEY) {
            return c.json({ error: "Stripe not configured" }, 503);
        }
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const body = await c.req.json().catch(() => ({}));
        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        if (!sessionId) {
            return c.json({ error: "sessionId is required" }, 400);
        }
        let session;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ["subscription", "customer"],
            });
        }
        catch (e) {
            console.error("[stripe] sessions.retrieve (sync)", e);
            return c.json({ error: stripeThrownMessage(e) }, 400);
        }
        if (session.status !== "complete") {
            return c.json({ error: "Checkout session is not complete" }, 400);
        }
        if (session.mode !== "subscription") {
            return c.json({ error: "Not a subscription checkout" }, 400);
        }
        const wsId = session.metadata?.workspaceId;
        if (!wsId) {
            return c.json({ error: "Session missing workspace metadata" }, 400);
        }
        const user = c.get("user");
        const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: wsId, userId: user.id } },
        });
        if (!membership || membership.role !== WorkspaceRole.SUPER_ADMIN) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const ids = checkoutCustomerAndSubscriptionIds(session);
        if (!ids) {
            return c.json({ error: "Session missing subscription or customer" }, 400);
        }
        try {
            await persistCheckoutSubscriptionToWorkspace(stripe, wsId, ids.customerId, ids.subId, "sync-checkout-session");
        }
        catch (e) {
            console.error("[stripe] persistCheckoutSubscriptionToWorkspace (sync)", e);
            return c.json({ error: stripeThrownMessage(e) }, 500);
        }
        return c.json({ ok: true });
    });
    r.post("/webhook", async (c) => {
        if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
            return c.json({ error: "Stripe webhook not configured" }, 503);
        }
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const signature = c.req.header("stripe-signature");
        if (!signature)
            return c.json({ error: "Missing signature" }, 400);
        const raw = await c.req.text();
        let event;
        try {
            event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
        }
        catch {
            return c.json({ error: "Invalid signature" }, 400);
        }
        const existing = await prisma.processedStripeEvent.findUnique({
            where: { eventId: event.id },
        });
        if (existing)
            return c.json({ received: true, duplicate: true });
        await prisma.processedStripeEvent.create({ data: { eventId: event.id } });
        try {
            switch (event.type) {
                case "checkout.session.completed": {
                    const sess = event.data.object;
                    const subId = typeof sess.subscription === "string" ? sess.subscription : sess.subscription?.id;
                    const customerId = typeof sess.customer === "string" ? sess.customer : sess.customer?.id;
                    const wsId = sess.metadata?.workspaceId;
                    if (wsId && subId && customerId) {
                        await persistCheckoutSubscriptionToWorkspace(stripe, wsId, customerId, subId, "checkout.session.completed");
                    }
                    break;
                }
                case "customer.subscription.updated":
                case "customer.subscription.deleted": {
                    const sub = event.data.object;
                    const found = await prisma.workspace.findFirst({
                        where: { stripeSubscriptionId: sub.id },
                    });
                    if (found) {
                        await prisma.workspace.update({
                            where: { id: found.id },
                            data: {
                                subscriptionStatus: sub.status,
                                currentPeriodEnd: subscriptionPeriodEnd(sub),
                            },
                        });
                        await logActivity(found.id, ActivityType.SUBSCRIPTION_UPDATED, {
                            metadata: { status: sub.status, event: event.type },
                        });
                    }
                    break;
                }
                case "invoice.payment_failed": {
                    const inv = event.data.object;
                    const subRef = inv
                        .subscription;
                    const subId = typeof subRef === "string" ? subRef : subRef && "id" in subRef ? subRef.id : undefined;
                    if (subId) {
                        const found = await prisma.workspace.findFirst({
                            where: { stripeSubscriptionId: subId },
                        });
                        if (found) {
                            await prisma.workspace.update({
                                where: { id: found.id },
                                data: { subscriptionStatus: "past_due" },
                            });
                            await logActivity(found.id, ActivityType.SUBSCRIPTION_UPDATED, {
                                metadata: { status: "past_due", event: "invoice.payment_failed" },
                            });
                        }
                    }
                    break;
                }
                default:
                    break;
            }
        }
        catch (e) {
            console.error("Stripe webhook handler error", e);
            return c.json({ error: "Handler failed" }, 500);
        }
        return c.json({ received: true });
    });
    return r;
}
