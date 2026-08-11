"use client";

import Link from "next/link";
import { useMessages, useTranslations } from "next-intl";
import { ArrowRight, Check, Minus, Monitor, Cloud, Building2, Users } from "lucide-react";
import { AnimateIn } from "./AnimateIn";
import {
  ENTERPRISE_FEATURES as ENTERPRISE_FEATURES_DEFAULT,
  FREE_FEATURES as FREE_FEATURES_DEFAULT,
  PRICING_COMPARE_ROWS,
  PRO_FEATURES as PRO_FEATURES_DEFAULT,
  TEAM_FEATURES as TEAM_FEATURES_DEFAULT,
  type PricingCompareCell,
} from "./constants";
import {
  ENTERPRISE_INCLUDED_SEATS,
  ENTERPRISE_MONTHLY_PRICE_USD,
  PRO_INCLUDED_SEATS,
  PRO_MONTHLY_PRICE_USD,
  TEAM_INCLUDED_SEATS,
  TEAM_MONTHLY_PRICE_USD,
} from "@/lib/productPricing";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";

type LandingPricingSectionProps = {
  onGoToFreeViewer: () => void;
};

type PricingMsgs = {
  pricing?: {
    freeFeatures?: string[];
    teamFeatures?: string[];
    proFeatures?: string[];
    enterpriseFeatures?: string[];
    compareRows?: Array<{
      feature: string;
      free: string;
      team: string;
      pro: string;
      enterprise: string;
    }>;
  };
};

function CellValue({ value }: { value: PricingCompareCell }) {
  if (value === "yes") {
    return (
      <Check
        className="mx-auto h-5 w-5 text-[var(--landing-cta)]"
        strokeWidth={2.5}
        aria-label="Included"
      />
    );
  }
  if (value === "no") {
    return (
      <Minus className="mx-auto h-4 w-4 text-slate-300" strokeWidth={2} aria-label="Not included" />
    );
  }
  return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

export function LandingPricingSection({ onGoToFreeViewer }: LandingPricingSectionProps) {
  const t = useTranslations("pricing");
  const messages = useMessages() as PricingMsgs;
  const freeFeatures = messages.pricing?.freeFeatures ?? FREE_FEATURES_DEFAULT;
  const teamFeatures = messages.pricing?.teamFeatures ?? TEAM_FEATURES_DEFAULT;
  const proFeatures = messages.pricing?.proFeatures ?? PRO_FEATURES_DEFAULT;
  const enterpriseFeatures = messages.pricing?.enterpriseFeatures ?? ENTERPRISE_FEATURES_DEFAULT;
  const compareRows = messages.pricing?.compareRows ?? PRICING_COMPARE_ROWS;

  const cards = [
    {
      id: "free" as const,
      label: t("freeLabel"),
      price: t("freePrice"),
      tagline: t("freeTagline"),
      tagline2: t("freeTagline2"),
      features: freeFeatures,
      icon: Monitor,
      popular: false,
    },
    {
      id: "team" as const,
      label: t("teamLabel"),
      price: `$${TEAM_MONTHLY_PRICE_USD}`,
      tagline: t("teamIncluded", { seats: TEAM_INCLUDED_SEATS }),
      tagline2: t("teamEverything"),
      features: teamFeatures,
      icon: Users,
      popular: false,
    },
    {
      id: "pro" as const,
      label: t("proLabel"),
      price: `$${PRO_MONTHLY_PRICE_USD}`,
      tagline: t("proIncluded", { seats: PRO_INCLUDED_SEATS }),
      tagline2: t("proEverything"),
      features: proFeatures,
      icon: Cloud,
      popular: true,
    },
    {
      id: "enterprise" as const,
      label: t("enterpriseLabel"),
      price: `$${ENTERPRISE_MONTHLY_PRICE_USD}`,
      tagline: t("enterpriseIncluded", { seats: ENTERPRISE_INCLUDED_SEATS }),
      tagline2: t("enterpriseBlurb"),
      features: enterpriseFeatures,
      icon: Building2,
      popular: false,
    },
  ];

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

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <AnimateIn key={card.id} delay={80 + idx * 60}>
                <div
                  className={
                    card.popular
                      ? "landing-card landing-card-featured relative flex h-full min-w-0 flex-col"
                      : "landing-card relative flex h-full min-w-0 flex-col"
                  }
                >
                  {card.popular ? (
                    <div className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-md bg-[var(--landing-cta)] px-2.5 py-1 text-[11px] font-semibold text-white">
                      {t("popular")}
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        card.popular
                          ? "landing-icon landing-icon-lg landing-icon-accent"
                          : "landing-icon landing-icon-lg"
                      }
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={
                          card.popular
                            ? "text-xs font-semibold uppercase tracking-widest text-[var(--landing-cta)]"
                            : "text-xs font-semibold uppercase tracking-widest text-slate-500"
                        }
                      >
                        {card.label}
                      </div>
                      <div className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">
                        {card.price}
                        {card.id !== "free" ? (
                          <span className="text-base font-normal text-slate-500">
                            {t("perMonth")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-slate-700">{card.tagline}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{card.tagline2}</p>
                    </div>
                  </div>

                  <ul className="mt-6 flex flex-1 flex-col gap-2">
                    {card.features.map((f, i) => (
                      <li
                        key={`${card.id}-${f}-${i}`}
                        className="flex items-start gap-2.5 text-sm text-slate-700"
                      >
                        <Check
                          className={
                            card.popular
                              ? "mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-cta)]"
                              : "mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                          }
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {card.id === "free" ? (
                    <button
                      type="button"
                      onClick={() => {
                        trackMarketingEvent("marketing_pricing_interaction", {
                          plan: "free",
                          action: "open_viewer",
                        });
                        onGoToFreeViewer();
                      }}
                      className="landing-btn-secondary landing-btn-block mt-7"
                    >
                      {t("openViewer")}
                      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    </button>
                  ) : (
                    <Link
                      href="/sign-in"
                      onClick={() =>
                        trackMarketingEvent("marketing_pricing_interaction", {
                          plan: card.id,
                          action: "start_trial",
                        })
                      }
                      className={
                        card.popular
                          ? "landing-btn-primary landing-btn-block mt-7"
                          : "landing-btn-secondary landing-btn-block mt-7"
                      }
                    >
                      {t("startTrial14")}
                      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    </Link>
                  )}
                </div>
              </AnimateIn>
            );
          })}
        </div>

        <AnimateIn delay={200} className="mt-20">
          <h3 className="text-center text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t("compareTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600">
            {t("compareSubtitle")}
          </p>

          <div className="landing-card landing-card-flush mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                    {t("compareFeature")}
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {t("freeLabel")}
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {t("teamLabel")}
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-[var(--landing-cta)]">
                    {t("proLabel")}
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {t("enterpriseLabel")}
                  </th>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-3 text-xs text-slate-500 sm:px-5">{t("comparePrice")}</td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-slate-900">
                    {t("freePrice")}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-slate-900">
                    ${TEAM_MONTHLY_PRICE_USD}
                    <span className="font-normal text-slate-500">{t("perMonth")}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-slate-900">
                    ${PRO_MONTHLY_PRICE_USD}
                    <span className="font-normal text-slate-500">{t("perMonth")}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-semibold text-slate-900">
                    ${ENTERPRISE_MONTHLY_PRICE_USD}
                    <span className="font-normal text-slate-500">{t("perMonth")}</span>
                  </td>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 sm:px-5">{row.feature}</td>
                    <td className="px-3 py-3 text-center">
                      <CellValue value={row.free} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <CellValue value={row.team} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <CellValue value={row.pro} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <CellValue value={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimateIn>

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
          {t("footnote", { seats: PRO_INCLUDED_SEATS })}
        </p>
      </div>
    </section>
  );
}
