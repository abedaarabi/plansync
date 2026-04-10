"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANDING_SOLUTIONS } from "@/lib/landingContent";
import { SOLUTION_ICONS } from "./solutionIcons";

export function SolutionsDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-0.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        Solutions
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(calc(100vw-2rem),54rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.05]"
        >
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {solutionGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-slate-200/70 bg-slate-50/35 p-2"
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {group.title}
                </p>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((s) => {
                    const Icon = SOLUTION_ICONS[s.slug];
                    return (
                      <a
                        key={s.slug}
                        href={`#solution-${s.slug}`}
                        role="menuitem"
                        className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition duration-150 hover:-translate-y-px hover:border-slate-200/80 hover:bg-white"
                        onClick={() => setOpen(false)}
                      >
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)] transition duration-150 group-hover:bg-[color-mix(in_srgb,var(--landing-cta)_16%,white)] group-hover:text-[var(--landing-cta-bright)]"
                          aria-hidden
                        >
                          <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold tracking-tight text-slate-900 transition group-hover:text-slate-950">
                            {s.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500 transition group-hover:text-slate-600">
                            {s.description}
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
