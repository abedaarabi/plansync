"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronRight } from "lucide-react";
import { LANDING_SOLUTIONS, type SolutionSlug } from "@/lib/landingContent";
import type { LandingUseCaseSlug } from "@/lib/marketingContent";
import { LANDING_USE_CASES } from "@/lib/marketingContent";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

type UseCaseSlugPageClientProps = {
  slug: LandingUseCaseSlug;
};

function getSolutionSummary(slug: SolutionSlug) {
  return LANDING_SOLUTIONS.find((solution) => solution.slug === slug);
}

function UseCaseSlugInner({ slug }: UseCaseSlugPageClientProps) {
  const t = useTranslations("useCasesPage");
  const goToFreeViewer = useMarketingGoToFreeViewer();
  const useCase = LANDING_USE_CASES.find((item) => item.slug === slug)!;

  return (
    <div className="pt-16">
      <section className="border-b border-slate-200/70 bg-white py-14 sm:py-18">
        <div className="mx-auto max-w-5xl px-6">
          <nav
            className="mb-5 flex items-center gap-1.5 text-sm text-slate-500"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="font-medium transition hover:text-slate-900">
              {t("breadcrumbs.home")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
            <Link href="/use-cases" className="font-medium transition hover:text-slate-900">
              {t("breadcrumbs.useCases")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
            <span className="font-semibold text-slate-900">{t(`cards.${slug}.title`)}</span>
          </nav>

          <AnimateIn>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {t(`cards.${slug}.audience`)}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t(`cards.${slug}.title`)}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
              {t(`detail.${slug}.summary`)}
            </p>
          </AnimateIn>
        </div>
      </section>

      <section className="landing-band-pricing py-14 sm:py-18">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <AnimateIn>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("deliveryBlueprint")}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
                {[1, 2, 3, 4].map((stepNumber) => (
                  <li
                    key={stepNumber}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3"
                  >
                    <span className="font-semibold text-slate-900">
                      {t(`detail.${slug}.step${stepNumber}Title`)}
                    </span>
                    <p className="mt-1 text-slate-600">
                      {t(`detail.${slug}.step${stepNumber}Body`)}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          </AnimateIn>

          <AnimateIn delay={100}>
            <aside className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t("linkedSolutions")}
              </h2>
              <ul className="mt-4 space-y-3">
                {useCase.linkedSolutions.map((solutionSlug) => {
                  const solution = getSolutionSummary(solutionSlug);
                  if (!solution) return null;
                  return (
                    <li key={solutionSlug}>
                      <Link
                        href={`/solutions/${solutionSlug}`}
                        className="block rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <p className="text-sm font-semibold text-slate-900">{solution.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{solution.tagline}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => goToFreeViewer(`use_case_${slug}_open_viewer`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--landing-cta)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--landing-cta-bright)]"
                >
                  {t("openViewer")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </aside>
          </AnimateIn>
        </div>
      </section>
    </div>
  );
}

export function UseCaseSlugPageClient({ slug }: UseCaseSlugPageClientProps) {
  return (
    <MarketingShell>
      <UseCaseSlugInner slug={slug} />
    </MarketingShell>
  );
}
