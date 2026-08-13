"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ensureGsap } from "./landingGsap";
import { AnimateIn } from "./AnimateIn";
import { LandingScreenDepth } from "./LandingScreenDepth";

const DOCS = ["omManual", "commissioningReport", "warranty", "submittal"] as const;
const HISTORY = ["installation", "inspection", "commissioning", "maintenance"] as const;
type Pane = "2d" | "3d" | "asset";

export function LandingSignatureWorkflowSection() {
  const t = useTranslations("workflow");
  const [active, setActive] = useState(true);
  const [mobilePane, setMobilePane] = useState<Pane>("2d");
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!active || reducedMotion || !panelRef.current) return;
    const gsap = ensureGsap();
    const tl = gsap.fromTo(
      panelRef.current.querySelectorAll("[data-wf-fade]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: "power2.out" },
    );
    return () => {
      tl.kill();
    };
  }, [active, reducedMotion, mobilePane]);

  const selectAsset = () => {
    setActive(true);
    setMobilePane("asset");
  };

  const assetPanel = (
    <div ref={panelRef} className="bg-[#101c32] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {t("paneAsset")}
        </p>
        {active ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            {t("statusValue")}
          </span>
        ) : null}
      </div>
      {active ? (
        <>
          <p data-wf-fade className="mt-2 text-lg font-bold tracking-tight text-white">
            CRAH-017
          </p>
          <dl data-wf-fade className="mt-3 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between gap-3 border-b border-white/6 pb-2">
              <dt className="text-slate-500">{t("system")}</dt>
              <dd className="font-medium text-white">{t("systemValue")}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-white/6 pb-2">
              <dt className="text-slate-500">{t("location")}</dt>
              <dd className="font-medium text-white">{t("locationValue")}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-white/6 pb-2">
              <dt className="text-slate-500">{t("level")}</dt>
              <dd className="font-medium text-white">L02</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t("status")}</dt>
              <dd className="font-semibold text-emerald-400">{t("statusValue")}</dd>
            </div>
          </dl>
          <div
            data-wf-fade
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {t("documents")}
              </p>
              <ul className="mt-1.5 space-y-1.5 text-xs text-slate-300">
                {DOCS.map((k) => (
                  <li key={k} className="rounded-md border border-white/8 bg-white/4 px-2 py-1.5">
                    {t(`docItems.${k}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {t("history")}
              </p>
              <ul className="mt-1.5 space-y-1.5 text-xs text-slate-300">
                {HISTORY.map((k) => (
                  <li key={k} className="rounded-md border border-white/8 bg-white/4 px-2 py-1.5">
                    {t(`historyItems.${k}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-400">{t("idleHint")}</p>
      )}
    </div>
  );

  const pane2d = (
    <div className="relative min-h-56 bg-[#0c1524]">
      <p className="absolute left-3 top-3 z-10 rounded bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        {t("pane2d")}
      </p>
      <Image
        src="/images/markup.png"
        alt=""
        fill
        className="landing-photo object-cover object-[18%_top]"
        sizes="(max-width: 1024px) 100vw, 33vw"
      />
      {active ? (
        <button
          type="button"
          onClick={selectAsset}
          className="absolute left-[44%] top-[46%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--landing-cta) shadow-[0_0_0_5px_rgba(37,99,235,0.3)]"
          aria-label="CRAH-017"
        />
      ) : null}
    </div>
  );

  const pane3d = (
    <div className="relative min-h-56 bg-[#0c1524]">
      <p className="absolute left-3 top-3 z-10 rounded bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        {t("pane3d")}
      </p>
      <Image
        src="/images/clash.webp"
        alt=""
        fill
        className="landing-photo object-cover object-center"
        sizes="(max-width: 1024px) 100vw, 33vw"
      />
      {active ? (
        <div
          className="pointer-events-none absolute inset-[16%] rounded-lg border-2 border-(--landing-cta) bg-[color-mix(in_srgb,var(--landing-cta)_16%,transparent)]"
          aria-hidden
        />
      ) : null}
    </div>
  );

  return (
    <section id="workflow" className="landing-band-blue landing-section scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="landing-type-label text-(--landing-label)">{t("eyebrow")}</p>
            <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
            <p className="landing-lede mt-4">{t("body")}</p>
          </div>
        </AnimateIn>

        <div className="mt-12">
          <LandingScreenDepth intensity="hero">
            <div className="landing-product-chrome">
              <div className="landing-product-chrome-bar">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex gap-1" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                  </span>
                  <p className="truncate text-sm font-semibold text-white">{t("mockTitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActive((v) => !v)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-(--landing-cta) text-white"
                      : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  CRAH-017
                </button>
              </div>

              <div className="flex border-b border-white/10 lg:hidden">
                {(
                  [
                    ["2d", t("pane2d")],
                    ["3d", t("pane3d")],
                    ["asset", t("paneAsset")],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMobilePane(key)}
                    className={`flex-1 px-2 py-2.5 text-xs font-semibold transition ${
                      mobilePane === key
                        ? "border-b-2 border-(--landing-cta) text-white"
                        : "text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="lg:hidden">
                {mobilePane === "2d" ? pane2d : null}
                {mobilePane === "3d" ? pane3d : null}
                {mobilePane === "asset" ? assetPanel : null}
              </div>

              <div className="hidden lg:grid lg:grid-cols-3">
                <div className="border-r border-white/8">{pane2d}</div>
                <div className="border-r border-white/8">{pane3d}</div>
                {assetPanel}
              </div>
            </div>
          </LandingScreenDepth>
        </div>
      </div>
    </section>
  );
}
