"use client";

export type MarketingKpiKey =
  | "landingTrialClickRate"
  | "landingFreeViewerClickRate"
  | "pricingToTrialClickRate"
  | "caseStudyToTrialClickRate"
  | "marketingBounceRate";

export type MarketingKpiTarget = {
  key: MarketingKpiKey;
  label: string;
  baseline: number;
  target: number;
  unit: "%" | "seconds";
};

/**
 * Baselines/targets for redesign rollout.
 * Update baselines after first post-release analytics export.
 */
export const MARKETING_KPI_TARGETS: MarketingKpiTarget[] = [
  {
    key: "landingTrialClickRate",
    label: "Homepage to trial CTA click-through",
    baseline: 2.8,
    target: 5.5,
    unit: "%",
  },
  {
    key: "landingFreeViewerClickRate",
    label: "Homepage to free viewer CTA click-through",
    baseline: 8.9,
    target: 13,
    unit: "%",
  },
  {
    key: "pricingToTrialClickRate",
    label: "Pricing page trial CTA click-through",
    baseline: 5.1,
    target: 8.5,
    unit: "%",
  },
  {
    key: "caseStudyToTrialClickRate",
    label: "Case study to trial CTA click-through",
    baseline: 1.2,
    target: 3.2,
    unit: "%",
  },
  {
    key: "marketingBounceRate",
    label: "Marketing bounce rate",
    baseline: 58,
    target: 42,
    unit: "%",
  },
];

export type MarketingEventName =
  | "marketing_page_view"
  | "marketing_cta_click"
  | "marketing_pricing_interaction"
  | "marketing_case_study_engagement"
  | "marketing_use_case_engagement";

type MarketingEventPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, unknown>) => void;
    };
  }
}

export function trackMarketingEvent(
  eventName: MarketingEventName,
  payload?: MarketingEventPayload,
) {
  if (typeof window === "undefined" || !window.umami) return;
  window.umami.track(eventName, payload);
}
