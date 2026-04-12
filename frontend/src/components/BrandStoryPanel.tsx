"use client";

import Image from "next/image";
import Link from "next/link";

/** Marketing hero still — same asset as the landing hero poster. */
export const CTA_HERO_IMAGE = "/images/cta/CTA-constraction-hero.webp";

/** Same tagline as the marketing footer brand column. */
export const BRAND_TAGLINE =
  "The construction drawing workspace for teams who can't afford to work off the wrong information.";

export type CtaHeroAtmosphereProps = {
  className?: string;
  /** Passed to `next/image` `sizes` (viewport coverage of the photo). */
  sizes?: string;
  priority?: boolean;
};

/**
 * Construction CTA photo with the same scrims, blue radials, and dot grid as the auth brand column.
 * Parent should be `position: relative` with bounded height.
 */
export function CtaHeroAtmosphere({
  className = "",
  sizes = "100vw",
  priority = false,
}: CtaHeroAtmosphereProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`.trim()}>
      <div className="absolute inset-0 z-0">
        <Image
          src={CTA_HERO_IMAGE}
          alt=""
          fill
          className="object-cover object-[center_36%]"
          sizes={sizes}
          priority={priority}
          quality={75}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-slate-950/90 via-slate-900/82 to-slate-950/93"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 20% 0%, rgba(59, 130, 246, 0.45), transparent 52%), radial-gradient(ellipse 80% 55% at 100% 100%, rgba(37, 99, 235, 0.3), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.14] landing-dots"
        aria-hidden
      />
    </div>
  );
}

export type BrandStoryPanelProps = {
  backHref: string;
  backLabel: string;
  /** When true, panel sticks under the fixed nav while the sibling column scrolls (marketing pages). */
  stickyOnLarge?: boolean;
  className?: string;
};

export function BrandStoryPanel({
  backHref,
  backLabel,
  stickyOnLarge = false,
  className = "",
}: BrandStoryPanelProps) {
  return (
    <aside
      className={`relative hidden h-full min-h-0 overflow-hidden bg-[#0F172A] px-6 py-6 lg:flex lg:flex-col xl:px-10 xl:py-8 ${
        stickyOnLarge
          ? "lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)] lg:shrink-0"
          : ""
      } ${className}`.trim()}
    >
      <CtaHeroAtmosphere sizes="(max-width: 1023px) 0vw, 55vw" priority />
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col justify-between gap-4 drop-shadow-[0_1px_12px_rgba(0,0,0,0.35)]">
        <Link
          href="/"
          className="group flex w-fit max-w-full shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] p-3 shadow-md ring-1 ring-white/[0.06] backdrop-blur-md transition hover:border-white/15 hover:bg-white/[0.11]"
        >
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
            <Image src="/logo.svg" alt="" width={40} height={40} className="h-9 w-9" priority />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-lg font-bold tracking-tight text-white">PlanSync</span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
              plansync.dev
            </span>
          </span>
        </Link>

        <div className="min-h-0 flex-1 overflow-hidden py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Built for the field
          </p>
          <p className="mt-2 line-clamp-4 text-sm font-medium leading-snug text-slate-300">
            {BRAND_TAGLINE}
          </p>
          <div
            className="mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-sky-400 to-blue-600"
            aria-hidden
          />
        </div>

        <div className="shrink-0 border-t border-white/10 pt-3">
          <p className="text-xs text-slate-500">
            <Link
              href={backHref}
              className="font-medium text-slate-400 transition hover:text-white"
            >
              {backLabel}
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}

type MarketingHeroBackdropProps = {
  /** When false, image is only behind content on small screens (sign-in pattern). */
  showImageOnLarge?: boolean;
  className?: string;
};

/**
 * Right-column atmosphere: optional CTA photo + scrim + blue radials (matches sign-in).
 */
export function MarketingHeroBackdrop({
  showImageOnLarge = true,
  className = "",
}: MarketingHeroBackdropProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 ${className}`.trim()}>
      <div className={`absolute inset-0 ${showImageOnLarge ? "" : "lg:hidden"}`}>
        <Image
          src={CTA_HERO_IMAGE}
          alt=""
          fill
          className="object-cover object-[center_36%]"
          sizes="(max-width: 1023px) 100vw, 50vw"
          quality={75}
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-slate-950/92 via-slate-950/94 to-slate-950/96"
          aria-hidden
        />
      </div>
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(59, 130, 246, 0.22), transparent 55%), radial-gradient(ellipse 100% 60% at 100% 100%, rgba(15, 23, 42, 0.35), transparent)",
        }}
        aria-hidden
      />
    </div>
  );
}
