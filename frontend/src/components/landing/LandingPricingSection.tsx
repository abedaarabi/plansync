"use client";

import Link from "next/link";
import { ArrowRight, Check, Cloud, Monitor } from "lucide-react";
import { AnimateIn } from "./AnimateIn";
import { PRO_MONTHLY_PRICE_USD } from "@/lib/productPricing";
import { FREE_FEATURES, PRO_FEATURES } from "./constants";

type LandingPricingSectionProps = {
  onGoToFreeViewer: () => void;
};

export function LandingPricingSection({ onGoToFreeViewer }: LandingPricingSectionProps) {
  return (
    <section
      className="landing-band-pricing relative scroll-mt-20 border-t border-slate-200/60 py-24 sm:py-32"
      id="compare"
    >
      <div className="relative mx-auto max-w-5xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            Pricing
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Free to start. Pro when you&apos;re ready.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Everything you need to view construction PDFs — upgrade when your team needs
            collaboration.
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <AnimateIn delay={100}>
            <div className="flex h-full flex-col rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[var(--enterprise-shadow-card)] sm:p-9">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
                  aria-hidden
                >
                  <Monitor className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Free
                  </div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">$0</div>
                  <p className="mt-1 text-sm text-slate-600">No signup needed</p>
                  <p className="mt-0.5 text-sm text-slate-500">Local PDF viewer</p>
                </div>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                {FREE_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 rounded-xl px-1 py-1.5 text-sm text-slate-700"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={onGoToFreeViewer}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
              >
                Open free viewer <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </AnimateIn>

          <AnimateIn delay={200}>
            <div className="relative flex h-full flex-col rounded-3xl border-2 border-[var(--landing-cta)] bg-white p-8 shadow-[0_28px_56px_-24px_rgba(37,99,235,0.11),var(--enterprise-shadow-card)] ring-4 ring-[color-mix(in_srgb,var(--landing-cta)_12%,transparent)] sm:p-9">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--landing-cta)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25">
                Most Popular
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)]"
                  aria-hidden
                >
                  <Cloud className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-[var(--landing-cta)]">
                    Pro
                  </div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                    ${PRO_MONTHLY_PRICE_USD}
                    <span className="text-lg font-normal text-slate-500">/month</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">8 uses</p>
                  <p className="mt-0.5 text-sm text-slate-500">Everything in Free +</p>
                </div>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                {PRO_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 rounded-xl px-1 py-1.5 text-sm text-slate-700"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-cta)]"
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-in"
                className="btn-shine relative mt-8 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
              >
                Start 14-day Trial <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}
