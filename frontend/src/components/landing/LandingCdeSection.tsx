"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Building2,
  Database,
  GitBranch,
  Link2,
  ShieldCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { AnimateIn } from "./AnimateIn";

const PILLARS: {
  icon: LucideIcon;
  titleKey:
    | "pillar1Title"
    | "pillar2Title"
    | "pillar3Title"
    | "pillar4Title"
    | "pillar5Title"
    | "pillar6Title";
  bodyKey:
    | "pillar1Body"
    | "pillar2Body"
    | "pillar3Body"
    | "pillar4Body"
    | "pillar5Body"
    | "pillar6Body";
}[] = [
  { icon: Database, titleKey: "pillar1Title", bodyKey: "pillar1Body" },
  { icon: GitBranch, titleKey: "pillar2Title", bodyKey: "pillar2Body" },
  { icon: Users2, titleKey: "pillar3Title", bodyKey: "pillar3Body" },
  { icon: ShieldCheck, titleKey: "pillar4Title", bodyKey: "pillar4Body" },
  { icon: Link2, titleKey: "pillar5Title", bodyKey: "pillar5Body" },
  { icon: Building2, titleKey: "pillar6Title", bodyKey: "pillar6Body" },
];

export function LandingCdeSection() {
  const t = useTranslations("cdeSection");

  return (
    <section
      id="cde"
      className="landing-band-features relative scroll-mt-20 overflow-hidden border-t border-slate-200/70 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-300/60 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end lg:gap-14">
          <AnimateIn>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 max-w-[16ch] text-balance text-[2rem] font-bold tracking-tight text-slate-900 sm:text-[2.45rem]">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-slate-600 sm:text-[1.08rem]">
              {t("body")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/story" className="landing-btn-primary">
                {t("storyCta")}
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              </Link>
              <Link href="/solutions" className="landing-btn-secondary">
                {t("solutionsCta")}
              </Link>
            </div>
          </AnimateIn>

          <AnimateIn delay={80}>
            <div className="landing-card landing-card-lg border-(--landing-cta)/20 bg-[color-mix(in_srgb,var(--landing-cta)_4%,white)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
                {t("calloutLabel")}
              </p>
              <p className="mt-3 text-[1.05rem] font-semibold tracking-tight text-slate-900 sm:text-[1.15rem]">
                {t("calloutTitle")}
              </p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">
                {t("calloutBody")}
              </p>
            </div>
          </AnimateIn>
        </div>

        <div className="mt-12 grid gap-3 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <AnimateIn key={pillar.titleKey} delay={40 + i * 35}>
                <article className="landing-card landing-card-hover flex h-full flex-col gap-3.5">
                  <span className="landing-icon landing-icon-accent" aria-hidden>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-[1rem] font-semibold tracking-tight text-slate-900">
                      {t(pillar.titleKey)}
                    </h3>
                    <p className="mt-1.5 text-[0.92rem] leading-relaxed text-slate-600">
                      {t(pillar.bodyKey)}
                    </p>
                  </div>
                </article>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
