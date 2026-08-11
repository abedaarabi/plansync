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
                className="landing-btn-primary"
              >
                {t("openViewer")}
              </button>
              <Link href="/pricing" className="landing-btn-secondary">
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
                <article className="landing-card h-full">
                  <span className="landing-icon landing-icon-accent" aria-hidden>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
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
                          className="inline-flex rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
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
