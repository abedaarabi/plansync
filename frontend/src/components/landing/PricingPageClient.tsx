"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { AnimateIn } from "./AnimateIn";
import { LandingPricingSection } from "./LandingPricingSection";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

function PricingPageInner() {
  const t = useTranslations("pricingPage");
  const goToFreeViewer = useMarketingGoToFreeViewer();

  return (
    <div className="pt-16">
      <section className="landing-band-pricing border-b border-slate-200/70 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">{t("body")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => goToFreeViewer("pricing_hero_open_viewer")}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--landing-cta)] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
              >
                {t("openViewer")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {t("startTrial")}
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>
      <LandingPricingSection
        onGoToFreeViewer={() => goToFreeViewer("pricing_compare_open_viewer")}
      />
    </div>
  );
}

export function PricingPageClient() {
  return (
    <MarketingShell>
      <PricingPageInner />
    </MarketingShell>
  );
}
