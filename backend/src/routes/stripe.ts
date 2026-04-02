import { Hono } from "hono";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import type { Env } from "../lib/env.js";
import { logActivity } from "../lib/activity.js";
import { ActivityType } from "@prisma/client";

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const t = (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof t === "number" ? new Date(t * 1000) : null;
}

export function stripeRoutes(env: Env) {
  const r = new Hono();

  r.post("/checkout", async (c) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_PRO_MONTHLY) {
      return c.json({ error: "Stripe not configured" }, 503);
    }
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : null;
    const customerEmail = typeof body.email === "string" ? body.email : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: customerEmail,
      line_items: [{ price: env.STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }],
      success_url: `${env.PUBLIC_APP_URL}/settings?checkout=success`,
      cancel_url: `${env.PUBLIC_APP_URL}/settings?checkout=cancel`,
      metadata: workspaceId ? { workspaceId } : {},
    });

    return c.json({ url: session.url });
  });

  r.post("/webhook", async (c) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      return c.json({ error: "Stripe webhook not configured" }, 503);
    }
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const signature = c.req.header("stripe-signature");
    if (!signature) return c.json({ error: "Missing signature" }, 400);

    const raw = await c.req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return c.json({ error: "Invalid signature" }, 400);
    }

    const existing = await prisma.processedStripeEvent.findUnique({
      where: { eventId: event.id },
    });
    if (existing) return c.json({ received: true, duplicate: true });

    await prisma.processedStripeEvent.create({ data: { eventId: event.id } });

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const sess = event.data.object as Stripe.Checkout.Session;
          const subId =
            typeof sess.subscription === "string" ? sess.subscription : sess.subscription?.id;
          const customerId = typeof sess.customer === "string" ? sess.customer : sess.customer?.id;
          const wsId = sess.metadata?.workspaceId;
          if (wsId && subId && customerId) {
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
              metadata: { status: sub.status, source: "checkout.session.completed" },
            });
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const ws = await prisma.workspace.findFirst({
            where: { stripeSubscriptionId: sub.id },
          });
          if (ws) {
            await prisma.workspace.update({
              where: { id: ws.id },
              data: {
                subscriptionStatus: sub.status,
                currentPeriodEnd: subscriptionPeriodEnd(sub),
              },
            });
            await logActivity(ws.id, ActivityType.SUBSCRIPTION_UPDATED, {
              metadata: { status: sub.status, event: event.type },
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const inv = event.data.object as Stripe.Invoice;
          const subRef = (inv as unknown as { subscription?: string | Stripe.Subscription | null })
            .subscription;
          const subId =
            typeof subRef === "string" ? subRef : subRef && "id" in subRef ? subRef.id : undefined;
          if (subId) {
            const ws = await prisma.workspace.findFirst({
              where: { stripeSubscriptionId: subId },
            });
            if (ws) {
              await prisma.workspace.update({
                where: { id: ws.id },
                data: { subscriptionStatus: "past_due" },
              });
              await logActivity(ws.id, ActivityType.SUBSCRIPTION_UPDATED, {
                metadata: { status: "past_due", event: "invoice.payment_failed" },
              });
            }
          }
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.error("Stripe webhook handler error", e);
      return c.json({ error: "Handler failed" }, 500);
    }

    return c.json({ received: true });
  });

  return r;
}
