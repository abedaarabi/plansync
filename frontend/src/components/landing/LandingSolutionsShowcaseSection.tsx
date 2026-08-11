"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, HardHat, Wrench } from "lucide-react";
import { getSolutionsByCategory, LANDING_SOLUTIONS } from "@/lib/landingContent";
import { AnimateIn } from "./AnimateIn";
import { SOLUTION_ICONS } from "./solutionIcons";

/** Four core construction tools shown; audit & proposal linked via CTA. */
const FEATURED_CONSTRUCTION = getSolutionsByCategory("construction").filter((s) =>
  ["viewer", "issues", "rfis", "takeoff"].includes(s.slug),
);

const operationsSolutions = getSolutionsByCategory("operations");

/** Four representative operations tools. */
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            {tIntro("eyebrow")}
          </p>
          <h2 className="mt-5 text-pretty text-[2.05rem] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-[2.7rem] sm:leading-[1.07]">
            <span className="block text-slate-500 sm:text-[1.8rem] sm:leading-snug">
              {tIntro("line1")}
            </span>
            <span className="mt-1 block text-slate-900 sm:mt-0">{tIntro("line2")}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[1.03rem] leading-relaxed text-slate-600 sm:text-[1.08rem] sm:leading-relaxed">
            {tIntro("body")}
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 lg:mt-20 lg:grid-cols-2 lg:gap-10">
          <AnimateIn delay={60}>
            <article className="landing-card landing-card-lg flex h-full min-h-0 flex-col">
              <header className="border-b border-slate-100 pb-6">
                <div className="flex items-start gap-4">
                  <span className="landing-icon landing-icon-lg landing-icon-accent" aria-hidden>
                    <HardHat className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {tCons("label")}
                    </p>
                    <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-tight text-slate-900 sm:text-[1.4rem]">
                      {tCons("title")}
                    </h3>
                    <p className="mt-2 text-[0.94rem] leading-relaxed text-slate-600 sm:text-[0.98rem]">
                      {tCons("body")}
                    </p>
                  </div>
                </div>
              </header>

              <ul className="mt-6 flex flex-1 flex-col gap-1">
                {FEATURED_CONSTRUCTION.map((s) => {
                  const Icon = SOLUTION_ICONS[s.slug];
                  return (
                    <li key={s.slug}>
                      <div className="flex items-center gap-3 rounded-lg px-1 py-2.5 sm:py-3">
                        <span className="landing-icon" aria-hidden>
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
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
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 px-1 py-2.5 sm:px-2 sm:py-3">
                    <span className="landing-icon text-xs font-semibold tabular-nums" aria-hidden>
                      +{constructionExtraCount}
                    </span>
                    <span className="text-sm leading-snug text-slate-600">{tCons("extra")}</span>
                  </div>
                </li>
              </ul>

              <div className="mt-8 border-t border-slate-100 pt-6">
                <Link href="/solutions/viewer" className="landing-btn-primary sm:w-auto">
                  {tCons("cta")}
                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </article>
          </AnimateIn>

          <AnimateIn delay={120}>
            <article className="landing-card landing-card-lg flex h-full min-h-0 flex-col">
              <header className="border-b border-slate-100 pb-6">
                <div className="flex items-start gap-4">
                  <span className="landing-icon landing-icon-lg" aria-hidden>
                    <Wrench className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {tOps("label")}
                    </p>
                    <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-tight text-slate-900 sm:text-[1.4rem]">
                      {tOps("title")}
                    </h3>
                    <p className="mt-2 text-[0.94rem] leading-relaxed text-slate-600 sm:text-[0.98rem]">
                      {tOps("body")}
                    </p>
                  </div>
                </div>
              </header>

              <ul className="mt-6 flex flex-1 flex-col gap-1">
                {FEATURED_OPERATIONS.map((s) => {
                  const Icon = SOLUTION_ICONS[s.slug];
                  return (
                    <li key={s.slug}>
                      <div className="flex items-center gap-3 rounded-lg px-1 py-2.5 sm:py-3">
                        <span className="landing-icon" aria-hidden>
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
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
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 px-1 py-2.5 sm:px-2 sm:py-3">
                    <span className="landing-icon text-xs font-semibold tabular-nums" aria-hidden>
                      +{operationsExtraCount}
                    </span>
                    <span className="text-sm leading-snug text-slate-600">{tOps("extra")}</span>
                  </div>
                </li>
              </ul>

              <div className="mt-8 border-t border-slate-100 pt-6">
                <Link href="/solutions/om-handover" className="landing-btn-secondary sm:w-auto">
                  {tOps("cta")}
                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </article>
          </AnimateIn>
        </div>

        <AnimateIn delay={180} className="mt-14 flex justify-center sm:mt-16">
          <Link href="/solutions" className="landing-btn-secondary">
            {tIntro("allSolutionsCta", { count: LANDING_SOLUTIONS.length })}
            <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          </Link>
        </AnimateIn>
      </div>
    </section>
  );
}
