"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateIn } from "./AnimateIn";

export function LandingFeaturesIntroSection() {
  return (
    <section
      id="features"
      className="landing-band-features relative scroll-mt-20 border-t border-slate-200/60 py-20 sm:py-28"
    >
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <AnimateIn>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            Features
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built for construction professionals
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Every tool you need to manage drawings, issues, RFIs, takeoff, and operations — each
            with a dedicated overview you can share with your team.
          </p>
          <Link
            href="/solutions"
            className="btn-shine relative mt-8 inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_35%,transparent)] transition hover:bg-[var(--landing-cta-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)] focus-visible:ring-offset-2"
          >
            Browse all solutions
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </AnimateIn>
      </div>
    </section>
  );
}
