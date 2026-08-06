"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelWorkspaceStripeSubscription,
  changeWorkspaceSubscriptionPlan,
  createStripeCheckoutSession,
  createStripePortalSession,
  StripePlanChangeRequiresCheckoutError,
  syncStripeCheckoutSession,
} from "@/lib/api-client";
import { billingPlanById } from "@/lib/billingPlanCatalog";
import {
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_MONTHLY_PRICE_USD,
  TEAM_MONTHLY_PRICE_USD,
  paidPlanLabel,
  type PaidBillingPlan,
} from "@/lib/productPricing";
import { qk } from "@/lib/queryKeys";
import { trialDaysLeft } from "@/lib/workspaceSubscription";
import { BillingCompareTable } from "@/components/enterprise/billing/BillingCompareTable";
import { BillingPlanCards } from "@/components/enterprise/billing/BillingPlanCards";
import { BillingStatusPanel } from "@/components/enterprise/billing/BillingStatusPanel";

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
  /** @deprecated Layout is full-width; kept for call-site compatibility. */
  compact?: boolean;
};

const BILLING_MODAL_OVERLAY =
  "mobile-sheet-host fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px] max-lg:items-end max-lg:p-0 sm:p-6";
const BILLING_MODAL_PANEL =
  "relative w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 shadow-2xl ring-1 ring-slate-900/[0.06] max-h-[min(92dvh,32rem)]";

// fallow-ignore-next-line complexity
export function WorkspaceBillingCard({ workspaceId, workspace, isSuperAdmin }: Props) {
  const queryClient = useQueryClient();
  const [portalMounted, setPortalMounted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [planChangeTarget, setPlanChangeTarget] = useState<PaidBillingPlan>("enterprise");

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
  const planLabel = paidPlanLabel(workspace.billingPlan) ?? (hasStripe ? "Active" : null);
  const currentPlan = workspace.billingPlan as PaidBillingPlan | null | undefined;

  const trialDays = status === "trialing" ? trialDaysLeft(workspace.currentPeriodEnd) : null;
  const showDevStripeHint = process.env.NODE_ENV === "development";
  const canCancelInApp =
    Boolean(workspace.stripeSubscriptionId) && status != null && status !== "canceled";
  const canChangePlanOnStripe = hasStripe && Boolean(workspace.stripeSubscriptionId) && isAppPro;

  function subscribeIntroCopy(): string {
    if (!isAppPro) {
      return `Pick Team ($${TEAM_MONTHLY_PRICE_USD}), Pro ($${PRO_MONTHLY_PRICE_USD}), or Enterprise ($${ENTERPRISE_MONTHLY_PRICE_USD}) per month. Each tier unlocks clearer value — collaboration, estimating & BIM, or full O&M.`;
    }
    if (status === "trialing") {
      if (trialDays === 0) {
        return "Your trial has ended. Choose a plan below to restore uninterrupted access.";
      }
      if (trialDays != null) {
        return `You're on a trial with ${trialDays} day${trialDays === 1 ? "" : "s"} left. Subscribe so billing is ready before access ends.`;
      }
      return "You're on a trial. Subscribe below to add a payment method and keep access after the trial.";
    }
    if (status === "active") {
      return "Your subscription is active. Switch tiers below anytime — Stripe prorates the difference — or manage invoices and payment methods in the customer portal.";
    }
    if (status === "past_due") {
      return "There's a billing issue on file. Update your payment method in Manage billing, or pick a plan below if checkout was never completed.";
    }
    if (status === "incomplete") {
      return "A checkout was started but not finished. Pick a plan below to complete setup.";
    }
    return "Pick Team, Pro, or Enterprise below to connect billing.";
  }

  async function startCheckout(plan: PaidBillingPlan) {
    setBusy(`checkout-${plan}`);
    try {
      const { url } = await createStripeCheckoutSession(workspaceId, plan);
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const { url } = await createStripePortalSession(workspaceId);
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal.");
      setBusy(null);
    }
  }

  const targetPlan = billingPlanById(planChangeTarget);

  return (
    <section id="billing" className="enterprise-animate-in space-y-5">
      <BillingStatusPanel
        status={status}
        currentPlan={currentPlan}
        planLabel={planLabel}
        trialDays={trialDays}
        periodEnd={workspace.currentPeriodEnd}
        intro={subscribeIntroCopy()}
        showDevStripeHint={showDevStripeHint}
        hasStripe={hasStripe}
        canCancelInApp={canCancelInApp}
        busy={busy}
        onManageBilling={() => void openPortal()}
        onCancel={() => {
          setCancelImmediate(false);
          setCancelOpen(true);
        }}
      />

      <div>
        <h3 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
          {hasStripe ? "Change plan" : "Choose a plan"}
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          {hasStripe
            ? "Upgrade when you need takeoff, BIM, or O&M — or move down if you only need collaboration. Features unlock immediately after Stripe confirms the change."
            : "Every plan includes seats for your crew. Start with Team for field coordination, Pro for estimating and BIM, or Enterprise when you hand over to operations."}
        </p>
      </div>

      <BillingPlanCards
        currentPlan={currentPlan}
        busy={busy}
        canChangePlan={canChangePlanOnStripe}
        hasStripeCustomer={hasStripe}
        onCheckout={(plan) => void startCheckout(plan)}
        onRequestChange={(plan) => {
          setPlanChangeTarget(plan);
          setPlanChangeOpen(true);
        }}
      />

      <BillingCompareTable />

      <p className="text-center text-xs text-[var(--enterprise-text-muted)]">
        Prices in USD, billed monthly. Need a custom seat pack or invoice? Contact support after
        checkout — we can adjust in Stripe.
      </p>

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
                  Switch to {paidPlanLabel(planChangeTarget)}?
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                  Ongoing price becomes{" "}
                  <span className="font-semibold text-[var(--enterprise-text)]">
                    ${targetPlan.price}/mo
                  </span>{" "}
                  ({targetPlan.seats} seats). Stripe applies{" "}
                  <span className="font-medium text-[var(--enterprise-text)]">proration</span> to
                  your default payment method.
                </p>
                <ul className="mt-4 space-y-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-3 py-3 text-sm text-[var(--enterprise-text)]">
                  {targetPlan.features.slice(0, 4).map((f) => (
                    <li key={f} className="leading-snug">
                      · {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setPlanChangeOpen(false)}
                    className="enterprise-btn-secondary min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60 sm:min-h-0"
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
                            `This workspace is already on ${paidPlanLabel(resultingPlan)}.`,
                          );
                        } else {
                          toast.success(
                            `Switched to ${paidPlanLabel(planChangeTarget)}. Stripe will adjust invoices—see Manage billing.`,
                          );
                        }
                        setBusy(null);
                      } catch (e) {
                        if (e instanceof StripePlanChangeRequiresCheckoutError) {
                          setPlanChangeOpen(false);
                          toast.message("Previous subscription was canceled — opening checkout…");
                          await startCheckout(e.plan);
                          return;
                        }
                        toast.error(e instanceof Error ? e.message : "Could not change plan.");
                        setBusy(null);
                      }
                    }}
                    className="enterprise-btn-primary min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 sm:min-h-0"
                  >
                    {busy === "change-plan" ? "Processing…" : "Yes, change plan"}
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
                  away if your plan was the only source of paid features.
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
                    className="enterprise-btn-secondary min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60 sm:min-h-0"
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
                    className="min-h-11 rounded-xl bg-[var(--enterprise-semantic-danger-text)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 sm:min-h-0"
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
