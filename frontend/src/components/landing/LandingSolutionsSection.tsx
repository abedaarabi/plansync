"use client";

import { ArrowRight, Check } from "lucide-react";
import { LANDING_SOLUTIONS, LANDING_SOLUTIONS_SECTION } from "@/lib/landingContent";
import { AnimateIn } from "./AnimateIn";
import { SOLUTION_ICONS } from "./solutionIcons";

export function LandingSolutionsSection() {
  return (
    <section
      id="solutions"
      className="relative scroll-mt-20 border-t border-slate-200/70 bg-white py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {LANDING_SOLUTIONS_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {LANDING_SOLUTIONS_SECTION.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {LANDING_SOLUTIONS_SECTION.description}
          </p>
        </AnimateIn>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {LANDING_SOLUTIONS.map((s, i) => {
            const Icon = SOLUTION_ICONS[s.slug];
            return (
              <AnimateIn key={s.slug} delay={80 + i * 60}>
                <div
                  id={`solution-${s.slug}`}
                  className="flex h-full scroll-mt-24 flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[var(--enterprise-shadow-card)] transition hover:border-slate-200"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)]"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-sm leading-snug text-slate-600">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_70%,#64748b)]"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`#feature-${s.slug}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                  >
                    Learn more <ArrowRight className="h-4 w-4 shrink-0" />
                  </a>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
