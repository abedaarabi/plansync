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
import { PRO_MONTHLY_PRICE_USD } from "@/lib/productPricing";
import { qk } from "@/lib/queryKeys";
type BillingWorkspace = {
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  stripeCustomerId?: string | null;
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
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);

  if (!isSuperAdmin || !workspaceId || !workspace) return null;

  const hasStripe = Boolean(workspace.stripeCustomerId);
  const status = workspace.subscriptionStatus ?? null;
  const isAppPro =
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "incomplete";
  /** Offer Checkout whenever Stripe is not linked — includes trial/seed Pro so you can pay with a test card. */
  const showSubscribe = !hasStripe;
  const showManage = hasStripe;

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
          <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            {hasStripe
              ? "Manage payment method, invoices, and your PlanSync Pro subscription in Stripe."
              : isAppPro
                ? `This workspace already has Pro access (trial or seed). Use Checkout below to link Stripe billing — in test mode use card 4242 4242 4242 4242, any future expiry, any CVC. ${PRO_MONTHLY_PRICE_USD}/month.`
                : `Subscribe to PlanSync Pro for $${PRO_MONTHLY_PRICE_USD}/month — cloud projects, collaboration, and team features.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {showManage ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("portal");
                  try {
                    const { url } = await createStripePortalSession(workspaceId);
                    window.location.href = url;
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not open billing portal.");
                    setBusy(null);
                  }
                }}
                className="rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-60"
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </button>
            ) : null}
            {showSubscribe ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("checkout");
                  try {
                    const { url } = await createStripeCheckoutSession(workspaceId);
                    window.location.href = url;
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not start checkout.");
                    setBusy(null);
                  }
                }}
                className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
              >
                {busy === "checkout"
                  ? "Redirecting…"
                  : `Subscribe — $${PRO_MONTHLY_PRICE_USD}/month`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
