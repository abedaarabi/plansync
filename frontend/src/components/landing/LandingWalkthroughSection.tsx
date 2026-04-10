"use client";

import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";
import { YOUTUBE_WALKTHROUGH_ID } from "./constants";
import { HeroYouTubeEmbed } from "./YouTubeEmbeds";

export function LandingWalkthroughSection() {
  return (
    <section
      id="walkthrough"
      className="landing-band-white relative scroll-mt-20 border-t border-slate-200/70 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] landing-dots"
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
        </AnimateIn>

        <AnimateIn className="mx-auto mt-14 max-w-4xl" delay={150}>
          <BrowserMockup>
            <div className="relative aspect-video bg-black">
              <HeroYouTubeEmbed />
            </div>
          </BrowserMockup>
          <p className="mt-4 text-center text-xs text-slate-500">
            <a
              href={`https://www.youtube.com/watch?v=${YOUTUBE_WALKTHROUGH_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-[var(--landing-cta)] hover:decoration-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)]"
            >
              Open on YouTube &rarr;
            </a>
          </p>
        </AnimateIn>
      </div>
    </section>
  );
}
