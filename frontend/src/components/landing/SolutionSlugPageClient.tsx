"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { BrandStoryPanel, MarketingHeroBackdrop } from "@/components/BrandStoryPanel";
import type { SolutionSlug } from "@/lib/landingContent";
import { LANDING_SOLUTIONS } from "@/lib/landingContent";
import { SOLUTION_ICONS } from "./solutionIcons";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";
import { SolutionFeatureDetail } from "./SolutionFeatureDetail";

type SolutionSlugPageClientProps = {
  slug: SolutionSlug;
};

function SolutionSlugInner({ slug }: SolutionSlugPageClientProps) {
  const goToFreeViewer = useMarketingGoToFreeViewer();
  const solution = LANDING_SOLUTIONS.find((s) => s.slug === slug)!;
  const Icon = SOLUTION_ICONS[slug];

  return (
    <div className="pt-16 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-stretch">
      <BrandStoryPanel backHref="/solutions" backLabel="← All solutions" stickyOnLarge />

      <div className="relative min-w-0 bg-[var(--enterprise-auth-bg)] lg:min-h-[calc(100dvh-4rem)]">
        <MarketingHeroBackdrop />

        <div className="relative z-10">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0F172A] px-4 py-2 lg:hidden">
            <Link
              href="/solutions"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200 ring-1 ring-white/[0.06] transition hover:border-white/15 hover:bg-white/[0.1] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              All solutions
            </Link>
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 ring-1 ring-white/[0.06]"
            >
              <Image
                src="/logo.svg"
                alt="PlanSync"
                width={28}
                height={28}
                className="h-7 w-7"
                priority
                unoptimized
              />
            </Link>
          </div>

          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <AnimateIn>
              <div
                className="relative overflow-hidden border border-slate-200/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8 lg:p-10"
                style={{ borderRadius: "16px" }}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--landing-cta)] to-transparent opacity-80"
                  aria-hidden
                />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                  Solution
                </p>
                <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--landing-cta)_12%,white)] text-[var(--landing-cta)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_24%,transparent)] lg:h-20 lg:w-20"
                    aria-hidden
                  >
                    <Icon className="h-8 w-8 lg:h-9 lg:w-9" strokeWidth={1.65} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
                      {solution.title}
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                      {solution.description}
                    </p>
                    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                      {solution.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3.5 text-sm leading-relaxed text-slate-700 sm:text-[15px]"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-cta)]"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </AnimateIn>
          </div>

          <section className="landing-band-features relative border-t border-slate-200/60 py-16 sm:py-24">
            <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
              <p className="mb-10 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                In depth
              </p>
              <SolutionFeatureDetail
                slug={slug}
                onGoToFreeViewer={goToFreeViewer}
                className="mt-0"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SolutionSlugPageClient({ slug }: SolutionSlugPageClientProps) {
  return (
    <MarketingShell>
      <SolutionSlugInner slug={slug} />
    </MarketingShell>
  );
}
