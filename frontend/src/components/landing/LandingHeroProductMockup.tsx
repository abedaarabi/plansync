"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ensureGsap } from "./landingGsap";

const RAIL = ["Drawings", "BIM", "Assets", "Commissioning", "O&M", "Issues"] as const;

type LandingHeroProductMockupProps = {
  className?: string;
};

export function LandingHeroProductMockup({ className = "" }: LandingHeroProductMockupProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;

    const gsap = ensureGsap();
    const pin = root.querySelector("[data-mock-pin]");
    const bimGlow = root.querySelector("[data-mock-bim-glow]");
    const panel = root.querySelector("[data-mock-panel]");
    const docs = root.querySelector("[data-mock-docs]");

    if (!pin || !bimGlow || !panel || !docs) return;

    gsap.set([bimGlow, panel, docs], { opacity: 0 });
    gsap.set(panel, { x: 12 });
    gsap.set(pin, { scale: 0.7, opacity: 0.4 });

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 6.5 });
    tl.to(pin, { scale: 1, opacity: 1, duration: 0.45, ease: "power2.out" })
      .to(bimGlow, { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.15")
      .to(panel, { opacity: 1, x: 0, duration: 0.55, ease: "power2.out" }, "-=0.2")
      .to(docs, { opacity: 1, duration: 0.45, ease: "power2.out" }, "-=0.15")
      .to({}, { duration: 3.5 })
      .to([docs, panel, bimGlow], { opacity: 0, duration: 0.4, stagger: 0.05 })
      .to(pin, { scale: 0.7, opacity: 0.4, duration: 0.35 }, "-=0.2");

    return () => {
      tl.kill();
    };
  }, [reducedMotion]);

  return (
    <div ref={rootRef} className={`landing-product-chrome overflow-hidden ${className}`.trim()}>
      <div className="landing-product-chrome-bar">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-white">
            Plan<span className="text-[var(--landing-cta)]">Sync</span>
          </span>
          <span className="rounded border border-white/12 bg-white/6 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
            DC-01
          </span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-sky-300">
          Live facility model
        </span>
      </div>

      <div className="grid grid-cols-1 bg-[#0c1524] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="relative min-h-40 border-b border-white/8 sm:min-h-52 sm:border-b-0 sm:border-r">
          <p className="absolute left-2 top-2 z-10 rounded bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
            Floor plan
          </p>
          <Image
            src="/images/measure.png"
            alt=""
            fill
            className="object-cover object-[20%_top] opacity-80"
            sizes="(max-width: 640px) 100vw, 220px"
            priority
            quality={78}
          />
          <span
            data-mock-pin
            className="absolute left-[42%] top-[48%] z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--landing-cta) shadow-[0_0_0_4px_rgba(37,99,235,0.35)]"
            aria-hidden
          />
        </div>

        <div className="relative min-h-40 border-b border-white/8 sm:min-h-52 sm:border-b-0 sm:border-r">
          <p className="absolute left-2 top-2 z-10 rounded bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
            3D BIM
          </p>
          <Image
            src="/images/3dviewer.webp"
            alt=""
            fill
            className="object-cover object-[60%_40%] opacity-80"
            sizes="(max-width: 640px) 100vw, 280px"
            priority
            quality={78}
          />
          <div
            data-mock-bim-glow
            className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-(--landing-cta) bg-[color-mix(in_srgb,var(--landing-cta)_18%,transparent)]"
            aria-hidden
          />
        </div>

        <div
          data-mock-panel
          className="flex min-h-40 flex-col gap-2 bg-[#101c32] p-3 sm:min-h-52 sm:p-3.5"
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Asset
          </p>
          <p className="text-sm font-bold tracking-tight text-white">CRAH-017</p>
          <dl className="space-y-1.5 text-[11px] leading-snug text-slate-300">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">System</dt>
              <dd className="font-medium text-slate-100">Cooling</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Location</dt>
              <dd className="font-medium text-slate-100">Data Hall 02</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Level</dt>
              <dd className="font-medium text-slate-100">L02</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-semibold text-emerald-400">Operational</dd>
            </div>
          </dl>
          <div data-mock-docs className="mt-auto border-t border-white/10 pt-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Documents
            </p>
            <ul className="space-y-0.5 text-[10px] text-slate-300">
              <li>O&amp;M Manual</li>
              <li>Commissioning Report</li>
              <li>Warranty</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-t border-white/10 bg-[#070d18] px-2 py-1.5 sm:gap-1.5 sm:px-3">
        {RAIL.map((label) => (
          <span
            key={label}
            className={`rounded px-2 py-1 text-[10px] font-medium ${
              label === "Assets" ? "bg-(--landing-cta) text-white" : "text-slate-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
