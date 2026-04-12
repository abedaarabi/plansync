"use client";

import Link from "next/link";
import { LANDING_SOLUTIONS } from "@/lib/landingContent";
import { SOLUTION_ICONS } from "./solutionIcons";

const solutionGroups = [
  {
    title: "Core",
    items: LANDING_SOLUTIONS.filter((s) =>
      ["viewer", "issues", "rfis", "takeoff"].includes(s.slug),
    ),
  },
  {
    title: "O&M + FM",
    items: LANDING_SOLUTIONS.filter((s) => s.slug.startsWith("om-")),
  },
] as const;

const tableShell =
  "w-full overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--landing-cta)_22%,#e2e8f0)] bg-white shadow-[var(--enterprise-shadow-card)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_08%,transparent)]";

type SolutionsDirectoryProps = {
  /**
   * Called after a solution link is activated (e.g. close mega-menu).
   * Deferred so the Link can finish handing navigation to the router first.
   */
  onNavigate?: () => void;
  /** Extra classes on the outer wrapper. */
  className?: string;
};

function scheduleNavigate(onNavigate?: () => void) {
  if (!onNavigate) return;
  queueMicrotask(onNavigate);
}

export function SolutionsDirectory({ onNavigate, className = "" }: SolutionsDirectoryProps) {
  return (
    <div className={`space-y-8 ${className}`}>
      <div className="md:hidden space-y-6">
        {solutionGroups.map((group) => (
          <div key={group.title} className={tableShell}>
            <div className="border-b border-[color-mix(in_srgb,var(--landing-cta)_18%,#e2e8f0)] bg-[color-mix(in_srgb,var(--landing-cta)_07%,white)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                {group.title}
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.items.map((s) => {
                const Icon = SOLUTION_ICONS[s.slug];
                return (
                  <li key={s.slug}>
                    <Link
                      href={`/solutions/${s.slug}`}
                      onClick={() => scheduleNavigate(onNavigate)}
                      className="flex gap-3 px-4 py-3.5 transition hover:bg-[color-mix(in_srgb,var(--landing-cta)_05%,white)]"
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)]"
                        aria-hidden
                      >
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-semibold text-slate-900">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                          {s.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className={`hidden md:block ${tableShell}`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--landing-cta)_20%,#e2e8f0)] bg-[color-mix(in_srgb,var(--landing-cta)_08%,white)]">
              <th
                scope="col"
                className="w-[14%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--landing-cta)]"
              >
                Area
              </th>
              <th
                scope="col"
                className="w-[22%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--landing-cta)]"
              >
                Solution
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--landing-cta)]"
              >
                Summary
              </th>
            </tr>
          </thead>
          <tbody>
            {solutionGroups.map((group) =>
              group.items.map((s, rowIdx) => {
                const Icon = SOLUTION_ICONS[s.slug];
                const isFirstInGroup = rowIdx === 0;
                return (
                  <tr
                    key={s.slug}
                    className="border-b border-slate-100 transition last:border-b-0 hover:bg-[color-mix(in_srgb,var(--landing-cta)_04%,white)]"
                  >
                    <td className="align-top px-4 py-3.5 text-sm font-medium text-slate-700">
                      {isFirstInGroup ? (
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] px-2 py-1 text-xs font-semibold text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_18%,transparent)]">
                          {group.title}
                        </span>
                      ) : null}
                    </td>
                    <td className="align-top px-4 py-3.5">
                      <Link
                        href={`/solutions/${s.slug}`}
                        onClick={() => scheduleNavigate(onNavigate)}
                        className="group inline-flex items-start gap-3"
                      >
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)] transition group-hover:bg-[color-mix(in_srgb,var(--landing-cta)_16%,white)]"
                          aria-hidden
                        >
                          <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                        </span>
                        <span className="text-sm font-semibold text-slate-900 transition group-hover:text-[var(--landing-cta)]">
                          {s.title}
                        </span>
                      </Link>
                    </td>
                    <td className="align-top px-4 py-3.5">
                      <Link
                        href={`/solutions/${s.slug}`}
                        onClick={() => scheduleNavigate(onNavigate)}
                        className="block text-sm leading-relaxed text-slate-600 transition hover:text-slate-900"
                      >
                        {s.description}
                      </Link>
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
