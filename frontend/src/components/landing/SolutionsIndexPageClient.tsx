"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandStoryPanel, MarketingHeroBackdrop } from "@/components/BrandStoryPanel";
import { LANDING_SOLUTIONS_SECTION } from "@/lib/landingContent";
import { MarketingShell } from "./MarketingShell";
import { SolutionsDirectory } from "./SolutionsDirectory";

export function SolutionsIndexPageClient() {
  return (
    <MarketingShell>
      <div className="pt-16 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-stretch">
        <BrandStoryPanel backHref="/" backLabel="← Back to site" stickyOnLarge />

        <div className="relative min-w-0 bg-[var(--enterprise-auth-bg)] lg:min-h-[calc(100dvh-4rem)]">
          <MarketingHeroBackdrop />

          <div className="relative z-10">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0F172A] px-4 py-2 lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200 ring-1 ring-white/[0.06] transition hover:border-white/15 hover:bg-white/[0.1] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Home
              </Link>
              <Link
                href="/"
                className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 ring-1 ring-white/[0.06]"
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

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
              <div
                className="relative overflow-hidden border border-slate-200/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8 lg:p-10"
                style={{ borderRadius: "16px" }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
                  aria-hidden
                />
                <div className="relative mx-auto max-w-3xl text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                    {LANDING_SOLUTIONS_SECTION.eyebrow}
                  </p>
                  <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    {LANDING_SOLUTIONS_SECTION.title}
                  </h1>
                  <p className="mx-auto mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
                    {LANDING_SOLUTIONS_SECTION.description}
                  </p>
                </div>
                <SolutionsDirectory className="relative mt-10 sm:mt-12" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
