"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { AnimateIn } from "./AnimateIn";

type LandingFinalCtaSectionProps = {
  onGoToFreeViewer: (source?: string) => void;
};

export function LandingFinalCtaSection({ onGoToFreeViewer }: LandingFinalCtaSectionProps) {
  const t = useTranslations("finalCta");
  return (
    <section
      id="cta"
      className="relative isolate scroll-mt-20 min-h-104 overflow-hidden border-t border-white/6 sm:min-h-120"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/images/cta/CTA-constraction-hero.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_32%] sm:object-[center_30%]"
          loading="lazy"
          fetchPriority="low"
          quality={75}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.2)_0%,rgba(15,23,42,0.28)_22%,rgba(15,23,42,0.42)_45%,rgba(15,23,42,0.78)_72%,rgba(2,6,23,0.97)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_52%,rgba(37,99,235,0.14)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.2),inset_0_-100px_140px_rgba(0,0,0,0.55)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center sm:px-8 sm:py-32 md:py-36">
        <AnimateIn>
          <h2 className="text-[2.05rem] font-bold tracking-tight text-blue-50 drop-shadow-[0_1px_20px_rgba(37,99,235,0.2)] sm:text-[2.5rem]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[1.02rem] leading-relaxed text-blue-100/85">
            {t("body")}
            <br />
            {t("bodyLine2")}
          </p>

          <div className="mt-10 flex min-w-0 flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => onGoToFreeViewer("final_cta_open_viewer")}
              className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl bg-(--landing-cta) px-7 py-3.5 text-base font-semibold text-(--landing-cta-text) shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] transition hover:bg-(--landing-cta-bright) hover:shadow-[color-mix(in_srgb,var(--landing-cta)_38%,transparent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {t("openViewer")} <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
            <Link
              href="/sign-in"
              onClick={() =>
                trackMarketingEvent("marketing_cta_click", {
                  ctaType: "start_trial",
                  source: "final_cta_trial",
                  destination: "/sign-in",
                })
              }
              className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl border border-white/45 bg-white/5 px-7 py-3.5 text-base font-semibold text-white/95 backdrop-blur-sm transition hover:border-white/80 hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {t("startTrial")}
            </Link>
          </div>

          <div className="mt-6 flex min-w-0 flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-blue-200/70">
            <span className="max-w-88 text-center">{t("footnote1")}</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>{t("footnote2")}</span>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
