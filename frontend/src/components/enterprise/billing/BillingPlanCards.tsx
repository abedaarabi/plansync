"use client";

import { Check, Sparkles } from "lucide-react";
import { BILLING_PLAN_CATALOG, type BillingPlanCatalogEntry } from "@/lib/billingPlanCatalog";
import { paidPlanLabel, type PaidBillingPlan } from "@/lib/productPricing";

type Props = {
  currentPlan: PaidBillingPlan | null | undefined;
  busy: string | null;
  /** When true, non-current plans open the switch flow; otherwise start checkout. */
  canChangePlan: boolean;
  hasStripeCustomer: boolean;
  onCheckout: (plan: PaidBillingPlan) => void;
  onRequestChange: (plan: PaidBillingPlan) => void;
};

function ctaLabel(
  plan: BillingPlanCatalogEntry,
  currentPlan: PaidBillingPlan | null | undefined,
  busy: string | null,
  canChangePlan: boolean,
): string {
  if (busy === `checkout-${plan.id}`) return "Redirecting…";
  if (currentPlan === plan.id) return "Current plan";
  if (canChangePlan) return `Switch to ${plan.label}`;
  return `Continue with ${plan.label}`;
}

export function BillingPlanCards({
  currentPlan,
  busy,
  canChangePlan,
  hasStripeCustomer,
  onCheckout,
  onRequestChange,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {BILLING_PLAN_CATALOG.map((plan) => {
        const isCurrent = currentPlan === plan.id;
        const disabled = busy !== null || isCurrent;
        const onClick = () => {
          if (isCurrent) return;
          if (canChangePlan) onRequestChange(plan.id);
          else onCheckout(plan.id);
        };

        return (
          <article
            key={plan.id}
            className={
              plan.highlight
                ? "relative flex flex-col rounded-lg border border-[var(--enterprise-primary)] bg-[var(--enterprise-surface)] p-5 sm:p-6"
                : "relative flex flex-col rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 sm:p-6"
            }
          >
            {plan.highlight && plan.highlightLabel ? (
              <div className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md bg-[var(--enterprise-primary)] px-2 py-0.5 text-[11px] font-semibold text-white">
                <Sparkles className="h-3 w-3" aria-hidden />
                {plan.highlightLabel}
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  className={
                    plan.highlight
                      ? "enterprise-type-label text-[var(--enterprise-primary)]"
                      : "enterprise-type-label text-[var(--enterprise-text-muted)]"
                  }
                >
                  {plan.label}
                </p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-[var(--enterprise-text-muted)]">/mo</span>
                </p>
              </div>
              {isCurrent ? (
                <span className="enterprise-badge-success shrink-0">Current</span>
              ) : null}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
              {plan.audience}
            </p>
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              {plan.seats} seats included · extra seats ${plan.extraSeatUsd}/mo each
            </p>

            <ul className="mt-5 flex flex-1 flex-col gap-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-[var(--enterprise-text)]">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={disabled}
              onClick={onClick}
              className={
                isCurrent
                  ? "mt-6 w-full cursor-default rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--enterprise-text-muted)]"
                  : plan.highlight
                    ? "enterprise-btn-primary mt-6 w-full rounded-md px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
                    : "enterprise-btn-secondary mt-6 w-full rounded-md px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
              }
            >
              {ctaLabel(plan, currentPlan, busy, canChangePlan)}
            </button>

            {!hasStripeCustomer && !isCurrent ? (
              <p className="mt-2 text-center text-[11px] text-[var(--enterprise-text-muted)]">
                Secure checkout via Stripe
              </p>
            ) : null}
            {canChangePlan && !isCurrent ? (
              <p className="mt-2 text-center text-[11px] text-[var(--enterprise-text-muted)]">
                Prorated switch to {paidPlanLabel(plan.id)}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
