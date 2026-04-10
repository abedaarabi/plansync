"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  syncStripeCheckoutSession,
} from "@/lib/api-client";
import { ENTERPRISE_MONTHLY_PRICE_USD, PRO_MONTHLY_PRICE_USD } from "@/lib/productPricing";
import { qk } from "@/lib/queryKeys";
import { trialDaysLeft } from "@/lib/workspaceSubscription";
type BillingWorkspace = {
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  stripeCustomerId?: string | null;
  billingPlan?: string | null;
};

/** Call on dashboard (or any page) so `?checkout=success|cancel` from Stripe shows a toast and clears the query. */
export function useStripeCheckoutReturnToast(replaceTo: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("checkout");
    if (!v) return;
    done.current = true;
    const sessionId = params.get("session_id");

    void (async () => {
      if (v === "success") {
        if (sessionId) {
          try {
            await syncStripeCheckoutSession(sessionId);
            toast.success("Subscription updated. Thank you for supporting PlanSync.");
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Could not confirm checkout in the app. Run: stripe listen --forward-to localhost:8787/api/stripe/webhook",
            );
          }
        } else {
          toast.success("Checkout completed. Refresh if billing still shows the old plan.");
        }
        await queryClient.invalidateQueries({ queryKey: qk.me() });
      } else if (v === "cancel") {
        toast.message("Checkout was canceled.");
      }
      router.replace(replaceTo, { scroll: false });
    })();
  }, [replaceTo, queryClient, router]);
}

type Props = {
  workspaceId: string;
  workspace: BillingWorkspace | null | undefined;
  isSuperAdmin: boolean;
  /** Smaller padding when embedded on Organization settings */
  compact?: boolean;
};

export function WorkspaceBillingCard({ workspaceId, workspace, isSuperAdmin, compact }: Props) {
  const [busy, setBusy] = useState<"checkout-pro" | "checkout-enterprise" | "portal" | null>(null);

  if (!isSuperAdmin || !workspaceId || !workspace) return null;

  const hasStripe = Boolean(workspace.stripeCustomerId);
  const status = workspace.subscriptionStatus ?? null;
  const isAppPro =
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "incomplete";
  const planLabel =
    workspace.billingPlan === "enterprise"
      ? "Enterprise"
      : workspace.billingPlan === "pro"
        ? "Pro"
        : hasStripe
          ? "Active"
          : null;

  const trialDays = status === "trialing" ? trialDaysLeft(workspace.currentPeriodEnd) : null;
  const showDevStripeHint = process.env.NODE_ENV === "development";

  function subscribeIntroCopy(): string {
    if (!isAppPro) {
      return `Choose Pro ($${PRO_MONTHLY_PRICE_USD}/mo) for cloud projects and team collaboration, or Enterprise ($${ENTERPRISE_MONTHLY_PRICE_USD}/mo) to include Operations & Maintenance. Checkout is secure in Stripe.`;
    }
    if (status === "trialing") {
      if (trialDays === 0) {
        return "Your trial has ended. Pick a plan below to restore uninterrupted access.";
      }
      if (trialDays != null) {
        return `You're on a Pro trial with ${trialDays} day${trialDays === 1 ? "" : "s"} left. Subscribe below so billing is on file before the trial ends.`;
      }
      return "You're on a Pro trial. Subscribe below to add a payment method and keep access after the trial.";
    }
    if (status === "active") {
      return "This workspace already has Pro-level access. Subscribe below when you're ready to pay by card—renewals and invoices are handled in Stripe.";
    }
    if (status === "past_due") {
      return "There's a billing issue on file. Choose a plan below or contact support if you need help.";
    }
    if (status === "incomplete") {
      return "A checkout was started but not finished. Pick a plan below to complete setup.";
    }
    return `Pick Pro or Enterprise below to connect billing. Pro is $${PRO_MONTHLY_PRICE_USD}/mo; Enterprise is $${ENTERPRISE_MONTHLY_PRICE_USD}/mo and includes O&M.`;
  }

  return (
    <section
      id="billing"
      className={`rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/90 shadow-[var(--enterprise-shadow-card)] ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-white text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)]"
          aria-hidden
        >
          <CreditCard className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Plan &amp; billing
          </h2>
          {hasStripe ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                Manage payment method, invoices, and subscription in Stripe.
                {planLabel ? (
                  <>
                    {" "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      Current plan: {planLabel}.
                    </span>
                  </>
                ) : null}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                {`Pro ($${PRO_MONTHLY_PRICE_USD}/mo) is collaboration without O&M. Enterprise ($${ENTERPRISE_MONTHLY_PRICE_USD}/mo) includes Operations & Maintenance.`}
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("portal");
                    try {
                      const { url } = await createStripePortalSession(workspaceId);
                      window.location.href = url;
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Could not open billing portal.",
                      );
                      setBusy(null);
                    }
                  }}
                  className="rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-60"
                >
                  {busy === "portal" ? "Opening…" : "Manage billing"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                {subscribeIntroCopy()}
              </p>
              {isAppPro ? (
                <div className="mt-3 rounded-xl border border-sky-200/90 bg-sky-50/70 px-3 py-2.5 text-sm text-slate-800">
                  <span className="font-medium text-slate-900">
                    Why subscribe if I already have access?
                  </span>{" "}
                  <span className="text-slate-700">
                    Linking Stripe adds a customer record, payment method, and subscription so we
                    can bill you correctly after trials or promotions—without losing your workspace
                    data.
                  </span>
                </div>
              ) : null}
              {showDevStripeHint ? (
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
                  Dev: Stripe test card 4242&nbsp;4242&nbsp;4242&nbsp;4242 — any future expiry, any
                  CVC.
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col rounded-xl border border-[var(--enterprise-border)] bg-white p-4 shadow-[var(--enterprise-shadow-xs)]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Pro
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--enterprise-text)]">
                    ${PRO_MONTHLY_PRICE_USD}
                    <span className="text-sm font-normal text-[var(--enterprise-text-muted)]">
                      /mo
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    Cloud projects, sheets, RFIs, and team collaboration. No O&amp;M module.
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("checkout-pro");
                      try {
                        const { url } = await createStripeCheckoutSession(workspaceId, "pro");
                        window.location.href = url;
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not start checkout.");
                        setBusy(null);
                      }
                    }}
                    className="mt-4 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-60"
                  >
                    {busy === "checkout-pro" ? "Redirecting…" : "Continue with Pro"}
                  </button>
                </div>
                <div className="flex flex-col rounded-xl border-2 border-[var(--enterprise-primary)]/35 bg-white p-4 shadow-[var(--enterprise-shadow-xs)] ring-1 ring-[color-mix(in_srgb,var(--enterprise-primary)_12%,transparent)]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-primary)]">
                    Enterprise
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--enterprise-text)]">
                    ${ENTERPRISE_MONTHLY_PRICE_USD}
                    <span className="text-sm font-normal text-[var(--enterprise-text-muted)]">
                      /mo
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    Everything in Pro plus Operations &amp; Maintenance (O&amp;M) workflows.
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("checkout-enterprise");
                      try {
                        const { url } = await createStripeCheckoutSession(
                          workspaceId,
                          "enterprise",
                        );
                        window.location.href = url;
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not start checkout.");
                        setBusy(null);
                      }
                    }}
                    className="mt-4 w-full rounded-lg bg-[var(--enterprise-primary)] px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                  >
                    {busy === "checkout-enterprise" ? "Redirecting…" : "Continue with Enterprise"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
