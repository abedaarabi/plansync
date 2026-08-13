"use client";

import { useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";

const LAYERS = ["drawings", "bim", "assets", "commissioning", "operations"] as const;

export function LandingPlatformLayersSection() {
  const t = useTranslations("platform");

  return (
    <section id="platform" className="landing-band-white landing-section scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="landing-type-label text-(--landing-label)">{t("eyebrow")}</p>
            <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
            <p className="landing-lede mt-4">{t("body")}</p>
          </div>
        </AnimateIn>

        <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-2.5">
          {LAYERS.map((key, i) => (
            <AnimateIn key={key} delay={i * 50}>
              <li className="landing-surface relative flex h-full flex-col p-4 lg:min-h-44 lg:p-4">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">
                  0{i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold tracking-tight text-white lg:text-[0.95rem]">
                  {t(`layers.${key}.title`)}
                </h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">
                  {t(`layers.${key}.body`)}
                </p>
                {i < LAYERS.length - 1 ? (
                  <span
                    className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-[color-mix(in_srgb,var(--landing-cta)_50%,transparent)] lg:block"
                    aria-hidden
                  />
                ) : null}
              </li>
            </AnimateIn>
          ))}
        </ol>
      </div>
    </section>
  );
}
