"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateIn } from "./AnimateIn";

type LandingFinalCtaSectionProps = {
  onGoToFreeViewer: () => void;
};

export function LandingFinalCtaSection({ onGoToFreeViewer }: LandingFinalCtaSectionProps) {
  return (
    <section
      id="cta"
      className="relative isolate scroll-mt-20 min-h-[26rem] overflow-hidden border-t border-white/[0.06] sm:min-h-[30rem]"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/images/cta/CTA-constraction-hero.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_32%] sm:object-[center_30%]"
          loading="lazy"
          fetchPriority="low"
          quality={75}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.2)_0%,rgba(15,23,42,0.28)_22%,rgba(15,23,42,0.42)_45%,rgba(15,23,42,0.78)_72%,rgba(2,6,23,0.97)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_52%,rgba(37,99,235,0.14)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.2),inset_0_-100px_140px_rgba(0,0,0,0.55)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center sm:px-8 sm:py-32 md:py-36">
        <AnimateIn>
          <h2 className="text-3xl font-bold tracking-tight text-blue-50 drop-shadow-[0_1px_20px_rgba(37,99,235,0.2)] sm:text-4xl">
            Start for free today
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-blue-100/85">
            Open the free viewer in seconds — no signup needed.
            <br />
            Upgrade to Pro when your team is ready.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onGoToFreeViewer}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--landing-cta)] px-7 py-3.5 text-base font-semibold text-[var(--landing-cta-text)] shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] transition hover:bg-[var(--landing-cta-bright)] hover:shadow-[color-mix(in_srgb,var(--landing-cta)_38%,transparent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Open free viewer <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/90 bg-white/[0.07] px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Start Pro Trial
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-blue-200/70">
            <span>No installation</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>No credit card</span>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
