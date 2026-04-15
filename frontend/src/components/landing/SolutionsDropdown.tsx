"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, HardHat, Wrench } from "lucide-react";
import { getSolutionsByCategory, LANDING_SOLUTIONS } from "@/lib/landingContent";
import { SOLUTION_ICON_COLORS, SOLUTION_ICONS } from "./solutionIcons";

/** Four featured construction tools shown in the dropdown; audit + proposal linked via "View all". */
const featuredConstruction = getSolutionsByCategory("construction").filter((s) =>
  ["viewer", "issues", "rfis", "takeoff"].includes(s.slug),
);

/** Four featured operations tools shown in the dropdown; rest linked via "View all". */
const featuredOperations = getSolutionsByCategory("operations").filter((s) =>
  ["om-handover", "om-assets", "om-maintenance", "om-fm-dashboard"].includes(s.slug),
);

export function SolutionsDropdown() {
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

  const overlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close solutions menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />

            {/* Floating mega-menu panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Solutions menu"
              className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 sm:px-6"
            >
              <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5">
                {/* Two-column grid */}
                <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {/* ── Construction column ── */}
                  <div className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 shadow-sm shadow-blue-600/30">
                        <HardHat className="h-4 w-4 text-white" strokeWidth={1.8} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-blue-600">
                          Construction
                        </p>
                        <p className="text-[11px] text-slate-400">Job site to office</p>
                      </div>
                    </div>

                    <ul className="space-y-0.5">
                      {featuredConstruction.map((s) => {
                        const Icon = SOLUTION_ICONS[s.slug];
                        const colors = SOLUTION_ICON_COLORS[s.slug];
                        return (
                          <li key={s.slug}>
                            <Link
                              href={`/solutions/${s.slug}`}
                              onClick={() => setOpen(false)}
                              className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-slate-50"
                            >
                              <span
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.bg} ${colors.ring}`}
                                aria-hidden
                              >
                                <Icon className={`h-4.5 w-4.5 ${colors.text}`} strokeWidth={1.8} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900 transition group-hover:text-blue-700">
                                  {s.title}
                                </span>
                                <span className="block text-xs leading-relaxed text-slate-500">
                                  {s.tagline}
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
                      className="mt-3 flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span>+ Audit, proposals, cloud storage</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {/* ── Operations column ── */}
                  <div className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 shadow-sm shadow-teal-600/30">
                        <Wrench className="h-4 w-4 text-white" strokeWidth={1.8} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-teal-600">
                          Operations & FM
                        </p>
                        <p className="text-[11px] text-slate-400">Handover to daily ops</p>
                      </div>
                    </div>

                    <ul className="space-y-0.5">
                      {featuredOperations.map((s) => {
                        const Icon = SOLUTION_ICONS[s.slug];
                        const colors = SOLUTION_ICON_COLORS[s.slug];
                        return (
                          <li key={s.slug}>
                            <Link
                              href={`/solutions/${s.slug}`}
                              onClick={() => setOpen(false)}
                              className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-slate-50"
                            >
                              <span
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.bg} ${colors.ring}`}
                                aria-hidden
                              >
                                <Icon className={`h-4.5 w-4.5 ${colors.text}`} strokeWidth={1.8} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900 transition group-hover:text-teal-700">
                                  {s.title}
                                </span>
                                <span className="block text-xs leading-relaxed text-slate-500">
                                  {s.tagline}
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
                      className="mt-3 flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-50 hover:text-teal-700"
                    >
                      <span>View all Operations tools</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
                  <p className="text-xs text-slate-500">
                    {LANDING_SOLUTIONS.length} tools across both product areas
                  </p>
                  <Link
                    href="/solutions"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--landing-cta) transition hover:text-(--landing-cta-bright)"
                  >
                    Browse all solutions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
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
        className="flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        Solutions
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>
      {overlay}
    </div>
  );
}
