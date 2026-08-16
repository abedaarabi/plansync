"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { AnimateIn } from "./AnimateIn";
import { LandingHeroProductMockup } from "./LandingHeroProductMockup";
import { DEMO_MAILTO } from "./landingGsap";

type LandingHeroSectionProps = {
  onGoToFreeViewer: (source?: string) => void;
};

export function LandingHeroSection({ onGoToFreeViewer }: LandingHeroSectionProps) {
  const t = useTranslations("hero");
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section
      id="hero"
      className="relative isolate min-h-dvh scroll-mt-20 overflow-hidden pt-28 pb-12 sm:pt-32 sm:pb-16 lg:flex lg:items-center lg:py-20"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {prefersReducedMotion ? (
          <Image
            src="/images/cta/CTA-constraction-hero.webp"
            alt=""
            fill
            sizes="100vw"
            className="landing-photo-soft object-cover object-[center_36%]"
            priority
            quality={75}
          />
        ) : (
          <video
            className="landing-photo-soft h-full w-full object-cover object-[center_36%]"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/cta/CTA-constraction-hero.webp"
            aria-hidden
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,18,32,0.58)_0%,rgba(11,18,32,0.74)_42%,rgba(11,18,32,0.96)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_52%,rgba(37,99,235,0.18)_100%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <AnimateIn instant>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
            <div className="order-1 text-center lg:text-left">
              <p className="mb-5 text-[1.65rem] font-bold tracking-tight text-white sm:text-[1.85rem]">
                Plan<span className="text-[var(--landing-cta)]">Sync</span>
              </p>

              <p className="landing-type-label mb-4 inline-flex items-center rounded-md border border-white/18 bg-white/8 px-3 py-1.5 text-sky-100">
                {t("eyebrow")}
              </p>

              <h1 className="text-balance text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.035em] text-white sm:text-[2.35rem] lg:max-w-[15ch] lg:text-[2.55rem]">
                {t("title")}
              </h1>

              <p className="mx-auto mt-4 max-w-[42ch] text-[1.02rem] font-normal leading-[1.65] text-slate-200/90 sm:mt-5 sm:text-[1.06rem] lg:mx-0">
                {t("sub")}
              </p>

              <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                <Link
                  href="/sign-in"
                  onClick={() =>
                    trackMarketingEvent("marketing_cta_click", {
                      ctaType: "explore_plansync",
                      source: "hero_primary",
                      destination: "/sign-in",
                    })
                  }
                  className="landing-btn-primary"
                >
                  {t("explore")}
                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                </Link>
                <a
                  href="#workflow"
                  className="landing-type-nav px-2 py-2 text-slate-200 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t("seeHow")}
                </a>
              </div>

              <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center lg:justify-start">
                <a
                  href={DEMO_MAILTO}
                  onClick={() =>
                    trackMarketingEvent("marketing_cta_click", {
                      ctaType: "book_demo",
                      source: "hero_demo",
                      destination: "mailto",
                    })
                  }
                  className="landing-type-caption text-slate-400 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t("bookDemo")}
                </a>
                <span className="hidden text-slate-600 sm:inline" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onGoToFreeViewer("hero_open_pdf")}
                  className="landing-type-caption text-slate-400 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t("openPdf")}
                </button>
              </div>

              <p className="landing-type-caption mt-6 text-slate-400 lg:text-start">
                {t("audienceLine")}
              </p>
            </div>

            <div className="relative order-2 mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
              <LandingHeroProductMockup />
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
