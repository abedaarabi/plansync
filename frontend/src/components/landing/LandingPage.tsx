"use client";

import { useEffect, useState } from "react";
import { LandingCapabilitiesStrip } from "./LandingCapabilitiesStrip";
import { LandingChatAssistant } from "./LandingChatAssistant";
import { LandingDataCenterSystemsSection } from "./LandingDataCenterSystemsSection";
import { LandingFaqSection } from "./LandingFaqSection";
import { LandingFinalCtaSection } from "./LandingFinalCtaSection";
import { LandingHandoverSection } from "./LandingHandoverSection";
import { LandingHeroSection } from "./LandingHeroSection";
import { LandingPlatformLayersSection } from "./LandingPlatformLayersSection";
import { LandingProblemSection } from "./LandingProblemSection";
import { LandingReadinessSection } from "./LandingReadinessSection";
import { LandingSignatureWorkflowSection } from "./LandingSignatureWorkflowSection";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

function LandingHomeMain() {
  const goToFreeViewer = useMarketingGoToFreeViewer();

  return (
    <>
      <LandingHeroSection onGoToFreeViewer={goToFreeViewer} />
      <LandingProblemSection />
      <LandingPlatformLayersSection />
      <LandingSignatureWorkflowSection />
      <LandingDataCenterSystemsSection />
      <LandingReadinessSection />
      <LandingHandoverSection />
      <LandingCapabilitiesStrip />
      <LandingFaqSection />
      <LandingFinalCtaSection onGoToFreeViewer={goToFreeViewer} />
    </>
  );
}

export function LandingPage() {
  const [showChatAssistant, setShowChatAssistant] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowChatAssistant(true), 1600);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <MarketingShell>
      <div className="landing-home min-h-dvh">
        <LandingHomeMain />
        {showChatAssistant ? <LandingChatAssistant /> : null}
      </div>
    </MarketingShell>
  );
}
