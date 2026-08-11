"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Box, Crosshair } from "lucide-react";
import type { ReactNode } from "react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { AnimateIn } from "./AnimateIn";
import { YOUTUBE_BIM_VIEWER_ID } from "./constants";
import { LandingYoutubeFacade } from "./YouTubeEmbeds";

const VIEWER_BULLETS = ["viewerBullet1", "viewerBullet2", "viewerBullet3"] as const;
const CLASH_BULLETS = ["clashBullet1", "clashBullet2", "clashBullet3"] as const;

function BulletCheck() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-(--landing-cta)"
      fill="none"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path
        d="M5 8.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Soft product frame — screenshots already include app chrome. */
function ProductShot({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-[0_28px_65px_-18px_rgba(15,23,42,0.2),0_0_0_1px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
      <div className="relative aspect-16/10 w-full">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain object-center"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority={priority}
          loading={priority ? undefined : "lazy"}
          quality={82}
        />
      </div>
    </div>
  );
}

function FeatureCopy({
  icon,
  iconClass,
  labelClass,
  label,
  title,
  body,
  bullets,
}: {
  icon: ReactNode;
  iconClass: string;
  labelClass: string;
  label: string;
  title: string;
  body: string;
  bullets: readonly string[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/75 bg-white p-7 shadow-[0_24px_48px_-20px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/3 sm:p-8 lg:p-9">
      <div className="flex items-start gap-3.5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${iconClass}`}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${labelClass}`}>
            {label}
          </p>
          <h3 className="mt-1.5 text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-[1.55rem]">
            {title}
          </h3>
        </div>
      </div>
      <p className="mt-4 text-[0.98rem] leading-relaxed text-slate-600 sm:text-[1.02rem]">{body}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {bullets.map((text) => (
          <li key={text} className="flex gap-3">
            <BulletCheck />
            <span className="text-sm leading-relaxed text-slate-600">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingBimShowcaseSection() {
  const t = useTranslations("bimShowcase");

  return (
    <section
      id="bim"
      className="landing-atmosphere relative scroll-mt-20 overflow-hidden border-t border-slate-200/70 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-300/60 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateIn className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-[2rem] font-bold tracking-tight text-slate-900 sm:text-[2.55rem] sm:leading-[1.1]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[1rem] leading-relaxed text-slate-600 sm:text-[1.08rem]">
            {t("body")}
          </p>
        </AnimateIn>

        <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-24">
          <AnimateIn
            delay={60}
            className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:gap-12"
          >
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-4 rounded-4xl bg-[radial-gradient(ellipse_at_50%_40%,color-mix(in_srgb,var(--landing-cta)_18%,transparent),transparent_65%)] blur-2xl"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 shadow-[0_28px_65px_-18px_rgba(15,23,42,0.2),0_0_0_1px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
                <LandingYoutubeFacade
                  videoId={YOUTUBE_BIM_VIEWER_ID}
                  title={t("viewerVideoTitle")}
                  playAriaLabel={t("viewerPlayAriaLabel")}
                  posterAlt={t("viewerImageAlt")}
                  posterSrc="/images/3dviewer.webp"
                  playButtonId="bim-viewer-play"
                />
              </div>
            </div>
            <FeatureCopy
              icon={<Box className="h-5 w-5" strokeWidth={1.75} />}
              iconClass="bg-linear-to-br from-blue-600 to-blue-700 shadow-blue-600/25"
              labelClass="text-blue-700/90"
              label={t("viewerLabel")}
              title={t("viewerTitle")}
              body={t("viewerBody")}
              bullets={VIEWER_BULLETS.map((key) => t(key))}
            />
          </AnimateIn>

          <AnimateIn delay={80} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="order-2 lg:order-1">
              <FeatureCopy
                icon={<Crosshair className="h-5 w-5" strokeWidth={1.75} />}
                iconClass="bg-linear-to-br from-rose-600 to-orange-600 shadow-rose-600/20"
                labelClass="text-rose-700/90"
                label={t("clashLabel")}
                title={t("clashTitle")}
                body={t("clashBody")}
                bullets={CLASH_BULLETS.map((key) => t(key))}
              />
            </div>
            <div className="order-1 lg:order-2">
              <ProductShot src="/images/clash.webp" alt={t("clashImageAlt")} />
            </div>
          </AnimateIn>
        </div>

        <AnimateIn delay={100} className="mt-14 flex flex-col items-center gap-3 sm:mt-16">
          <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <Link
              href="/sign-in"
              onClick={() =>
                trackMarketingEvent("marketing_cta_click", {
                  ctaType: "start_trial",
                  source: "bim_showcase",
                  destination: "/sign-in",
                })
              }
              className="landing-btn-primary"
            >
              {t("cta")}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => document.getElementById("bim-viewer-play")?.click()}
            >
              {t("ctaSecondary")}
            </button>
          </div>
          <p className="text-sm text-slate-500">{t("ctaHint")}</p>
        </AnimateIn>
      </div>
    </section>
  );
}
