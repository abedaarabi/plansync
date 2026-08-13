"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ensureGsap, ScrollTrigger } from "./landingGsap";

const SOURCES = [
  { key: "drawings", formats: "PDFs" },
  { key: "bim", formats: "Revit / IFC" },
  { key: "documents", formats: "Spreadsheets" },
  { key: "equipment", formats: "Excel" },
] as const;

export function LandingProblemSection() {
  const t = useTranslations("problem");
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;

    const gsap = ensureGsap();
    const sources = root.querySelectorAll("[data-problem-source]");
    const disconnect = root.querySelector("[data-problem-disconnect]");
    const connect = root.querySelector("[data-problem-connect]");

    const ctx = gsap.context(() => {
      gsap.from(sources, {
        opacity: 0,
        y: 16,
        stagger: 0.08,
        duration: 0.55,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 75%" },
      });
      if (disconnect && connect) {
        gsap
          .timeline({
            scrollTrigger: { trigger: root, start: "top 65%" },
          })
          .fromTo(disconnect, { opacity: 0.35 }, { opacity: 1, duration: 0.4 })
          .fromTo(connect, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55 }, "+=0.15");
      }
    }, root);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === root)
        .forEach((st) => st.kill());
    };
  }, [reducedMotion]);

  return (
    <section
      id="problem"
      ref={rootRef}
      className="landing-band-features landing-section scroll-mt-20 border-t border-white/8"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="landing-type-label text-[var(--landing-label)]">{t("eyebrow")}</p>
          <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
          <p className="landing-lede mt-4">{t("body")}</p>
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8">
          <div className="flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-3">
              {SOURCES.map((s) => (
                <div key={s.key} data-problem-source className="landing-surface p-4">
                  <p className="text-sm font-semibold text-white">{t(`sources.${s.key}`)}</p>
                  <p className="mt-1 text-xs text-slate-400">{s.formats}</p>
                  <div className="mt-3 h-px w-8 bg-slate-600" aria-hidden />
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3 text-center">
              <p
                data-problem-disconnect
                className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300/90"
              >
                {t("disconnected")}
              </p>
              <div className="mx-auto h-8 w-px bg-slate-600" aria-hidden />
              <div
                data-problem-connect
                className="inline-flex flex-col items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)] bg-[color-mix(in_srgb,var(--landing-cta)_18%,transparent)] px-5 py-3"
              >
                <span className="text-sm font-bold text-sky-200">PlanSync</span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white">
                  {t("connected")}
                </span>
              </div>
            </div>
          </div>

          <figure className="landing-photo-frame relative min-h-72 sm:min-h-96">
            <Image
              src="/images/landing/site-earthworks.png"
              alt=""
              fill
              className="landing-photo object-cover object-[center_55%]"
              sizes="(max-width: 1024px) 100vw, 560px"
              quality={80}
            />
            <div className="landing-photo-frame-scrim" aria-hidden />

            <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
              <span className="landing-photo-chip landing-photo-chip-warn">Construction phase</span>
            </div>

            <figcaption className="landing-photo-caption">
              <p className="landing-photo-kicker" style={{ color: "rgba(253, 230, 138, 0.9)" }}>
                Before the facility is live
              </p>
              <p className="landing-photo-title">The build generates thousands of records.</p>
              <p className="landing-photo-body">
                Drawings, models, inspections, and equipment lists — PlanSync keeps them tied to the
                facility instead of buried in folders.
              </p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
