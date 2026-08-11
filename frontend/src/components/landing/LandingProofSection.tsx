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
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
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
                <Link href="/case-studies" className="landing-btn-primary">
                  {t("caseStudiesCta")}
                  <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                </Link>
                <Link href="/use-cases" className="landing-btn-secondary">
                  {t("useCasesCta")}
                </Link>
              </div>
            </div>

            {/* Compact proof rows — not three flashy icon cards */}
            <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
              {proofKeys.map((proofKey, index) => {
                const Icon = proofIcons[index];
                return (
                  <li key={proofKey} className="flex items-start gap-3.5 py-5 first:pt-1 last:pb-1">
                    <span className="landing-icon landing-icon-accent mt-0.5" aria-hidden>
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[0.95rem] font-semibold text-slate-900">
                        {t(`${proofKey}.title`)}
                      </h3>
                      <p className="mt-1 text-[0.88rem] leading-relaxed text-slate-600">
                        {t(`${proofKey}.body`)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </AnimateIn>

        <AnimateIn delay={80}>
          <div className="landing-card mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Trusted by project teams
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {["NORTHRIDGE BUILD", "MECHANICA PRO", "HARBOR FM"].map((name) => (
                  <span
                    key={name}
                    className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              &ldquo;PlanSync cut RFI follow-up noise for our site and PM team in the first two
              weeks.&rdquo;
            </p>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
