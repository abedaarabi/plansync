"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Timer, TrendingUp } from "lucide-react";
import { AnimateIn } from "./AnimateIn";

const proofIcons = [ShieldCheck, Timer, TrendingUp] as const;
const proofKeys = ["proof1", "proof2", "proof3"] as const;

export function LandingProofSection() {
  const t = useTranslations("proofSection");

  return (
    <section
      className="relative border-y border-slate-200/70 bg-white/80 py-12 sm:py-14"
      id="proof"
    >
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
                {t("eyebrow")}
              </p>
              <h2 className="mt-3 text-balance text-[1.95rem] font-bold tracking-tight text-slate-900 sm:text-[2.3rem]">
                {t("title")}
              </h2>
              <p className="mt-3 max-w-2xl text-[0.99rem] leading-relaxed text-slate-600 sm:text-[1.05rem]">
                {t("body")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/case-studies"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {t("caseStudiesCta")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/use-cases"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
                >
                  {t("useCasesCta")}
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {proofKeys.map((proofKey, index) => {
                const Icon = proofIcons[index];
                const offsetClass =
                  index === 0
                    ? "lg:translate-x-0"
                    : index === 1
                      ? "lg:translate-x-2"
                      : "lg:translate-x-1";
                return (
                  <article
                    key={proofKey}
                    className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)] ${offsetClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-200/70">
                        <Icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[0.95rem] font-semibold text-slate-900">
                          {t(`${proofKey}.title`)}
                        </h3>
                        <p className="mt-1 text-[0.84rem] leading-relaxed text-slate-600">
                          {t(`${proofKey}.body`)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
