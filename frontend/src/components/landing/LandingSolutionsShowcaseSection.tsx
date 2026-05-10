"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, HardHat, Link2, Wrench } from "lucide-react";
import { getSolutionsByCategory, LANDING_SOLUTIONS } from "@/lib/landingContent";
import { AnimateIn } from "./AnimateIn";
import { SOLUTION_ICON_COLORS, SOLUTION_ICONS } from "./solutionIcons";

/** Four core construction tools shown on the card; audit & proposal linked via CTA. */
const FEATURED_CONSTRUCTION = getSolutionsByCategory("construction").filter((s) =>
  ["viewer", "issues", "rfis", "takeoff"].includes(s.slug),
);

const operationsSolutions = getSolutionsByCategory("operations");

/** Four representative operations tools shown on the card. */
const FEATURED_OPERATIONS = operationsSolutions.filter((s) =>
  ["om-handover", "om-assets", "om-maintenance", "om-fm-dashboard"].includes(s.slug),
);

const constructionExtraCount =
  getSolutionsByCategory("construction").length - FEATURED_CONSTRUCTION.length;

const operationsExtraCount =
  getSolutionsByCategory("operations").length - FEATURED_OPERATIONS.length;

export function LandingSolutionsShowcaseSection() {
  const tIntro = useTranslations("solutionsIntro");
  const tCons = useTranslations("constructionCard");
  const tOps = useTranslations("operationsCard");

  return (
    <section
      id="features"
      className="landing-atmosphere relative scroll-mt-20 overflow-hidden border-t border-slate-200/70 py-28 sm:py-36"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] landing-dots"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-300/60 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateIn className="mx-auto max-w-3xl text-center">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600 shadow-sm backdrop-blur-sm">
            <Link2
              className="h-3 w-3 shrink-0 text-(--landing-cta)"
              strokeWidth={2.5}
              aria-hidden
            />
            {tIntro("eyebrow")}
          </div>
          <h2 className="mt-8 text-pretty text-[2.05rem] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-[2.7rem] sm:leading-[1.07]">
            <span className="block text-slate-500 sm:text-[1.8rem] sm:leading-snug">
              {tIntro("line1")}
            </span>
            <span className="mt-1 block bg-linear-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent sm:mt-0">
              {tIntro("line2")}
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[1.03rem] leading-relaxed text-slate-600 sm:text-[1.08rem] sm:leading-relaxed">
            {tIntro("body")}
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 lg:mt-20 lg:grid-cols-2 lg:gap-10">
          <AnimateIn delay={60}>
            <article className="group relative flex h-full min-h-105 flex-col overflow-hidden rounded-[1.65rem] border border-slate-200/85 bg-white shadow-[0_32px_64px_-28px_rgba(15,23,42,0.14),0_0_0_1px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/2.5">
              <div
                className="h-1.5 w-full bg-linear-to-r from-blue-700 via-blue-600 to-sky-500"
                aria-hidden
              />
              <div className="flex flex-1 flex-col px-7 pb-8 pt-7 sm:px-9 sm:pb-9 sm:pt-8">
                <header className="border-b border-slate-100 pb-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25"
                      aria-hidden
                    >
                      <HardHat className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700/90">
                        {tCons("label")}
                      </p>
                      <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-tight text-slate-900 sm:text-[1.45rem]">
                        {tCons("title")}
                      </h3>
                      <p className="mt-2 text-[0.94rem] leading-relaxed text-slate-600 sm:text-[0.98rem]">
                        {tCons("body")}
                      </p>
                    </div>
                  </div>
                </header>

                <ul className="mt-5 flex flex-1 flex-col gap-2">
                  {FEATURED_CONSTRUCTION.map((s) => {
                    const Icon = SOLUTION_ICONS[s.slug];
                    const colors = SOLUTION_ICON_COLORS[s.slug];
                    return (
                      <li key={s.slug}>
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100/90 bg-slate-50/50 px-3.5 py-2.5 transition hover:border-slate-200/90 hover:bg-white sm:px-4 sm:py-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors.solidBg} shadow-md shadow-slate-900/10`}
                            aria-hidden
                          >
                            <Icon className="h-4 w-4 text-white" strokeWidth={1.9} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                              {s.title}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-500 sm:hidden">
                              {s.tagline}
                            </span>
                          </div>
                          <span className="hidden max-w-44 shrink-0 text-right text-xs leading-snug text-slate-500 sm:block">
                            {s.tagline}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  <li>
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200/90 bg-white/60 px-3.5 py-2.5 sm:px-4 sm:py-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white shadow-md"
                        aria-hidden
                      >
                        +{constructionExtraCount}
                      </span>
                      <span className="text-sm leading-snug text-slate-600">{tCons("extra")}</span>
                    </div>
                  </li>
                </ul>

                <div className="mt-8 border-t border-slate-100 pt-6">
                  <Link
                    href="/solutions/viewer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--landing-cta) px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-(--landing-cta-bright) sm:w-auto"
                  >
                    {tCons("cta")}
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              </div>
            </article>
          </AnimateIn>

          <AnimateIn delay={120}>
            <article className="group relative flex h-full min-h-105 flex-col overflow-hidden rounded-[1.65rem] border border-slate-200/85 bg-white shadow-[0_32px_64px_-28px_rgba(15,23,42,0.14),0_0_0_1px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/2.5 lg:translate-y-4">
              <div
                className="h-1.5 w-full bg-linear-to-r from-emerald-700 via-teal-600 to-cyan-500"
                aria-hidden
              />
              <div className="flex flex-1 flex-col px-7 pb-8 pt-7 sm:px-9 sm:pb-9 sm:pt-8">
                <header className="border-b border-slate-100 pb-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-700 to-teal-700 text-white shadow-lg shadow-emerald-900/20"
                      aria-hidden
                    >
                      <Wrench className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800/90">
                        {tOps("label")}
                      </p>
                      <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-tight text-slate-900 sm:text-[1.45rem]">
                        {tOps("title")}
                      </h3>
                      <p className="mt-2 text-[0.94rem] leading-relaxed text-slate-600 sm:text-[0.98rem]">
                        {tOps("body")}
                      </p>
                    </div>
                  </div>
                </header>

                <ul className="mt-5 flex flex-1 flex-col gap-2">
                  {FEATURED_OPERATIONS.map((s) => {
                    const Icon = SOLUTION_ICONS[s.slug];
                    const colors = SOLUTION_ICON_COLORS[s.slug];
                    return (
                      <li key={s.slug}>
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100/90 bg-slate-50/50 px-3.5 py-2.5 transition sm:px-4 sm:py-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors.solidBg} shadow-md shadow-slate-900/10`}
                            aria-hidden
                          >
                            <Icon className="h-4 w-4 text-white" strokeWidth={1.9} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                              {s.title}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-500 sm:hidden">
                              {s.tagline}
                            </span>
                          </div>
                          <span className="hidden max-w-44 shrink-0 text-right text-xs leading-snug text-slate-500 sm:block">
                            {s.tagline}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  <li>
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200/90 bg-white/60 px-3.5 py-2.5 sm:px-4 sm:py-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white shadow-md"
                        aria-hidden
                      >
                        +{operationsExtraCount}
                      </span>
                      <span className="text-sm leading-snug text-slate-600">{tOps("extra")}</span>
                    </div>
                  </li>
                </ul>

                <div className="mt-8 border-t border-slate-100 pt-6">
                  <Link
                    href="/solutions/om-handover"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white sm:w-auto"
                  >
                    {tOps("cta")}
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              </div>
            </article>
          </AnimateIn>
        </div>

        <AnimateIn delay={180} className="mt-14 flex justify-center sm:mt-16">
          <Link
            href="/solutions"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/3 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          >
            {tIntro("allSolutionsCta", { count: LANDING_SOLUTIONS.length })}
            <ArrowRight className="h-4 w-4 shrink-0 text-(--landing-cta)" />
          </Link>
        </AnimateIn>
      </div>
    </section>
  );
}
