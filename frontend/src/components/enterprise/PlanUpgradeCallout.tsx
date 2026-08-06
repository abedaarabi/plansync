"use client";

import Link from "next/link";

type Props = {
  /** Feature name shown in the headline, e.g. "Proposals". */
  feature: string;
  /** Optional extra detail under the headline. */
  detail?: string;
  /** Target plan name for the CTA. Default Pro. */
  requiredPlan?: "Pro" | "Enterprise";
};

/**
 * Shown when a page needs a higher paid tier than the workspace currently has.
 */
export function PlanUpgradeCallout({ feature, detail, requiredPlan = "Pro" }: Props) {
  return (
    <div className="enterprise-alert-warning mx-auto max-w-lg p-6 text-sm">
      <p className="font-semibold text-[var(--enterprise-text)]">
        {feature} requires {requiredPlan}
      </p>
      <p className="mt-2 text-[var(--enterprise-text-muted)]">
        {detail ??
          (requiredPlan === "Enterprise"
            ? "Upgrade this workspace to Enterprise to unlock Operations & Maintenance."
            : "Your workspace is on Team (or free). Upgrade to Pro for takeoff, proposals, and BIM.")}
      </p>
      <Link
        href="/organization?tab=billing"
        className="mt-4 inline-flex rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
      >
        View plans &amp; billing
      </Link>
    </div>
  );
}
