"use client";

import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { billingPlanById } from "@/lib/billingPlanCatalog";
import { paidPlanLabel, type PaidBillingPlan } from "@/lib/productPricing";

type Props = {
  status: string | null;
  currentPlan: PaidBillingPlan | null | undefined;
  planLabel: string | null;
  trialDays: number | null;
  periodEnd: string | null | undefined;
  intro: string;
  showDevStripeHint: boolean;
  hasStripe: boolean;
  canCancelInApp: boolean;
  busy: string | null;
  onManageBilling: () => void;
  onCancel: () => void;
};

function statusBadge(status: string | null): { className: string; label: string } | null {
  if (status === "active") return { className: "enterprise-badge-success", label: "Active" };
  if (status === "trialing") return { className: "enterprise-badge-warning", label: "Trial" };
  if (status === "past_due") return { className: "enterprise-badge-danger", label: "Past due" };
  if (status === "incomplete")
    return { className: "enterprise-badge-warning", label: "Incomplete" };
  if (status === "canceled") return { className: "enterprise-badge-neutral", label: "Canceled" };
  return null;
}

function formatPeriodEnd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// fallow-ignore-next-line complexity
export function BillingStatusPanel({
  status,
  currentPlan,
  planLabel,
  trialDays,
  periodEnd,
  intro,
  showDevStripeHint,
  hasStripe,
  canCancelInApp,
  busy,
  onManageBilling,
  onCancel,
}: Props) {
  const badge = statusBadge(status);
  const renews = formatPeriodEnd(periodEnd);
  const catalog = currentPlan ? billingPlanById(currentPlan) : null;

  return (
    <div className="enterprise-card overflow-hidden">
      <div className="border-b border-[var(--enterprise-border)] bg-[linear-gradient(135deg,var(--enterprise-primary-soft),transparent_55%)] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)] ring-1 ring-[var(--enterprise-border)]"
              aria-hidden
            >
              <CreditCard className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                Your workspace
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                  {planLabel ? `${planLabel} plan` : hasStripe ? "Paid access" : "No paid plan yet"}
                </h2>
                {badge ? <span className={badge.className}>{badge.label}</span> : null}
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
                {intro}
              </p>
              {catalog ? (
                <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
                  {catalog.seats} seats included
                  {renews
                    ? status === "trialing"
                      ? ` · Trial ends ${renews}`
                      : ` · Renews ${renews}`
                    : null}
                  {status === "trialing" && trialDays != null
                    ? ` · ${trialDays} day${trialDays === 1 ? "" : "s"} left`
                    : null}
                </p>
              ) : null}
              {showDevStripeHint ? (
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
                  Dev: test card 4242 4242 4242 4242 — any future expiry, any CVC.
                </p>
              ) : null}
            </div>
          </div>

          {hasStripe ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
              <button
                type="button"
                disabled={busy !== null}
                onClick={onManageBilling}
                className="enterprise-btn-secondary mobile-touch-target inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </button>
              {canCancelInApp ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={onCancel}
                  className="mobile-touch-target inline-flex items-center justify-center rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-surface)] px-3.5 py-2.5 text-sm font-semibold text-[var(--enterprise-semantic-danger-text)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] disabled:opacity-60"
                >
                  Cancel…
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 border-t border-[var(--enterprise-border-subtle)] px-4 py-3 sm:grid-cols-3 sm:px-6">
        <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <Lock
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
            aria-hidden
          />
          <span>Payments processed securely by Stripe. Card details never touch PlanSync.</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <ShieldCheck
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
            aria-hidden
          />
          <span>Change or cancel anytime. Plan switches are prorated on your next invoice.</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <CreditCard
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
            aria-hidden
          />
          <span>
            {paidPlanLabel("team")}, {paidPlanLabel("pro")}, and {paidPlanLabel("enterprise")} —
            pick the tier that matches how you work.
          </span>
        </div>
      </div>
    </div>
  );
}
