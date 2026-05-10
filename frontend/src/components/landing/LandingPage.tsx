"use client";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { LandingFaqSection } from "./LandingFaqSection";
import { LandingFinalCtaSection } from "./LandingFinalCtaSection";
import { LandingChatAssistant } from "./LandingChatAssistant";
import { LandingHeroSection } from "./LandingHeroSection";
import { LandingHowItWorksSection } from "./LandingHowItWorksSection";
import { LandingPwaInstallSection } from "./LandingPwaInstallSection";
import { LandingPricingSection } from "./LandingPricingSection";
import { LandingProofSection } from "./LandingProofSection";
import { LandingSolutionsShowcaseSection } from "./LandingSolutionsShowcaseSection";
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
      <LandingProofSection />
      <LandingSolutionsShowcaseSection />
      <LandingHowItWorksSection />
      <LandingPricingSection onGoToFreeViewer={goToFreeViewer} />
      <LandingPwaInstallSection />
      <LandingFaqSection />
      <LandingFinalCtaSection onGoToFreeViewer={goToFreeViewer} />
    </>
  );
}

export function LandingPage() {
  return (
    <MarketingShell>
      <LandingHomeMain />
      <LandingChatAssistant />
    </MarketingShell>
  );
}
