"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";
import { LandingHeroDemoVideo } from "./YouTubeEmbeds";

type LandingHeroSectionProps = {
  prefersReducedMotion: boolean;
  onGoToFreeViewer: () => void;
};

export function LandingHeroSection({
  prefersReducedMotion,
  onGoToFreeViewer,
}: LandingHeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative isolate min-h-dvh scroll-mt-20 overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20 lg:flex lg:items-center lg:py-24 xl:py-28"
    >
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
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.3)_0%,rgba(15,23,42,0.52)_38%,rgba(15,23,42,0.68)_62%,rgba(2,6,23,0.88)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_45%,rgba(37,99,235,0.1)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.22),inset_0_-100px_150px_rgba(0,0,0,0.42)]"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <AnimateIn instant>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-14">
            <div className="text-center lg:text-left">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_35%,transparent)] bg-[color-mix(in_srgb,var(--landing-cta)_12%,rgba(15,23,42,0.55))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100 shadow-sm backdrop-blur-md lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--landing-cta)]" aria-hidden />
                Plans · issues · RFIs · one system
              </p>
              <h1 className="text-balance text-4xl font-bold leading-[1.12] tracking-tight text-blue-50 sm:text-5xl lg:text-[52px] lg:leading-[1.06]">
                Plans, issues, and RFIs —{" "}
                <span className="text-blue-200 [text-shadow:0_1px_28px_rgba(37,99,235,0.45)]">
                  one source of truth
                </span>{" "}
                for your team
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-blue-100/88 sm:mt-8 sm:text-xl lg:mx-0">
                Everyone works from the same drawings. Field issues and formal RFIs stay tied to the
                plan — not buried in email. Start free in your browser; upgrade when your team needs
                the cloud.
              </p>

              <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
                <button
                  type="button"
                  onClick={onGoToFreeViewer}
                  className="btn-shine relative inline-flex min-h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] px-8 py-3.5 text-base font-semibold text-[var(--landing-cta-text)] shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)] transition hover:bg-[var(--landing-cta-bright)] hover:shadow-xl hover:shadow-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] sm:flex-none sm:px-9"
                >
                  Open free viewer <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
                <Link
                  href="/sign-in"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white/90 bg-white/[0.07] px-8 py-3.5 text-base font-semibold text-white shadow-sm backdrop-blur-sm transition hover:border-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:flex-none sm:px-9"
                >
                  Start Pro Trial
                </Link>
              </div>

              <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-blue-200/75 lg:justify-start">
                <span>No installation</span>
                <span className="hidden text-blue-400/45 sm:inline" aria-hidden>
                  &middot;
                </span>
                <span>No credit card</span>
                <span className="hidden text-blue-400/45 sm:inline" aria-hidden>
                  &middot;
                </span>
                <span>Works in your browser</span>
              </p>
            </div>

            <div className="mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
              <BrowserMockup className="shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
                <LandingHeroDemoVideo />
              </BrowserMockup>
              <p className="mt-3 text-center text-xs leading-relaxed text-blue-200/75 lg:text-left">
                The viewer in motion — open a PDF, calibrate scale, measure, and mark up. Same
                workflow your team uses in Pro.
              </p>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
