"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { AnimateIn } from "./AnimateIn";
import { DEMO_MAILTO } from "./landingGsap";

type LandingFinalCtaSectionProps = {
  onGoToFreeViewer: (source?: string) => void;
};

export function LandingFinalCtaSection({ onGoToFreeViewer }: LandingFinalCtaSectionProps) {
  const t = useTranslations("finalCta");
  return (
    <section
      id="cta"
      className="relative isolate scroll-mt-20 min-h-96 overflow-hidden border-t border-white/8 sm:min-h-104"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/images/landing/dc-aisle.png"
          alt=""
          fill
          sizes="100vw"
          className="landing-photo-soft object-cover object-[center_40%]"
          loading="lazy"
          fetchPriority="low"
          quality={75}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,18,32,0.55)_0%,rgba(11,18,32,0.78)_45%,rgba(11,18,32,0.96)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_55%,rgba(37,99,235,0.18)_100%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-20 text-center sm:px-8 sm:py-28">
        <AnimateIn>
          <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[1.02rem] leading-[1.7] text-slate-200/90">
            {t("body")}
          </p>

          <div className="mt-9 flex min-w-0 flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-in"
              onClick={() =>
                trackMarketingEvent("marketing_cta_click", {
                  ctaType: "explore_plansync",
                  source: "final_cta",
                  destination: "/sign-in",
                })
              }
              className="landing-btn-primary"
            >
              {t("explore")}
              <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
            <a
              href={DEMO_MAILTO}
              onClick={() =>
                trackMarketingEvent("marketing_cta_click", {
                  ctaType: "book_demo",
                  source: "final_cta_demo",
                  destination: "mailto",
                })
              }
              className="landing-btn-ghost"
            >
              {t("bookDemo")}
            </a>
          </div>

          <button
            type="button"
            onClick={() => onGoToFreeViewer("final_cta_open_pdf")}
            className="landing-type-caption mt-5 text-slate-400 underline-offset-4 transition hover:text-white hover:underline"
          >
            {t("openPdf")}
          </button>
        </AnimateIn>
      </div>
    </section>
  );
}
