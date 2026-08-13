"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ensureGsap, ScrollTrigger } from "./landingGsap";
import { AnimateIn } from "./AnimateIn";

const ROWS = [
  { key: "electrical", pct: 96, ok: true },
  { key: "mechanical", pct: 94, ok: true },
  { key: "cooling", pct: 89, ok: false },
  { key: "fire", pct: 98, ok: true },
  { key: "security", pct: 92, ok: true },
  { key: "controls", pct: 84, ok: false },
  { key: "commissioning", pct: 87, ok: false },
  { key: "documentation", pct: 91, ok: true },
] as const;

const ISSUES = [
  { id: "CRAH-02-017", key: "crah" },
  { id: "UPS-03", key: "ups" },
  { id: "PDU-14", key: "pdu" },
  { id: "Generator-02", key: "generator" },
] as const;

export function LandingReadinessSection() {
  const t = useTranslations("readiness");
  const rootRef = useRef<HTMLElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) {
      if (pctRef.current) pctRef.current.textContent = "91";
      return;
    }

    const gsap = ensureGsap();
    const rows = root.querySelectorAll("[data-ready-row]");
    const issues = root.querySelectorAll("[data-ready-issue]");
    const obj = { n: 0 };

    const ctx = gsap.context(() => {
      gsap.to(obj, {
        n: 91,
        duration: 1.4,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 70%" },
        onUpdate: () => {
          if (pctRef.current) pctRef.current.textContent = String(Math.round(obj.n));
        },
      });
      gsap.from(rows, {
        opacity: 0,
        x: -8,
        stagger: 0.05,
        duration: 0.4,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 68%" },
      });
      gsap.from(issues, {
        opacity: 0,
        y: 8,
        stagger: 0.06,
        duration: 0.4,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 60%" },
      });
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
      id="readiness"
      ref={rootRef}
      className="landing-band-white landing-section scroll-mt-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="landing-type-label text-(--landing-label)">{t("eyebrow")}</p>
            <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
            <p className="landing-lede mt-4">{t("body")}</p>
          </div>
        </AnimateIn>

        <div className="landing-product-chrome mx-auto mt-12 max-w-3xl">
          <div className="landing-product-chrome-bar">
            <div className="flex items-center gap-2">
              <span className="flex gap-1" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
              </span>
              <p className="text-sm font-semibold tracking-tight text-white">{t("dashTitle")}</p>
            </div>
            <p className="text-xs text-slate-400">{t("overall")}</p>
          </div>

          <div className="border-b border-white/8 bg-[#0c1524] px-4 py-5 sm:px-5">
            <p className="text-4xl font-semibold tracking-tight text-white">
              <span ref={pctRef}>0</span>
              <span className="text-2xl text-slate-400">%</span>
            </p>
          </div>

          <ul className="divide-y divide-white/8 bg-[#101c32] px-2 py-1 sm:px-3">
            {ROWS.map((row) => (
              <li
                key={row.key}
                data-ready-row
                className="flex items-center justify-between gap-3 px-2 py-2.5 text-sm"
              >
                <span className="font-medium text-slate-100">{t(`rows.${row.key}`)}</span>
                <span className="flex items-center gap-2.5 tabular-nums">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10 sm:w-20">
                    <span
                      className={`block h-full rounded-full ${
                        row.ok ? "bg-emerald-400/80" : "bg-amber-400/80"
                      }`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </span>
                  <span className="w-8 text-right text-slate-300">{row.pct}%</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-white/10 bg-[#0c1524] px-4 py-4 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              {t("outstanding")}
            </p>
            <ul className="mt-3 space-y-2">
              {ISSUES.map((item) => (
                <li
                  key={item.id}
                  data-ready-issue
                  className="flex flex-col gap-0.5 rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-semibold text-sky-300">{item.id}</span>
                  <span className="text-xs text-slate-300">{t(`issues.${item.key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
