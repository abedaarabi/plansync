"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { getHeroExperimentVariant, type HeroExperimentVariant } from "@/lib/marketingExperiments";
import { AnimateIn } from "./AnimateIn";

type LandingHeroSectionProps = {
  prefersReducedMotion: boolean;
  onGoToFreeViewer: (source?: string) => void;
};

const TRUST_NAMES = ["NORTHRIDGE BUILD", "MECHANICA PRO", "HARBOR FM"] as const;

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
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 xl:gap-16">
            {/* Copy first on mobile so CTAs stay above the fold */}
            <div className="order-1 text-center lg:text-left">
              <p className="landing-type-label mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] bg-[color-mix(in_srgb,var(--landing-cta)_14%,rgba(15,23,42,0.5))] px-4 py-1.5 text-blue-100 shadow-sm backdrop-blur-md lg:inline-flex">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--landing-cta) opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-(--landing-cta)" />
                </span>
                {t("eyebrow")}
              </p>

              <h1 className="text-balance text-[2.35rem] font-bold leading-[1.06] tracking-tight text-white sm:text-[3.05rem] lg:max-w-[16ch] lg:text-[3.35rem] lg:leading-[1.05]">
                {t("title")}
              </h1>

              <p className="mx-auto mt-5 max-w-[58ch] text-[1.04rem] leading-relaxed text-blue-100/85 sm:mt-6 sm:text-[1.12rem] lg:mx-0 lg:max-w-[48ch] lg:text-[1.15rem]">
                {heroSub}
              </p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
                <button
                  type="button"
                  onClick={() => onGoToFreeViewer("hero_primary_cta")}
                  className="landing-type-nav btn-shine relative inline-flex min-h-13 flex-1 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-(--landing-cta) px-8 py-3.5 font-semibold text-(--landing-cta-text) shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)] transition hover:bg-(--landing-cta-bright) hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] sm:flex-none sm:px-9"
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
                  className="landing-type-nav inline-flex min-h-13 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/5 px-8 py-3.5 font-semibold text-white shadow-sm backdrop-blur-sm transition hover:border-white/65 hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:flex-none sm:px-9"
                >
                  {t("startTrial")}
                </Link>
              </div>

              <div className="landing-type-caption mt-5 flex flex-wrap items-center justify-center gap-2.5 text-blue-100/90 lg:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  {t("chipNoSignup")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1.5">
                  <Users2 className="h-3.5 w-3.5 text-sky-300" />
                  {t("chipAudience")}
                </span>
              </div>

              <p className="landing-type-caption mt-4 text-blue-100/65 lg:text-start">
                {t("trustLine")} <span className="text-blue-50/80">{TRUST_NAMES.join(" · ")}</span>
              </p>
            </div>

            <div className="relative order-2 mx-auto w-full max-w-md sm:max-w-lg lg:mx-0 lg:max-w-xl lg:justify-self-end">
              <div
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,255,255,0.1),transparent_65%)] blur-2xl"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.5)] ring-1 ring-white/12">
                <div className="relative aspect-16/10 w-full max-sm:aspect-16/11">
                  <Image
                    src="/images/measure.png"
                    alt={t("heroImageAlt")}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 90vw, 520px"
                    priority
                    quality={82}
                  />
                </div>
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
