/**
 * In-app Plan & billing catalog (paid tiers). Prices from `productPricing`.
 */
import {
  ENTERPRISE_INCLUDED_SEATS,
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_INCLUDED_SEATS,
  PRO_MONTHLY_PRICE_USD,
  TEAM_INCLUDED_SEATS,
  TEAM_MONTHLY_PRICE_USD,
  type PaidBillingPlan,
} from "@/lib/productPricing";

export type BillingPlanCatalogEntry = {
  id: PaidBillingPlan;
  label: string;
  price: number;
  seats: number;
  extraSeatUsd: number;
  /** Short “best for” line under the price. */
  audience: string;
  features: string[];
  highlight?: boolean;
  highlightLabel?: string;
};

export const BILLING_PLAN_CATALOG: BillingPlanCatalogEntry[] = [
  {
    id: "team",
    label: "Team",
    price: TEAM_MONTHLY_PRICE_USD,
    seats: TEAM_INCLUDED_SEATS,
    extraSeatUsd: 15,
    audience: "Cloud drawings, issues, RFIs, and schedule for the whole crew.",
    features: [
      "Cloud projects & drawing storage",
      "Issues pinned on sheets",
      "RFI workflow with audit trail",
      "Project schedule",
      "PDF version control",
      "Team invites & roles",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    price: PRO_MONTHLY_PRICE_USD,
    seats: PRO_INCLUDED_SEATS,
    extraSeatUsd: 19,
    audience: "Estimating and coordination — takeoff, proposals, and BIM in one workspace.",
    features: [
      "Everything in Team",
      "Calibrated quantity takeoff",
      "Materials catalog & costing",
      "Proposals & client portal",
      "BIM / IFC viewer",
      "Clash detection",
    ],
    highlight: true,
    highlightLabel: "Most popular",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: ENTERPRISE_MONTHLY_PRICE_USD,
    seats: ENTERPRISE_INCLUDED_SEATS,
    extraSeatUsd: 25,
    audience: "Handover through operations — assets, work orders, and tenant portals.",
    features: [
      "Everything in Pro",
      "Operations & Maintenance mode",
      "Assets, work orders & vendors",
      "Maintenance & inspections",
      "Tenant / occupant portal",
      "FM dashboard & handover hub",
    ],
  },
];

/** Differentiating rows for the in-app compare strip (paid plans only). */
export const BILLING_COMPARE_ROWS: {
  feature: string;
  team: boolean;
  pro: boolean;
  enterprise: boolean;
}[] = [
  { feature: "Cloud drawings, issues & RFIs", team: true, pro: true, enterprise: true },
  { feature: "Quantity takeoff & materials", team: false, pro: true, enterprise: true },
  { feature: "Proposals & client portal", team: false, pro: true, enterprise: true },
  { feature: "BIM viewer & clash detection", team: false, pro: true, enterprise: true },
  { feature: "O&M, assets & work orders", team: false, pro: false, enterprise: true },
  { feature: "Tenant portal & inspections", team: false, pro: false, enterprise: true },
];

export function billingPlanById(id: PaidBillingPlan): BillingPlanCatalogEntry {
  return BILLING_PLAN_CATALOG.find((p) => p.id === id) ?? BILLING_PLAN_CATALOG[0]!;
}
