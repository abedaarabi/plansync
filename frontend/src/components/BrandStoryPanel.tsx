"use client";

import Image from "next/image";
import Link from "next/link";

/** Marketing hero still — same asset as the landing hero poster. */
const CTA_HERO_IMAGE = "/images/cta/CTA-constraction-hero.webp";

/** Product-facing auth copy — operational, not marketing flourish. */
const BRAND_TAGLINE =
  "Project drawings, issues, and field workflows in one workspace — so teams always work from the current set.";

type CtaHeroAtmosphereProps = {
  className?: string;
  /** Passed to `next/image` `sizes` (viewport coverage of the photo). */
  sizes?: string;
  priority?: boolean;
};

/**
 * Construction CTA photo with the same scrims, blue radials, and dot grid as the auth brand column.
 * Parent should be `position: relative` with bounded height.
 */
function CtaHeroAtmosphere({
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
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col justify-between gap-6">
        <Link
          href="/"
          className="group flex w-fit max-w-full shrink-0 items-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2.5 transition hover:border-white/15 hover:bg-white/[0.09]"
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white">
            <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8" priority />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-base font-semibold tracking-tight text-white">
              Plan<span className="text-[var(--landing-cta)]">Sync</span>
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
              AEC project workspace
            </span>
          </span>
        </Link>

        <div className="min-h-0 flex-1 overflow-hidden py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Construction software
          </p>
          <p className="mt-3 max-w-md text-[15px] font-medium leading-relaxed text-slate-200">
            {BRAND_TAGLINE}
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-slate-400">
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Current drawings and revisions in one place
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Issues, RFIs, and punch tied to the sheet
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Field-ready on web and installed PWA
            </li>
          </ul>
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
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(37, 99, 235, 0.14), transparent 55%)",
        }}
        aria-hidden
      />
    </div>
  );
}
