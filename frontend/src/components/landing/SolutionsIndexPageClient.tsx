"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import {
  getSolutionsByCategory,
  LANDING_SOLUTIONS,
  LANDING_SOLUTIONS_SECTION,
} from "@/lib/landingContent";
import { AnimateIn } from "./AnimateIn";
import { MarketingShell, useMarketingGoToFreeViewer } from "./MarketingShell";
import { SolutionsDirectory } from "./SolutionsDirectory";
import { SolutionVisualPlaceholder } from "./SolutionVisualPlaceholder";

function SolutionsIndexPageInner() {
  const goToFreeViewer = useMarketingGoToFreeViewer();
  const nConstruction = getSolutionsByCategory("construction").length;
  const nOperations = getSolutionsByCategory("operations").length;

  return (
    <div className="pt-16">
      <div className="landing-band-pricing relative min-w-0 overflow-hidden lg:min-h-[calc(100dvh-4rem)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Home
            </Link>
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm"
            >
              <Image
                src="/logo.svg"
                alt="PlanSync"
                width={28}
                height={28}
                className="h-7 w-7"
                priority
                unoptimized
              />
            </Link>
          </div>

          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <nav
              className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-slate-500"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="font-medium transition hover:text-slate-900">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              <span className="font-semibold text-slate-900">Solutions</span>
            </nav>

            <AnimateIn>
              <header className="border-b border-slate-200/80 pb-10 sm:pb-12">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start lg:gap-12">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                      <LayoutGrid
                        className="h-3.5 w-3.5 text-(--landing-cta)"
                        strokeWidth={2}
                        aria-hidden
                      />
                      {LANDING_SOLUTIONS_SECTION.eyebrow}
                    </div>

                    <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.25rem] lg:leading-tight">
                      {LANDING_SOLUTIONS_SECTION.title}
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-[17px] sm:leading-relaxed">
                      {LANDING_SOLUTIONS_SECTION.description}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-xs shadow-sm">
                        <span className="font-semibold tabular-nums text-slate-900">
                          {LANDING_SOLUTIONS.length}
                        </span>
                        <span className="text-slate-500">total modules</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200/60 bg-blue-50/50 px-3 py-2 text-xs shadow-sm">
                        <span className="font-semibold tabular-nums text-blue-900">
                          {nConstruction}
                        </span>
                        <span className="text-blue-800/80">construction</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 text-xs shadow-sm">
                        <span className="font-semibold tabular-nums text-emerald-900">
                          {nOperations}
                        </span>
                        <span className="text-emerald-800/80">operations</span>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={goToFreeViewer}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-(--landing-cta) px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-(--landing-cta-bright)"
                      >
                        Open free viewer
                      </button>
                      <Link
                        href="/sign-in"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Start Pro trial
                      </Link>
                      <Link
                        href="#solutions-construction"
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
                      >
                        Jump to modules
                      </Link>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Workspace overview
                    </p>
                    <SolutionVisualPlaceholder
                      tone="slate"
                      accentSolidBg="bg-blue-600"
                      label="Product preview"
                      hint="Screenshot or diagram"
                      aspectClass="aspect-[4/3] min-h-[200px]"
                      className="w-full rounded-xl shadow-sm"
                    />
                  </div>
                </div>
              </header>
            </AnimateIn>

            <div className="mt-10 sm:mt-12">
              <SolutionsDirectory />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SolutionsIndexPageClient() {
  return (
    <MarketingShell>
      <SolutionsIndexPageInner />
    </MarketingShell>
  );
}
