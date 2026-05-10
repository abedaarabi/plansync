"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { getHeroExperimentVariant, type HeroExperimentVariant } from "@/lib/marketingExperiments";
import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";
import { LandingHeroDemoVideo } from "./YouTubeEmbeds";

type LandingHeroSectionProps = {
  prefersReducedMotion: boolean;
  onGoToFreeViewer: (source?: string) => void;
};

const STAT_KEYS = [
  { valueKey: "stat1Value" as const, labelKey: "stat1Label" as const },
  { valueKey: "stat2Value" as const, labelKey: "stat2Label" as const },
  { valueKey: "stat3Value" as const, labelKey: "stat3Label" as const },
];

export function LandingHeroSection({
  prefersReducedMotion,
  onGoToFreeViewer,
}: LandingHeroSectionProps) {
  const t = useTranslations("hero");
  const [heroVariant, setHeroVariant] = useState<HeroExperimentVariant>("control");

  useEffect(() => {
    const assigned = getHeroExperimentVariant();
    setHeroVariant(assigned);
    trackMarketingEvent("marketing_page_view", {
      path: window.location.pathname,
      experiment: "hero_message_v1",
      variant: assigned,
    });
  }, []);

  const heroSub = heroVariant === "value-first" ? t("subValueFirst") : t("sub");

  return (
    <section
      id="hero"
      className="relative isolate min-h-dvh scroll-mt-20 overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20 lg:flex lg:items-center lg:py-24 xl:py-28"
    >
      {/* ── Video / static background ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {prefersReducedMotion ? (
          <Image
            src="/images/cta/CTA-constraction-hero.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[center_36%]"
            priority
            quality={75}
          />
        ) : (
          <video
            className="h-full w-full object-cover object-[center_36%]"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/cta/CTA-constraction-hero.webp"
            aria-hidden
          >
            <source src="/hero.webm" type="video/webm" />
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        )}
      </div>

      {/* ── Overlays ── */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.35)_0%,rgba(15,23,42,0.55)_38%,rgba(15,23,42,0.72)_62%,rgba(2,6,23,0.92)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_45%,rgba(37,99,235,0.08)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.18),inset_0_-100px_150px_rgba(0,0,0,0.38)]"
        aria-hidden
      />
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <AnimateIn instant>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 xl:gap-16">
            <div className="text-center lg:text-left">
              {/* Eyebrow badge */}
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] bg-[color-mix(in_srgb,var(--landing-cta)_14%,rgba(15,23,42,0.5))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100 shadow-sm backdrop-blur-md lg:inline-flex">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--landing-cta) opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-(--landing-cta)" />
                </span>
                {t("eyebrow")}
              </p>

              {/* Headline */}
              <h1 className="text-balance text-[2.35rem] font-bold leading-[1.06] tracking-tight text-white sm:text-[3.05rem] lg:max-w-[13ch] lg:text-[3.35rem] lg:leading-[1.05]">
                {t("title")}
              </h1>

              {/* Sub-copy */}
              <p className="mx-auto mt-6 max-w-[58ch] text-[1.04rem] leading-relaxed text-blue-100/85 sm:mt-7 sm:text-[1.12rem] lg:mx-0 lg:max-w-[52ch] lg:text-[1.18rem]">
                {heroSub}
              </p>

              {/* CTAs */}
              <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
                <button
                  type="button"
                  onClick={() => onGoToFreeViewer("hero_primary_cta")}
                  className="btn-shine relative inline-flex min-h-13 flex-1 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-(--landing-cta) px-8 py-3.5 text-[0.96rem] font-semibold text-(--landing-cta-text) shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)] transition hover:bg-(--landing-cta-bright) hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] sm:flex-none sm:px-9"
                >
                  {t("openViewer")}
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
                <Link
                  href="/sign-in"
                  onClick={() =>
                    trackMarketingEvent("marketing_cta_click", {
                      ctaType: "start_trial",
                      source: "hero_secondary_trial",
                      destination: "/sign-in",
                      variant: heroVariant,
                    })
                  }
                  className="inline-flex min-h-13 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white/80 bg-white/8 px-8 py-3.5 text-[0.96rem] font-semibold text-white shadow-sm backdrop-blur-sm transition hover:border-white hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:flex-none sm:px-9"
                >
                  {t("startTrial")}
                </Link>
              </div>

              {/* Stat chips */}
              <div className="mt-9 flex flex-wrap items-stretch justify-center gap-3 lg:justify-start">
                {STAT_KEYS.map((chip) => (
                  <div
                    key={chip.labelKey}
                    className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.07] px-5 py-3 text-center backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10 sm:items-start sm:text-left"
                  >
                    <span className="text-base font-bold text-white">{t(chip.valueKey)}</span>
                    <span className="text-[11px] font-medium text-blue-200/60">
                      {t(chip.labelKey)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none lg:ps-3">
              <div
                className="pointer-events-none absolute -inset-4 rounded-4xl bg-[radial-gradient(ellipse_at_50%_30%,rgba(59,130,246,0.22),transparent_58%)] blur-2xl sm:-inset-6"
                aria-hidden
              />
              <div className="relative lg:-rotate-[0.65deg]">
                <BrowserMockup
                  variant="elevated"
                  className="shadow-[0_32px_90px_-16px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-white/12"
                >
                  <LandingHeroDemoVideo />
                </BrowserMockup>
              </div>
              <div className="pointer-events-none absolute -bottom-4 -left-3 hidden rounded-lg border border-white/20 bg-slate-950/55 px-3 py-2 text-[11px] font-medium text-blue-100/80 backdrop-blur-md lg:block">
                Live product walkthrough
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
