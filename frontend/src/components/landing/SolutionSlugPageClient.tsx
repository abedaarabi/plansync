"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { MarketingHeroBackdrop } from "@/components/BrandStoryPanel";
import type { SolutionSlug } from "@/lib/landingContent";
import { LANDING_SOLUTIONS, SOLUTION_CATEGORIES } from "@/lib/landingContent";
import { SOLUTION_ICON_COLORS, SOLUTION_ICONS } from "./solutionIcons";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";
import { SolutionFeatureDetail } from "./SolutionFeatureDetail";
import { SolutionVisualPlaceholder } from "./SolutionVisualPlaceholder";

type SolutionSlugPageClientProps = {
  slug: SolutionSlug;
};

function SolutionSlugInner({ slug }: SolutionSlugPageClientProps) {
  const goToFreeViewer = useMarketingGoToFreeViewer();
  const solution = LANDING_SOLUTIONS.find((s) => s.slug === slug)!;
  const Icon = SOLUTION_ICONS[slug];
  const colors = SOLUTION_ICON_COLORS[slug];
  const categoryMeta = SOLUTION_CATEGORIES[solution.category];

  return (
    <div className="pt-16">
      <div className="relative min-w-0 overflow-hidden bg-slate-100 lg:min-h-[calc(100dvh-4rem)]">
        {/* Softer atmosphere than full-bleed photo — keeps content readable */}
        <MarketingHeroBackdrop />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-linear-to-b from-white/97 via-slate-50/92 to-slate-100/95 lg:from-white/94"
          aria-hidden
        />
        {/* Accent glow tied to solution */}
        <div
          className={`pointer-events-none absolute -right-20 top-0 z-[1] h-[420px] w-[420px] rounded-full ${colors.solidBg} opacity-[0.11] blur-3xl`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute -left-32 bottom-0 z-[1] h-[320px] w-[320px] rounded-full ${colors.solidBg} opacity-[0.08] blur-3xl`}
          aria-hidden
        />

        <div className="relative z-10">
          {/* Mobile top bar */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
            <Link
              href="/solutions"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Solutions
            </Link>
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm"
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

          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            {/* Breadcrumb */}
            <nav
              className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-slate-500"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="font-medium transition hover:text-slate-900">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              <Link href="/solutions" className="font-medium transition hover:text-slate-900">
                Solutions
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              <span className="font-semibold text-slate-900">{solution.title}</span>
            </nav>

            <AnimateIn>
              <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_32px_64px_-24px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-xl ring-1 ring-slate-900/[0.04] sm:p-8 lg:p-10">
                {/* Top sheen + accent hairline */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent"
                  aria-hidden
                />
                <div
                  className={`pointer-events-none absolute inset-x-8 top-0 h-1 rounded-b-full ${colors.solidBg} opacity-90 shadow-lg shadow-black/10`}
                  aria-hidden
                />

                <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-14">
                  {/* Copy column */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}
                      >
                        {categoryMeta.label}
                      </span>
                      <span className="text-xs font-medium text-slate-400">Solution overview</span>
                    </div>

                    <div className="mt-6 flex items-start gap-4">
                      <span
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-slate-900/10 ring-2 ring-white ${colors.bg} ${colors.text} ${colors.ring}`}
                        aria-hidden
                      >
                        <Icon className="h-7 w-7" strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <h1 className="text-balance text-3xl font-bold tracking-[-0.02em] text-slate-900 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]">
                          {solution.title}
                        </h1>
                      </div>
                    </div>

                    <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-[17px] sm:leading-relaxed">
                      {solution.description}
                    </p>

                    <ul className="mt-8 flex flex-col gap-3 sm:max-w-xl">
                      {solution.bullets.map((b) => (
                        <li
                          key={b}
                          className={`flex gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3.5 text-sm leading-relaxed text-slate-800 shadow-sm ${colors.ring}`}
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 ${colors.text} shadow-sm ring-1 ring-slate-200/80`}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-10 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={goToFreeViewer}
                        className="btn-shine inline-flex items-center gap-2 rounded-xl bg-(--landing-cta) px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-(--landing-cta-bright) active:scale-[0.99]"
                      >
                        Open free viewer
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                      <Link
                        href="/sign-in"
                        className={`inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:shadow-md`}
                      >
                        Start Pro trial
                      </Link>
                    </div>
                  </div>

                  {/* Hero visual — replace with screenshot when asset exists */}
                  <div className="min-w-0 lg:pt-2">
                    <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:text-right">
                      Product preview
                    </p>
                    <SolutionVisualPlaceholder
                      accentSolidBg={colors.solidBg}
                      label={`${solution.title} · hero`}
                      hint="Drop your best UI frame here"
                    />
                  </div>
                </div>
              </div>
            </AnimateIn>
          </div>

          {/* Deep dive */}
          <section className="relative border-t border-slate-200/70 bg-linear-to-b from-slate-50/80 to-white py-16 sm:py-24">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
              aria-hidden
            />
            <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
              <div className="mb-12 flex flex-col items-center gap-4 text-center sm:mb-16">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md bg-white/80 ${colors.text} shadow-sm`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  Deep dive
                </span>
                <h2 className="max-w-2xl text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  How {solution.title} works in PlanSync
                </h2>
                <p className="max-w-lg text-sm leading-relaxed text-slate-500 sm:text-base">
                  Interactive preview below — swap in real screenshots anytime without changing
                  layout.
                </p>
              </div>

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
