"use client";

import { Check, Minus } from "lucide-react";
import { BILLING_COMPARE_ROWS } from "@/lib/billingPlanCatalog";

function Cell({ on }: { on: boolean }) {
  if (on) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Included" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center text-[var(--enterprise-text-muted)]">
      <Minus className="h-3.5 w-3.5" aria-label="Not included" />
    </span>
  );
}

/** Compact feature matrix so buyers see why Pro / Enterprise cost more. */
export function BillingCompareTable() {
  return (
    <div className="enterprise-card overflow-hidden">
      <div className="border-b border-[var(--enterprise-border)] px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
          Compare capabilities
        </h3>
        <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
          What unlocks as you move from Team → Pro → Enterprise.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80">
              <th
                scope="col"
                className="px-4 py-2.5 font-medium text-[var(--enterprise-text-muted)] sm:px-5"
              >
                Capability
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-center font-semibold text-[var(--enterprise-text)]"
              >
                Team
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-center font-semibold text-[var(--enterprise-primary)]"
              >
                Pro
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-center font-semibold text-[var(--enterprise-text)]"
              >
                Enterprise
              </th>
            </tr>
          </thead>
          <tbody>
            {BILLING_COMPARE_ROWS.map((row) => (
              <tr
                key={row.feature}
                className="border-b border-[var(--enterprise-border-subtle)] last:border-0"
              >
                <th
                  scope="row"
                  className="px-4 py-3 font-normal text-[var(--enterprise-text)] sm:px-5"
                >
                  {row.feature}
                </th>
                <td className="px-3 py-3 text-center">
                  <Cell on={row.team} />
                </td>
                <td className="px-3 py-3 text-center">
                  <Cell on={row.pro} />
                </td>
                <td className="px-3 py-3 text-center">
                  <Cell on={row.enterprise} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
