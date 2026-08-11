"use client";

import Link from "next/link";
import { ArrowUpRight, HardHat, Wrench } from "lucide-react";
import { getSolutionsByCategory, SOLUTION_CATEGORIES } from "@/lib/landingContent";
import type { SolutionCategory } from "@/lib/landingContent";
import { SOLUTION_ICONS } from "./solutionIcons";

const GROUPS: { category: SolutionCategory }[] = [
  { category: "construction" },
  { category: "operations" },
];

/** Short phase labels — reads like a project app, not editorial copy. */
const PART_LABEL: Record<SolutionCategory, string> = {
  construction: "Delivery & field",
  operations: "Handover & operations",
};

const CATEGORY_ICONS: Record<SolutionCategory, typeof HardHat> = {
  construction: HardHat,
  operations: Wrench,
};

type SolutionsDirectoryProps = {
  onNavigate?: () => void;
  className?: string;
};

function scheduleNavigate(onNavigate?: () => void) {
  if (!onNavigate) return;
  queueMicrotask(onNavigate);
}

/** Category panels + module cards — construction SaaS directory pattern. */
export function SolutionsDirectory({ onNavigate, className = "" }: SolutionsDirectoryProps) {
  return (
    <div className={`space-y-8 ${className}`.trim()}>
      {GROUPS.map(({ category }) => {
        const meta = SOLUTION_CATEGORIES[category];
        const items = getSolutionsByCategory(category);
        const CategoryIcon = CATEGORY_ICONS[category];

        return (
          <section
            key={category}
            id={`solutions-${category}`}
            aria-labelledby={`cat-${category}`}
            className="landing-card landing-card-flush scroll-mt-24 overflow-hidden"
          >
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={
                      category === "construction"
                        ? "landing-icon landing-icon-lg landing-icon-accent"
                        : "landing-icon landing-icon-lg"
                    }
                    aria-hidden
                  >
                    <CategoryIcon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {PART_LABEL[category]}
                    </p>
                    <h2
                      id={`cat-${category}`}
                      className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                    >
                      {meta.label}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                      {meta.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                    <span className="tabular-nums text-base text-slate-900">{items.length}</span>
                    <span className="text-slate-500">modules</span>
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {meta.tagline}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((s) => {
                  const Icon = SOLUTION_ICONS[s.slug];
                  return (
                    <li key={s.slug}>
                      <Link
                        href={`/solutions/${s.slug}`}
                        onClick={() => scheduleNavigate(onNavigate)}
                        className="group relative flex h-full min-h-28 flex-col rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-offset-2"
                      >
                        <ArrowUpRight
                          className="absolute right-3 top-3 h-4 w-4 text-slate-300 transition group-hover:text-(--landing-cta)"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span className="landing-icon" aria-hidden>
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="mt-3 pr-6 text-[15px] font-semibold leading-snug text-slate-900">
                          {s.title}
                        </span>
                        <span className="mt-1 text-sm leading-snug text-slate-600">
                          {s.tagline}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
