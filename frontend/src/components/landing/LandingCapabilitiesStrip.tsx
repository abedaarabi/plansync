"use client";

import { useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";

const STAGES = ["drawings", "bim", "assets", "commissioning", "operations"] as const;

export function LandingCapabilitiesStrip() {
  const t = useTranslations("capabilities");

  return (
    <section id="capabilities" className="landing-band-features landing-section scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="landing-type-label text-[var(--landing-label)]">{t("eyebrow")}</p>
            <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
            <p className="landing-lede mt-3 text-sm sm:text-base">{t("body")}</p>
          </div>
        </AnimateIn>

        <ol className="relative mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-5">
          <div
            className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] sm:block"
            aria-hidden
          />
          {STAGES.map((key, i) => (
            <li key={key} className="landing-surface relative p-4 text-center sm:pt-5">
              <span className="mx-auto mb-3 flex h-2.5 w-2.5 rounded-full bg-[var(--landing-cta)]" />
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-sky-300/80">
                0{i + 1}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-white">{t(`stages.${key}.title`)}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {t(`stages.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
