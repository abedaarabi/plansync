"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Building2, Factory, HardHat, Wrench } from "lucide-react";
import { LANDING_SOLUTIONS, type SolutionSlug } from "@/lib/landingContent";
import { LANDING_USE_CASES } from "@/lib/marketingContent";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

const useCaseIcons = [HardHat, Factory, Building2, Wrench] as const;

function getSolutionTitle(slug: SolutionSlug) {
  return LANDING_SOLUTIONS.find((solution) => solution.slug === slug)?.title ?? slug;
}

function UseCasesPageInner() {
  const t = useTranslations("useCasesPage");
  const goToFreeViewer = useMarketingGoToFreeViewer();

  return (
    <div className="pt-16">
      <section className="border-b border-slate-200/70 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">{t("body")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => goToFreeViewer("use_cases_hero_open_viewer")}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--landing-cta)] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
              >
                {t("openViewer")}
              </button>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {t("seePricing")}
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      <section className="landing-band-pricing py-14 sm:py-18">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 md:grid-cols-2">
          {LANDING_USE_CASES.map((useCase, index) => {
            const Icon = useCaseIcons[index % useCaseIcons.length];
            return (
              <AnimateIn key={useCase.slug} delay={index * 60}>
                <article className="h-full rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.25)]">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-200/70">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
                    {t(`cards.${useCase.slug}.title`)}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t(`cards.${useCase.slug}.body`)}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t("linkedSolutions")}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {useCase.linkedSolutions.map((solutionSlug) => (
                      <li key={solutionSlug}>
                        <Link
                          href={`/solutions/${solutionSlug}`}
                          className="inline-flex rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          {getSolutionTitle(solutionSlug)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/use-cases/${useCase.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                  >
                    {t("readUseCase")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              </AnimateIn>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function UseCasesPageClient() {
  return (
    <MarketingShell>
      <UseCasesPageInner />
    </MarketingShell>
  );
}
