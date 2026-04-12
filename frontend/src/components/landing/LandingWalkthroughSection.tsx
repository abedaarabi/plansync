"use client";

import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";
import { YOUTUBE_WALKTHROUGH_ID } from "./constants";
import { HeroYouTubeEmbed } from "./YouTubeEmbeds";

export function LandingWalkthroughSection() {
  return (
    <section
      id="walkthrough"
      className="relative scroll-mt-20 overflow-hidden border-t border-[color-mix(in_srgb,var(--landing-cta)_20%,#e2e8f0)] py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--landing-cta)_14%,#f8fafc)] via-white to-[color-mix(in_srgb,var(--landing-cta)_08%,#f1f5f9)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[min(28rem,75vw)] w-[min(48rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--landing-cta)_22%,transparent)_0%,transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
        aria-hidden
      />

      <div className="relative mx-auto max-w-5xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            Walkthrough
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            See PlanSync in action
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Watch a 2-minute overview — open a PDF, calibrate, measure, and mark up. No editing,
            just the real workflow.
          </p>
          <div className="mt-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_28%,#e2e8f0)] bg-[color-mix(in_srgb,var(--landing-cta)_08%,white)] px-4 py-1.5 text-xs font-semibold text-[var(--landing-cta)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_12%,transparent)]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--landing-cta)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--landing-cta)_25%,transparent)]"
                aria-hidden
              />
              About 2 minutes
            </span>
          </div>
        </AnimateIn>

        <AnimateIn className="mx-auto mt-14 max-w-4xl" delay={150}>
          <div className="relative">
            <div
              className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-[color-mix(in_srgb,var(--landing-cta)_35%,#dbeafe)] via-[color-mix(in_srgb,var(--landing-cta)_12%,#eff6ff)] to-[color-mix(in_srgb,var(--landing-cta)_28%,#e0e7ff)] opacity-90 blur-2xl sm:-inset-4"
              aria-hidden
            />
            <div className="relative rounded-[1.35rem] bg-gradient-to-br from-[color-mix(in_srgb,var(--landing-cta)_22%,#e2e8f0)] via-[color-mix(in_srgb,var(--landing-cta)_12%,#f1f5f9)] to-[color-mix(in_srgb,var(--landing-cta)_20%,#e2e8f0)] p-[3px] shadow-[0_28px_64px_-20px_color-mix(in_srgb,var(--landing-cta)_25%,transparent),var(--enterprise-shadow-card)] sm:p-1 sm:rounded-3xl">
              <div className="overflow-hidden rounded-[1.2rem] bg-white sm:rounded-[1.35rem]">
                <BrowserMockup className="rounded-none border-0 shadow-none ring-0">
                  <div className="relative aspect-video bg-slate-950">
                    <HeroYouTubeEmbed />
                  </div>
                </BrowserMockup>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            <a
              href={`https://www.youtube.com/watch?v=${YOUTUBE_WALKTHROUGH_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-[color-mix(in_srgb,var(--landing-cta)_08%,white)] hover:text-[var(--landing-cta)]"
            >
              Open on YouTube
              <span className="text-[var(--landing-cta)]" aria-hidden>
                →
              </span>
            </a>
          </p>
        </AnimateIn>
      </div>
    </section>
  );
}
