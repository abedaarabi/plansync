/**
 * PlanSync list prices (USD / month). Keep in sync with backend
 * `backend/src/config/listPrices.ts` (used by Stripe resolvers).
 */

export type PaidBillingPlan = "team" | "pro" | "enterprise";

/** Team — cloud collaboration (drawings, issues, RFIs, schedule). */
export const TEAM_MONTHLY_PRICE_USD = 99;
export const TEAM_INCLUDED_SEATS = 5;

/**
 * Pro — Team + takeoff, proposals, BIM viewer, clash.
 * Keep name `PRO_*` for call sites that still mean the mid paid tier.
 */
export const PRO_MONTHLY_PRICE_USD = 179;
export const PRO_INCLUDED_SEATS = 5;

/** Enterprise — Pro + Operations & Maintenance. */
export const ENTERPRISE_MONTHLY_PRICE_USD = 299;
export const ENTERPRISE_INCLUDED_SEATS = 10;

export function paidPlanLabel(plan: string | null | undefined): string | null {
  if (plan === "enterprise") return "Enterprise";
  if (plan === "pro") return "Pro";
  if (plan === "team") return "Team";
  return null;
}
