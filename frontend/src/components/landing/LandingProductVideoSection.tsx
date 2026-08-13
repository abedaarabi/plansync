"use client";

import { useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";
import { YOUTUBE_CLASH_DETECTION_ID } from "./constants";
import { ProductVideo } from "./ProductVideo";

/**
 * Cinematic clash-detection product video — sits under the proof band
 * ("Built for real construction and FM workflows").
 */
export function LandingProductVideoSection() {
  const t = useTranslations("productVideo");

  return (
    <section
      id="product-video"
      className="landing-band-white relative scroll-mt-20 overflow-hidden border-b border-slate-200/70 py-20 sm:py-28 lg:py-32"
      aria-labelledby="product-video-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-300/55 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimateIn className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            {t("eyebrow")}
          </p>
          <h2
            id="product-video-heading"
            className="mt-4 text-balance text-[1.85rem] font-semibold leading-[1.12] tracking-tight text-slate-900 sm:mt-5 sm:text-[2.45rem] sm:leading-[1.08]"
          >
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[1rem] leading-relaxed text-slate-600 sm:mt-5 sm:text-[1.08rem]">
            {t("body")}
          </p>
        </AnimateIn>

        <AnimateIn delay={80} className="mx-auto mt-12 max-w-6xl sm:mt-14 lg:mt-16">
          <ProductVideo
            youtubeId={YOUTUBE_CLASH_DETECTION_ID}
            thumbnail="/images/clash.webp"
            title={t("videoTitle")}
            playAriaLabel={t("playAriaLabel")}
            thumbnailAlt={t("thumbnailAlt")}
            caption={t("caption")}
          />
        </AnimateIn>
      </div>
    </section>
  );
}
