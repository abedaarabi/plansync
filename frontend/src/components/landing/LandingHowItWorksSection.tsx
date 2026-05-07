"use client";

import { useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";

const STEPS: {
  titleKey: "step1Title" | "step2Title" | "step3Title" | "step4Title";
  bodyKey: "step1Body" | "step2Body" | "step3Body" | "step4Body";
}[] = [
  { titleKey: "step1Title", bodyKey: "step1Body" },
  { titleKey: "step2Title", bodyKey: "step2Body" },
  { titleKey: "step3Title", bodyKey: "step3Body" },
  { titleKey: "step4Title", bodyKey: "step4Body" },
];

export function LandingHowItWorksSection() {
  const t = useTranslations("howItWorks");
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-t border-slate-200/70 bg-slate-50/80 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {t("description")}
          </p>
        </AnimateIn>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <AnimateIn key={step.titleKey} delay={60 + i * 50}>
              <div className="relative flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--landing-cta)_12%,white)] text-sm font-bold text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_25%,transparent)]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(step.bodyKey)}</p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
