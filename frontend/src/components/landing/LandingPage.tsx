"use client";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { LandingFaqSection } from "./LandingFaqSection";
import { LandingFeaturesIntroSection } from "./LandingFeaturesIntroSection";
import { LandingFinalCtaSection } from "./LandingFinalCtaSection";
import { LandingHeroSection } from "./LandingHeroSection";
import { LandingHowItWorksSection } from "./LandingHowItWorksSection";
import { LandingPricingSection } from "./LandingPricingSection";
import { LandingWalkthroughSection } from "./LandingWalkthroughSection";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

function LandingHomeMain() {
  const goToFreeViewer = useMarketingGoToFreeViewer();
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <>
      <LandingHeroSection
        prefersReducedMotion={prefersReducedMotion}
        onGoToFreeViewer={goToFreeViewer}
      />
      <LandingWalkthroughSection />
      <LandingHowItWorksSection />
      <LandingPricingSection onGoToFreeViewer={goToFreeViewer} />
      <LandingFeaturesIntroSection />
      <LandingFaqSection />
      <LandingFinalCtaSection onGoToFreeViewer={goToFreeViewer} />
    </>
  );
}

export function LandingPage() {
  return (
    <MarketingShell>
      <LandingHomeMain />
    </MarketingShell>
  );
}
