"use client";

import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";
import { YOUTUBE_WALKTHROUGH_ID } from "./constants";
import { HeroYouTubeEmbed } from "./YouTubeEmbeds";

export function LandingWalkthroughSection() {
  return (
    <section
      id="walkthrough"
      className="relative scroll-mt-20 overflow-hidden border-t border-slate-200/70 bg-linear-to-b from-white via-slate-50/40 to-slate-100/50 py-28 sm:py-36"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_srgb,var(--landing-cta)_12%,transparent),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
        aria-hidden
      />

      <div className="relative mx-auto max-w-5xl px-6">
        <AnimateIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--landing-cta)">
            Walkthrough
          </p>
          <h2 className="mt-4 text-pretty text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl sm:leading-tight">
            See PlanSync in action
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-[17px] sm:leading-relaxed">
            A short overview — open a PDF, calibrate, measure, and mark up. No staged edits: the
            same flow your team runs on site.
          </p>
          <div className="mt-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/3">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--landing-cta) shadow-[0_0_0_4px_color-mix(in_srgb,var(--landing-cta)_18%,transparent)]"
                aria-hidden
              />
              About 2 minutes
            </span>
          </div>
        </AnimateIn>

        <AnimateIn className="mx-auto mt-14 max-w-4xl sm:mt-16" delay={120}>
          <div className="relative rounded-3xl border border-slate-200/90 bg-white p-1.5 shadow-[0_32px_64px_-28px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.025)] ring-1 ring-slate-900/2 sm:p-2">
            <BrowserMockup
              variant="elevated"
              className="overflow-hidden rounded-2xl border-0 shadow-none ring-0 sm:rounded-[1.35rem]"
            >
              <div className="relative aspect-video bg-slate-950">
                <HeroYouTubeEmbed />
              </div>
            </BrowserMockup>
          </div>
          <p className="mt-6 text-center">
            <a
              href={`https://www.youtube.com/watch?v=${YOUTUBE_WALKTHROUGH_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
            >
              Open on YouTube
              <span className="text-(--landing-cta)" aria-hidden>
                →
              </span>
            </a>
          </p>
        </AnimateIn>
      </div>
    </section>
  );
}
