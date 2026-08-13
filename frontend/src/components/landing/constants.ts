export const YOUTUBE_PLAN_VIEWER_ID = "aMiDXOnUJOA";
export const YOUTUBE_BIM_VIEWER_ID = "xb31sYZH-ms";
/** PlanSync collision / clash detection walkthrough. */
export const YOUTUBE_CLASH_DETECTION_ID = "xb31sYZH-ms";
export const YOUTUBE_PDF_VERSION_CONTROL_ID = "4DnCFziN66o";

export const FREE_FEATURES = [
  "Open any PDF",
  "Calibrate scale",
  "Measure & markup",
  "Annotate drawings",
  "Export marked PDF",
  "Works offline",
  "Files never leave device",
];

export const TEAM_FEATURES = [
  "Everything in Free",
  "Cloud storage 20GB",
  "Team collaboration",
  "Issues on drawings",
  "RFIs workflow",
  "PDF version control",
  "Project schedule",
];

export const PRO_FEATURES = [
  "Everything in Team",
  "Quantity takeoff",
  "Proposals & client portal",
  "BIM / IFC viewer",
  "Clash detection",
  "Punch lists & field reports",
];

export const ENTERPRISE_FEATURES = [
  "Everything in Pro",
  "Operations & Maintenance mode",
  "Handover, assets & work orders",
  "Maintenance schedules & inspections",
  "Tenant portal",
  "FM dashboard",
];

/** MaintainX-style comparison rows: feature label + availability per plan. */
export type PricingCompareCell = "yes" | "no" | "limited" | string;

export type PricingCompareRow = {
  feature: string;
  free: PricingCompareCell;
  team: PricingCompareCell;
  pro: PricingCompareCell;
  enterprise: PricingCompareCell;
};

export const PRICING_COMPARE_ROWS: PricingCompareRow[] = [
  {
    feature: "Local PDF viewer (no signup)",
    free: "yes",
    team: "yes",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Measure, markup & export",
    free: "yes",
    team: "yes",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Cloud projects & storage",
    free: "no",
    team: "yes",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Issues on drawings",
    free: "no",
    team: "yes",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "RFI workflow",
    free: "no",
    team: "yes",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Project schedule",
    free: "no",
    team: "yes",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Quantity takeoff",
    free: "no",
    team: "no",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Proposals & client portal",
    free: "no",
    team: "no",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "BIM / IFC viewer",
    free: "no",
    team: "no",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "Clash detection",
    free: "no",
    team: "no",
    pro: "yes",
    enterprise: "yes",
  },
  {
    feature: "O&M / assets / work orders",
    free: "no",
    team: "no",
    pro: "no",
    enterprise: "yes",
  },
  {
    feature: "Maintenance & inspections",
    free: "no",
    team: "no",
    pro: "no",
    enterprise: "yes",
  },
  {
    feature: "Tenant / occupant portal",
    free: "no",
    team: "no",
    pro: "no",
    enterprise: "yes",
  },
  {
    feature: "Seats included",
    free: "—",
    team: "5",
    pro: "5",
    enterprise: "10",
  },
];
