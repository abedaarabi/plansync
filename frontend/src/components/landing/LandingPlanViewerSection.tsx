"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Ruler } from "lucide-react";
import { AnimateIn } from "./AnimateIn";
import { YOUTUBE_PLAN_VIEWER_ID } from "./constants";
import { useMarketingGoToFreeViewer } from "./MarketingShell";
import { LandingYoutubeFacade } from "./YouTubeEmbeds";

const BULLETS = ["bullet1", "bullet2", "bullet3"] as const;

function BulletCheck() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-(--landing-cta)"
      fill="none"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path
        d="M5 8.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LandingPlanViewerSection() {
  const t = useTranslations("planViewerShowcase");
  const goToFreeViewer = useMarketingGoToFreeViewer();

  return (
    <section
      id="plan-viewer"
      className="landing-atmosphere relative scroll-mt-20 overflow-hidden border-t border-slate-200/70 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-300/60 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateIn className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-[2rem] font-bold tracking-tight text-slate-900 sm:text-[2.55rem] sm:leading-[1.1]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[1rem] leading-relaxed text-slate-600 sm:text-[1.08rem]">
            {t("body")}
          </p>
        </AnimateIn>

        <AnimateIn
          delay={60}
          className="mt-14 grid items-center gap-10 sm:mt-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:gap-12"
        >
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-4 rounded-4xl bg-[radial-gradient(ellipse_at_50%_40%,color-mix(in_srgb,var(--landing-cta)_18%,transparent),transparent_65%)] blur-2xl"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 shadow-[0_28px_65px_-18px_rgba(15,23,42,0.2),0_0_0_1px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
              <LandingYoutubeFacade
                videoId={YOUTUBE_PLAN_VIEWER_ID}
                title={t("videoTitle")}
                playAriaLabel={t("playAriaLabel")}
                posterAlt={t("videoPosterAlt")}
                posterSrc="/images/calibrate.png"
                playButtonId="plan-viewer-play"
              />
            </div>
            <p className="landing-type-caption mt-3 text-center text-slate-500 lg:text-start">
              {t("videoMeta")}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200/75 bg-white p-7 shadow-[0_24px_48px_-20px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/3 sm:p-8">
            <div className="flex items-start gap-3.5">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25"
                aria-hidden
              >
                <Ruler className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700/90">
                  {t("label")}
                </p>
                <h3 className="mt-1.5 text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-[1.55rem]">
                  {t("featureTitle")}
                </h3>
              </div>
            </div>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-slate-600 sm:text-[1.02rem]">
              {t("featureBody")}
            </p>
            <ul className="mt-5 flex flex-col gap-3">
              {BULLETS.map((key) => (
                <li key={key} className="flex gap-3">
                  <BulletCheck />
                  <span className="text-sm leading-relaxed text-slate-600">{t(key)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => goToFreeViewer("plan_viewer_showcase")}
                className="landing-btn-primary w-full sm:w-auto"
              >
                {t("cta")}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
                onClick={() => document.getElementById("plan-viewer-play")?.click()}
              >
                {t("ctaSecondary")}
              </button>
            </div>
            <p className="mt-2.5 text-sm text-slate-500">{t("ctaHint")}</p>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
