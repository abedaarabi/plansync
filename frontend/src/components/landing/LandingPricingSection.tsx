"use client";

import Link from "next/link";
import { useMessages, useTranslations } from "next-intl";
import { ArrowRight, Check, Cloud, Monitor } from "lucide-react";
import { AnimateIn } from "./AnimateIn";
import {
  ENTERPRISE_FEATURES as ENTERPRISE_FEATURES_DEFAULT,
  FREE_FEATURES as FREE_FEATURES_DEFAULT,
  PRO_FEATURES as PRO_FEATURES_DEFAULT,
} from "./constants";
import {
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_INCLUDED_SEATS,
  PRO_MONTHLY_PRICE_USD,
} from "@/lib/productPricing";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";

type LandingPricingSectionProps = {
  onGoToFreeViewer: () => void;
};

type PricingMsgs = {
  pricing?: {
    freeFeatures?: string[];
    proFeatures?: string[];
    enterpriseFeatures?: string[];
  };
};

export function LandingPricingSection({ onGoToFreeViewer }: LandingPricingSectionProps) {
  const t = useTranslations("pricing");
  const messages = useMessages() as PricingMsgs;
  const freeFeatures = messages.pricing?.freeFeatures ?? FREE_FEATURES_DEFAULT;
  const proFeatures = messages.pricing?.proFeatures ?? PRO_FEATURES_DEFAULT;
  const enterpriseFeatures = messages.pricing?.enterpriseFeatures ?? ENTERPRISE_FEATURES_DEFAULT;

  return (
    <section
      className="landing-band-pricing relative scroll-mt-20 border-t border-slate-200/60 py-24 sm:py-32"
      id="compare"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {t("subtitle")}
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-8">
          <AnimateIn delay={100}>
            <div className="flex h-full min-w-0 flex-col rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[var(--enterprise-shadow-card)] sm:p-9">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
                  aria-hidden
                >
                  <Monitor className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {t("freeLabel")}
                  </div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                    {t("freePrice")}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{t("freeTagline")}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{t("freeTagline2")}</p>
                </div>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                {freeFeatures.map((f, i) => (
                  <li
                    key={`${f}-${i}`}
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
                onClick={() => {
                  trackMarketingEvent("marketing_pricing_interaction", {
                    plan: "free",
                    action: "open_viewer",
                  });
                  onGoToFreeViewer();
                }}
                className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
              >
                {t("openViewer")} <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </AnimateIn>

          <AnimateIn delay={200}>
            <div className="relative flex h-full min-w-0 flex-col rounded-3xl border-2 border-[var(--landing-cta)] bg-white p-8 shadow-[0_28px_56px_-24px_rgba(37,99,235,0.11),var(--enterprise-shadow-card)] ring-4 ring-[color-mix(in_srgb,var(--landing-cta)_12%,transparent)] sm:p-9">
              <div className="absolute -top-3.5 start-1/2 -translate-x-1/2 rounded-full bg-[var(--landing-cta)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25">
                {t("popular")}
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
                    {t("proLabel")}
                  </div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                    ${PRO_MONTHLY_PRICE_USD}
                    <span className="text-lg font-normal text-slate-500">{t("perMonth")}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {t("proIncluded", { seats: PRO_INCLUDED_SEATS })}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{t("proEverything")}</p>
                </div>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                {proFeatures.map((f, i) => (
                  <li
                    key={`${f}-${i}`}
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
                onClick={() =>
                  trackMarketingEvent("marketing_pricing_interaction", {
                    plan: "pro",
                    action: "start_trial",
                  })
                }
                className="btn-shine relative mt-8 flex min-h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
              >
                {t("startTrial14")} <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
          </AnimateIn>

          <AnimateIn delay={300}>
            <div className="flex h-full min-w-0 flex-col rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[var(--enterprise-shadow-card)] sm:p-9">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/80"
                  aria-hidden
                >
                  <Cloud className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                    {t("enterpriseLabel")}
                  </div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                    ${ENTERPRISE_MONTHLY_PRICE_USD}
                    <span className="text-lg font-normal text-slate-500">{t("perMonth")}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {t("proIncluded", { seats: PRO_INCLUDED_SEATS })}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{t("enterpriseBlurb")}</p>
                </div>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                {enterpriseFeatures.map((f, i) => (
                  <li
                    key={`${f}-${i}`}
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

              <Link
                href="/sign-in"
                onClick={() =>
                  trackMarketingEvent("marketing_pricing_interaction", {
                    plan: "enterprise",
                    action: "start_trial",
                  })
                }
                className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
              >
                {t("startTrial14")} <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
          </AnimateIn>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
          {t("footnote", { seats: PRO_INCLUDED_SEATS })}
        </p>
      </div>
    </section>
  );
}
