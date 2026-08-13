"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";

const STACK = ["bim", "drawings", "assets", "commissioning", "om", "maintenance"] as const;

export function LandingHandoverSection() {
  const t = useTranslations("handover");

  return (
    <section
      id="handover"
      className="landing-band-white landing-section scroll-mt-20 border-t border-white/8"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10 xl:gap-14">
          <AnimateIn className="flex flex-col justify-center">
            <p className="landing-type-label text-[var(--landing-label)]">{t("eyebrow")}</p>
            <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
            <p className="landing-lede mt-4 max-w-md">{t("body")}</p>

            <ul className="mt-8 space-y-2">
              {STACK.map((key) => (
                <li
                  key={key}
                  className="flex items-center gap-3 border-b border-white/8 py-2.5 text-sm font-medium text-white last:border-0"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--landing-cta)]"
                    aria-hidden
                  />
                  {t(`stack.${key}`)}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
              {t("operations")}
            </p>
          </AnimateIn>

          <AnimateIn delay={70}>
            <figure className="landing-photo-frame relative mx-auto aspect-3/4 w-full max-w-lg shadow-[0_32px_80px_-36px_rgba(0,0,0,0.75)] lg:max-w-none lg:aspect-4/5">
              <Image
                src="/images/landing/hardware-leds.png"
                alt=""
                fill
                className="landing-photo object-cover object-[62%_center]"
                sizes="(max-width: 1024px) 100vw, 560px"
                quality={82}
              />
              <div className="landing-photo-frame-scrim" aria-hidden />
              <div
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(37,99,235,0.12)_0%,transparent_45%)]"
                aria-hidden
              />

              <figcaption className="landing-photo-caption">
                <p className="landing-photo-kicker">Live infrastructure</p>
                <p className="landing-photo-title">Signal. Status. Continuity.</p>
                <p className="landing-photo-body">
                  The same equipment that powers the facility stays linked to drawings, documents,
                  and operational history.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Active", "Monitored", "Documented"].map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/35 px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-slate-100 backdrop-blur-sm"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                      {label}
                    </span>
                  ))}
                </div>
              </figcaption>
            </figure>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}
