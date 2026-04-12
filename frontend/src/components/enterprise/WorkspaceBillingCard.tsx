"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  cancelWorkspaceStripeSubscription,
  changeWorkspaceSubscriptionPlan,
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
  stripeSubscriptionId?: string | null;
  billingPlan?: string | null;
};

/** Call on organization (Plan & billing tab) so `?checkout=success|cancel` from Stripe shows a toast and clears the query. */
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

const BILLING_MODAL_OVERLAY =
  "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px] sm:p-6";
const BILLING_MODAL_PANEL =
  "relative w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 shadow-2xl ring-1 ring-slate-900/[0.06] max-h-[min(92dvh,32rem)]";

export function WorkspaceBillingCard({ workspaceId, workspace, isSuperAdmin, compact }: Props) {
  const queryClient = useQueryClient();
  const [portalMounted, setPortalMounted] = useState(false);
  const [busy, setBusy] = useState<
    "checkout-pro" | "checkout-enterprise" | "portal" | "change-plan" | null
  >(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [planChangeTarget, setPlanChangeTarget] = useState<"pro" | "enterprise">("enterprise");

  useEffect(() => {
    setPortalMounted(true);
  }, []);

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
  const canCancelInApp =
    Boolean(workspace.stripeSubscriptionId) && status != null && status !== "canceled";
  const canChangePlanOnStripe = hasStripe && Boolean(workspace.stripeSubscriptionId) && isAppPro;
  const canUpgradeProToEnterprise = canChangePlanOnStripe && workspace.billingPlan !== "enterprise";
  const canDowngradeEnterpriseToPro =
    canChangePlanOnStripe && workspace.billingPlan === "enterprise";

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
              {canUpgradeProToEnterprise ? (
                <div className="mt-4 rounded-xl border border-[var(--enterprise-primary)]/30 bg-[color-mix(in_srgb,var(--enterprise-primary)_6%,transparent)] px-3 py-3 sm:px-4">
                  <p className="text-sm font-medium text-[var(--enterprise-text)]">
                    Upgrade to Enterprise
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    Stripe uses your{" "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      saved payment method
                    </span>{" "}
                    to invoice the{" "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      prorated upgrade
                    </span>{" "}
                    for the rest of this period, then ${ENTERPRISE_MONTHLY_PRICE_USD}/mo. No second
                    Checkout page—invoices are in Stripe and under Manage billing.
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setPlanChangeTarget("enterprise");
                      setPlanChangeOpen(true);
                    }}
                    className="mt-3 w-full rounded-lg bg-[var(--enterprise-primary)] px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 sm:w-auto"
                  >
                    Upgrade to Enterprise ($${ENTERPRISE_MONTHLY_PRICE_USD}/mo)…
                  </button>
                </div>
              ) : null}
              {canDowngradeEnterpriseToPro ? (
                <div className="mt-4 rounded-xl border border-slate-300/90 bg-slate-50/90 px-3 py-3 sm:px-4">
                  <p className="text-sm font-medium text-[var(--enterprise-text)]">
                    Downgrade to Pro
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    Moves the subscription to the Pro price (${PRO_MONTHLY_PRICE_USD}/mo). Stripe
                    applies{" "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      proration (often a credit)
                    </span>{" "}
                    on the next invoice.{" "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      O&amp;M–tier features
                    </span>{" "}
                    may no longer apply under your product rules—confirm with your team before
                    downgrading.
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setPlanChangeTarget("pro");
                      setPlanChangeOpen(true);
                    }}
                    className="mt-3 w-full rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-slate-100 disabled:opacity-60 sm:w-auto"
                  >
                    Downgrade to Pro ($${PRO_MONTHLY_PRICE_USD}/mo)…
                  </button>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
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
                {canCancelInApp ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setCancelImmediate(false);
                      setCancelOpen(true);
                    }}
                    className="rounded-lg border border-red-200/90 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
                  >
                    Cancel subscription…
                  </button>
                ) : null}
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

      {portalMounted && planChangeOpen
        ? createPortal(
            <div
              className={BILLING_MODAL_OVERLAY}
              role="dialog"
              aria-modal="true"
              aria-labelledby="plan-change-title"
            >
              <div className={BILLING_MODAL_PANEL}>
                <h3
                  id="plan-change-title"
                  className="text-lg font-semibold leading-snug tracking-tight text-[var(--enterprise-text)]"
                >
                  {planChangeTarget === "enterprise"
                    ? "Charge payment method and upgrade?"
                    : "Downgrade subscription to Pro?"}
                </h3>
                {planChangeTarget === "enterprise" ? (
                  <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[var(--enterprise-text-muted)]">
                    <p>
                      Stripe will update your existing subscription and{" "}
                      <span className="font-medium text-[var(--enterprise-text)]">
                        invoice the prorated upgrade
                      </span>{" "}
                      to your default payment method (or leave the invoice unpaid if collection
                      fails).
                    </p>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-[14px] leading-relaxed text-slate-700">
                      <p>
                        <span className="font-semibold text-[var(--enterprise-text)]">
                          Ongoing price
                        </span>{" "}
                        becomes Enterprise (${ENTERPRISE_MONTHLY_PRICE_USD}/mo). Review charges
                        under{" "}
                        <span className="font-medium text-[var(--enterprise-text)]">
                          Manage billing
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-[15px] leading-relaxed text-[var(--enterprise-text-muted)]">
                    Stripe will switch this subscription to the Pro price ($
                    {PRO_MONTHLY_PRICE_USD}/mo) and apply{" "}
                    <span className="font-medium text-[var(--enterprise-text)]">
                      proration (often a credit)
                    </span>{" "}
                    on upcoming invoices. Enterprise-only features may stop applying per your
                    product rules.
                  </p>
                )}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setPlanChangeOpen(false)}
                    className="min-h-11 rounded-xl border border-[var(--enterprise-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:min-h-0"
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("change-plan");
                      try {
                        const { alreadyOnPlan, plan: resultingPlan } =
                          await changeWorkspaceSubscriptionPlan(workspaceId, planChangeTarget);
                        await queryClient.invalidateQueries({ queryKey: qk.me() });
                        setPlanChangeOpen(false);
                        if (alreadyOnPlan) {
                          toast.message(
                            resultingPlan === "enterprise"
                              ? "This workspace is already on Enterprise."
                              : "This workspace is already on Pro.",
                          );
                        } else if (planChangeTarget === "enterprise") {
                          toast.success(
                            "Upgraded to Enterprise. Stripe will invoice the proration—see Manage billing or your email.",
                          );
                        } else {
                          toast.success(
                            "Downgraded to Pro. Stripe will adjust invoices with proration—see Manage billing.",
                          );
                        }
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not change plan.");
                      } finally {
                        setBusy(null);
                      }
                    }}
                    className={
                      planChangeTarget === "enterprise"
                        ? "min-h-11 rounded-xl bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 sm:min-h-0"
                        : "min-h-11 rounded-xl border border-amber-800/30 bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-60 sm:min-h-0"
                    }
                  >
                    {busy === "change-plan"
                      ? "Processing…"
                      : planChangeTarget === "enterprise"
                        ? "Yes, charge and upgrade"
                        : "Yes, downgrade to Pro"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {portalMounted && cancelOpen
        ? createPortal(
            <div
              className={BILLING_MODAL_OVERLAY}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-sub-title"
            >
              <div className={BILLING_MODAL_PANEL}>
                <h3
                  id="cancel-sub-title"
                  className="text-lg font-semibold leading-snug tracking-tight text-[var(--enterprise-text)]"
                >
                  Cancel subscription
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--enterprise-text-muted)]">
                  By default, access continues until the end of the current billing period, then the
                  plan ends. You can also end billing immediately; project access may drop right
                  away if your plan was the only source of Pro features.
                </p>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--enterprise-border)] bg-white/80 px-3 py-3 text-sm text-[var(--enterprise-text)]">
                  <input
                    type="checkbox"
                    checked={cancelImmediate}
                    onChange={(e) => setCancelImmediate(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-slate-300"
                  />
                  <span>End immediately (no further invoices; access may end now)</span>
                </label>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    disabled={cancelBusy}
                    onClick={() => setCancelOpen(false)}
                    className="min-h-11 rounded-xl border border-[var(--enterprise-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:min-h-0"
                  >
                    Keep subscription
                  </button>
                  <button
                    type="button"
                    disabled={cancelBusy}
                    onClick={async () => {
                      setCancelBusy(true);
                      try {
                        const r = await cancelWorkspaceStripeSubscription(workspaceId, {
                          immediate: cancelImmediate,
                        });
                        await queryClient.invalidateQueries({ queryKey: qk.me() });
                        setCancelOpen(false);
                        toast.success(
                          r.cancelAtPeriodEnd
                            ? "Subscription will end after the current period."
                            : "Subscription has been canceled.",
                        );
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Could not cancel subscription.",
                        );
                      } finally {
                        setCancelBusy(false);
                      }
                    }}
                    className="min-h-11 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 sm:min-h-0"
                  >
                    {cancelBusy ? "Working…" : "Confirm cancel"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
