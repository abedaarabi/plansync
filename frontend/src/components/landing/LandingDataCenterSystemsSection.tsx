"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";

const SYSTEMS = [
  { key: "electrical", items: ["UPS", "Switchgear", "PDU", "Generator"] },
  { key: "mechanical", items: ["Chillers", "CRAH", "Pumps", "Cooling loops"] },
  { key: "fire", items: ["Fire pumps", "Detection", "Suppression"] },
  { key: "controls", items: ["BMS", "EPMS", "Monitoring"] },
] as const;

export function LandingDataCenterSystemsSection() {
  const t = useTranslations("systems");

  return (
    <section id="data-centers" className="landing-band-features landing-section scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn>
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left">
            <p className="landing-type-label text-[var(--landing-label)]">{t("eyebrow")}</p>
            <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
            <p className="landing-lede mt-4">{t("body")}</p>
          </div>
        </AnimateIn>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-8">
          <AnimateIn>
            <figure className="landing-photo-frame relative min-h-80 sm:min-h-104 lg:min-h-full lg:aspect-auto">
              <Image
                src="/images/landing/rack-aisle.png"
                alt=""
                fill
                className="landing-photo object-cover object-[center_40%]"
                sizes="(max-width: 1024px) 100vw, 640px"
                quality={80}
              />
              <div className="landing-photo-frame-scrim" aria-hidden />

              <div className="absolute left-4 top-4 flex flex-col gap-2 sm:left-5 sm:top-5">
                <span className="landing-photo-chip">DC-01</span>
                <span className="landing-photo-chip landing-photo-chip-accent">Data Hall 02</span>
              </div>

              <div className="absolute right-4 top-4 hidden text-right sm:block sm:right-5 sm:top-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  Facility model
                </p>
                <p className="mt-1 font-mono text-xs text-sky-200/90">Bay A · L02</p>
              </div>

              <figcaption className="landing-photo-caption">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="landing-photo-kicker">Physical to digital</p>
                    <p className="landing-photo-title">
                      Every rack is an asset waiting to be connected.
                    </p>
                  </div>
                  <div className="flex gap-6 border-l border-white/15 pl-5 text-left">
                    <div>
                      <p className="font-mono text-lg font-semibold text-white">240+</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        Cabinets
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-semibold text-white">4</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Systems</p>
                    </div>
                  </div>
                </div>
              </figcaption>
            </figure>
          </AnimateIn>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {SYSTEMS.map((sys, i) => (
              <AnimateIn key={sys.key} delay={i * 45}>
                <div className="landing-surface flex h-full flex-col justify-between p-4 sm:p-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-sky-300/80">
                      0{i + 1}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-white">
                      {t(`cats.${sys.key}`)}
                    </h3>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {sys.items.join(" · ")}
                  </p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
