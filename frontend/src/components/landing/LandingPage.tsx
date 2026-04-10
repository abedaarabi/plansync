"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/api-client";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { LandingFaqSection } from "./LandingFaqSection";
import { LandingFeaturesSection } from "./LandingFeaturesSection";
import { LandingFinalCtaSection } from "./LandingFinalCtaSection";
import { LandingFooter } from "./LandingFooter";
import { LandingHeroSection } from "./LandingHeroSection";
import { LandingHowItWorksSection } from "./LandingHowItWorksSection";
import { LandingNav } from "./LandingNav";
import { LandingPricingSection } from "./LandingPricingSection";
import { LandingSolutionsSection } from "./LandingSolutionsSection";
import { LandingWalkthroughSection } from "./LandingWalkthroughSection";

export function LandingPage() {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();

  const { data: me } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  const blockLocalPdf = meHasProWorkspace(me ?? null);
  const isLoggedIn = !!me?.user;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  function goToFreeViewer() {
    if (blockLocalPdf) {
      router.push("/projects");
      return;
    }
    router.push("/viewer");
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen landing-atmosphere">
      <LandingNav
        scrolled={scrolled}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isLoggedIn={isLoggedIn}
        onGoToFreeViewer={goToFreeViewer}
      />

      <main>
        <LandingHeroSection
          prefersReducedMotion={prefersReducedMotion}
          onGoToFreeViewer={goToFreeViewer}
        />
        <LandingWalkthroughSection />
        <LandingHowItWorksSection />
        <LandingSolutionsSection />
        <LandingPricingSection onGoToFreeViewer={goToFreeViewer} />
        <LandingFeaturesSection onGoToFreeViewer={goToFreeViewer} />
        <LandingFaqSection />
        <LandingFinalCtaSection onGoToFreeViewer={goToFreeViewer} />
      </main>

      <LandingFooter onGoToFreeViewer={goToFreeViewer} />
    </div>
  );
}
