export const LANDING_USE_CASES = [
  {
    slug: "general-contractor-delivery",
    audience: "construction",
    linkedSolutions: ["viewer", "issues", "rfis", "schedule"] as const,
  },
  {
    slug: "subcontractor-quantity-workflow",
    audience: "construction",
    linkedSolutions: ["takeoff", "proposal", "pdf-version-control"] as const,
  },
  {
    slug: "owner-handover-and-operations",
    audience: "operations",
    linkedSolutions: ["om-handover", "om-assets", "om-maintenance"] as const,
  },
  {
    slug: "facility-team-service-operations",
    audience: "operations",
    linkedSolutions: ["om-work-orders", "om-inspections", "om-fm-dashboard"] as const,
  },
] as const;

export type LandingUseCaseSlug = (typeof LANDING_USE_CASES)[number]["slug"];

export const LANDING_CASE_STUDIES = [
  {
    slug: "harbor-residential-fast-rfi-turnaround",
    useCaseSlug: "general-contractor-delivery" as LandingUseCaseSlug,
    linkedSolutions: ["issues", "rfis", "schedule"] as const,
  },
  {
    slug: "metro-mech-estimating-cycle-reduction",
    useCaseSlug: "subcontractor-quantity-workflow" as LandingUseCaseSlug,
    linkedSolutions: ["takeoff", "proposal", "pdf-version-control"] as const,
  },
  {
    slug: "citytower-handover-to-fm",
    useCaseSlug: "owner-handover-and-operations" as LandingUseCaseSlug,
    linkedSolutions: ["om-handover", "om-assets", "om-maintenance"] as const,
  },
] as const;

export type LandingCaseStudySlug = (typeof LANDING_CASE_STUDIES)[number]["slug"];

export function getLandingUseCase(slug: string) {
  return LANDING_USE_CASES.find((item) => item.slug === slug);
}

export function isLandingUseCaseSlug(slug: string): slug is LandingUseCaseSlug {
  return LANDING_USE_CASES.some((item) => item.slug === slug);
}

export function getLandingCaseStudy(slug: string) {
  return LANDING_CASE_STUDIES.find((item) => item.slug === slug);
}

export function isLandingCaseStudySlug(slug: string): slug is LandingCaseStudySlug {
  return LANDING_CASE_STUDIES.some((item) => item.slug === slug);
}
