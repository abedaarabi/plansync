"use client";

import { ChevronDown } from "lucide-react";
import { LANDING_FAQ } from "@/lib/landingContent";
import { AnimateIn } from "./AnimateIn";

export function LandingFaqSection() {
  return (
    <section
      className="relative scroll-mt-20 border-t border-slate-200/60 bg-[var(--enterprise-bg)] py-24 sm:py-32"
      id="faq"
    >
      <div className="mx-auto max-w-3xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            FAQ
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600 sm:text-base">
            Billing, storage, and how Free vs Pro works.
          </p>
        </AnimateIn>

        <div className="mt-12 rounded-2xl border border-slate-200/90 bg-white p-1 shadow-[var(--enterprise-shadow-card)] sm:mt-14 sm:p-2">
          {LANDING_FAQ.map((item, i) => (
            <AnimateIn key={item.q} delay={i * 40}>
              <details className="group border-b border-slate-100 last:border-0 first:rounded-t-xl last:rounded-b-xl open:bg-slate-50/50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 text-left text-[15px] font-semibold text-slate-900 transition-colors hover:text-[var(--landing-cta)] sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-[var(--landing-cta)]" />
                </summary>
                <p className="px-4 pb-4 pr-10 text-sm leading-relaxed text-slate-600 sm:px-5 sm:pb-5">
                  {item.a}
                </p>
              </details>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
