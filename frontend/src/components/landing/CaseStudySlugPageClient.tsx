"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { LandingCaseStudySlug } from "@/lib/marketingContent";
import { getLandingCaseStudy } from "@/lib/marketingContent";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

type CaseStudySlugPageClientProps = {
  slug: LandingCaseStudySlug;
};

function CaseStudySlugInner({ slug }: CaseStudySlugPageClientProps) {
  const t = useTranslations("caseStudiesPage");
  const goToFreeViewer = useMarketingGoToFreeViewer();
  const caseStudy = getLandingCaseStudy(slug)!;

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
            <Link href="/case-studies" className="font-medium transition hover:text-slate-900">
              {t("breadcrumbs.caseStudies")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
            <span className="font-semibold text-slate-900">{t(`cards.${slug}.title`)}</span>
          </nav>
          <AnimateIn>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t(`cards.${slug}.title`)}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
              {t(`detail.${slug}.overview`)}
            </p>
          </AnimateIn>
        </div>
      </section>

      <section className="landing-band-pricing py-14 sm:py-18">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <AnimateIn>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("results")}</h2>
              <ul className="mt-4 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-700">
                <li>{t(`cards.${slug}.metric1`)}</li>
                <li>{t(`cards.${slug}.metric2`)}</li>
                <li>{t(`cards.${slug}.metric3`)}</li>
              </ul>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t("whatChanged")}
              </h3>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
                {[1, 2, 3].map((stepNumber) => (
                  <li
                    key={stepNumber}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3"
                  >
                    <span className="font-semibold text-slate-900">
                      {t(`detail.${slug}.change${stepNumber}Title`)}
                    </span>
                    <p className="mt-1 text-slate-600">
                      {t(`detail.${slug}.change${stepNumber}Body`)}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          </AnimateIn>

          <AnimateIn delay={100}>
            <aside className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                {t("nextSteps")}
              </h2>
              <div className="mt-4 space-y-3">
                <Link
                  href={`/use-cases/${caseStudy.useCaseSlug}`}
                  className="block rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {t("viewRelatedUseCase")}
                </Link>
                <Link
                  href="/pricing"
                  className="block rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {t("viewPricing")}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => goToFreeViewer(`case_study_${slug}_open_viewer`)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--landing-cta)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--landing-cta-bright)]"
              >
                {t("openViewer")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </aside>
          </AnimateIn>
        </div>
      </section>
    </div>
  );
}

export function CaseStudySlugPageClient({ slug }: CaseStudySlugPageClientProps) {
  return (
    <MarketingShell>
      <CaseStudySlugInner slug={slug} />
    </MarketingShell>
  );
}
