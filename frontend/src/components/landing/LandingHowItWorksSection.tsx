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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-[2rem] font-bold tracking-tight text-slate-900 sm:text-[2.45rem]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[1rem] leading-relaxed text-slate-600 sm:text-[1.08rem]">
            {t("description")}
          </p>
        </AnimateIn>

        {/* Editorial numbered list — not a grid of identical icon cards */}
        <div className="mt-14 divide-y divide-slate-200/80 overflow-hidden rounded-2xl border border-slate-200/80 bg-white sm:mt-16">
          {STEPS.map((step, i) => (
            <AnimateIn key={step.titleKey} delay={40 + i * 40}>
              <div className="grid gap-4 px-6 py-7 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 sm:px-8 sm:py-8 lg:grid-cols-[5rem_minmax(0,14rem)_minmax(0,1fr)] lg:items-baseline lg:gap-10">
                <span
                  className="font-mono text-sm font-semibold tabular-nums tracking-tight text-(--landing-cta)"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[1.05rem] font-semibold tracking-tight text-slate-900 sm:text-[1.1rem]">
                  {t(step.titleKey)}
                </h3>
                <p className="text-[0.95rem] leading-relaxed text-slate-600 sm:col-span-2 lg:col-span-1">
                  {t(step.bodyKey)}
                </p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
