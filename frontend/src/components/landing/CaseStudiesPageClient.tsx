"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, BarChart3 } from "lucide-react";
import { LANDING_CASE_STUDIES } from "@/lib/marketingContent";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";

function CaseStudiesPageInner() {
  const t = useTranslations("caseStudiesPage");
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
              <Link href="/use-cases" className="landing-btn-secondary">
                {t("viewUseCases")}
              </Link>
              <button
                type="button"
                onClick={() => goToFreeViewer("case_studies_hero_open_viewer")}
                className="landing-btn-primary"
              >
                {t("openViewer")}
              </button>
            </div>
          </AnimateIn>
        </div>
      </section>

      <section className="landing-band-pricing py-14 sm:py-18">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 lg:grid-cols-3">
          {LANDING_CASE_STUDIES.map((study, index) => (
            <AnimateIn key={study.slug} delay={index * 70}>
              <article className="landing-card h-full">
                <span className="landing-icon landing-icon-accent" aria-hidden>
                  <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                  {t(`cards.${study.slug}.title`)}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(`cards.${study.slug}.summary`)}
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <li>{t(`cards.${study.slug}.metric1`)}</li>
                  <li>{t(`cards.${study.slug}.metric2`)}</li>
                  <li>{t(`cards.${study.slug}.metric3`)}</li>
                </ul>
                <Link
                  href={`/case-studies/${study.slug}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  {t("readStudy")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            </AnimateIn>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CaseStudiesPageClient() {
  return (
    <MarketingShell>
      <CaseStudiesPageInner />
    </MarketingShell>
  );
}
