"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, HardHat, Wrench } from "lucide-react";
import { getSolutionsByCategory, LANDING_SOLUTIONS } from "@/lib/landingContent";
import { SOLUTION_ICONS } from "./solutionIcons";

/** Four featured construction tools shown in the dropdown; audit + proposal linked via "View all". */
const featuredConstruction = getSolutionsByCategory("construction").filter((s) =>
  ["viewer", "issues", "rfis", "takeoff"].includes(s.slug),
);

/** Four featured operations tools shown in the dropdown; rest linked via "View all". */
const featuredOperations = getSolutionsByCategory("operations").filter((s) =>
  ["om-handover", "om-assets", "om-maintenance", "om-fm-dashboard"].includes(s.slug),
);

export function SolutionsDropdown() {
  const t = useTranslations("solutionsMenu");
  const navT = useTranslations("nav");
  const solutionT = useTranslations("solutionCopy");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const getLocalizedSolution = (slug: string, field: "title" | "tagline", fallback: string) =>
    solutionT.has(`${slug}.${field}`) ? solutionT(`${slug}.${field}`) : fallback;

  const overlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            {/* Backdrop */}
            <button
              type="button"
              aria-label={t("closeMenu")}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />

            {/* Floating mega-menu panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("menuAria")}
              className="fixed inset-x-0 top-16 z-50"
            >
              <div className="border-y border-slate-200/80 bg-white/98 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.78fr)] lg:gap-5 lg:py-6">
                  <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 lg:p-5">
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="landing-icon landing-icon-accent" aria-hidden>
                        <HardHat className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600">
                          {t("constructionLabel")}
                        </p>
                        <p className="text-[11px] text-slate-500">{t("constructionTagline")}</p>
                      </div>
                    </div>

                    <ul className="space-y-1">
                      {featuredConstruction.map((s) => {
                        const Icon = SOLUTION_ICONS[s.slug];
                        return (
                          <li key={s.slug}>
                            <Link
                              href={`/solutions/${s.slug}`}
                              onClick={() => setOpen(false)}
                              className="group flex items-start gap-3 rounded-xl border border-transparent bg-white/70 p-2.5 transition hover:border-slate-200 hover:bg-white"
                            >
                              <span className="landing-icon mt-0.5" aria-hidden>
                                <Icon className="h-4 w-4" strokeWidth={1.75} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900 transition group-hover:text-blue-700">
                                  {getLocalizedSolution(s.slug, "title", s.title)}
                                </span>
                                <span className="block text-xs leading-relaxed text-slate-500">
                                  {getLocalizedSolution(s.slug, "tagline", s.tagline)}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>

                    <Link
                      href="/solutions/audit"
                      onClick={() => setOpen(false)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                      <span>{t("constructionExtra")}</span>
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  </section>

                  <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 lg:p-5">
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="landing-icon" aria-hidden>
                        <Wrench className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600">
                          {t("operationsLabel")}
                        </p>
                        <p className="text-[11px] text-slate-500">{t("operationsTagline")}</p>
                      </div>
                    </div>

                    <ul className="space-y-1">
                      {featuredOperations.map((s) => {
                        const Icon = SOLUTION_ICONS[s.slug];
                        return (
                          <li key={s.slug}>
                            <Link
                              href={`/solutions/${s.slug}`}
                              onClick={() => setOpen(false)}
                              className="group flex items-start gap-3 rounded-xl border border-transparent bg-white/70 p-2.5 transition hover:border-slate-200 hover:bg-white"
                            >
                              <span className="landing-icon mt-0.5" aria-hidden>
                                <Icon className="h-4 w-4" strokeWidth={1.75} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900 transition group-hover:text-slate-700">
                                  {getLocalizedSolution(s.slug, "title", s.title)}
                                </span>
                                <span className="block text-xs leading-relaxed text-slate-500">
                                  {getLocalizedSolution(s.slug, "tagline", s.tagline)}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>

                    <Link
                      href="/solutions"
                      onClick={() => setOpen(false)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <span>{t("viewAllOperations")}</span>
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  </section>

                  <aside className="landing-card">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t("toolsCount", { count: LANDING_SOLUTIONS.length })}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {t("quickLinksBody")}
                    </p>
                    <div className="mt-4 space-y-2">
                      <Link
                        href="/solutions"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {t("browseAll")}
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </Link>
                      <Link
                        href="/use-cases"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {navT("useCases")}
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </Link>
                      <Link
                        href="/case-studies"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {navT("caseStudies")}
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </Link>
                      <Link
                        href="/pricing"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {navT("pricing")}
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </Link>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`landing-type-nav inline-flex items-center gap-1 rounded-lg px-2.5 py-2 transition ${
          open || pathname.startsWith("/solutions")
            ? "bg-slate-900/[0.04] text-slate-900"
            : "text-slate-600 hover:bg-slate-900/[0.03] hover:text-slate-900"
        }`}
      >
        {t("trigger")}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
          aria-hidden
        />
      </button>
      {overlay}
    </div>
  );
}
