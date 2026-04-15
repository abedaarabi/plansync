"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { getSolutionsByCategory } from "@/lib/landingContent";
import { SolutionsDropdown } from "./SolutionsDropdown";

const mobileConstructionSolutions = getSolutionsByCategory("construction");
const mobileOperationsSolutions = getSolutionsByCategory("operations");

type LandingNavProps = {
  scrolled: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isLoggedIn: boolean;
  onGoToFreeViewer: () => void;
};

export function LandingNav({
  scrolled,
  mobileOpen,
  setMobileOpen,
  isLoggedIn,
  onGoToFreeViewer,
}: LandingNavProps) {
  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-slate-200/90 bg-white/98 shadow-[0_10px_36px_-14px_rgba(15,23,42,0.055)] backdrop-blur-md"
          : "border-slate-200/70 bg-white/96 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="PlanSync home">
          <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
          <span className="text-base font-bold tracking-tight text-slate-900">
            Plan<span className="text-blue-600">Sync</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <SolutionsDropdown />
          <Link
            href="/#walkthrough"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Watch demo
          </Link>
          <Link
            href="/#features"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Features
          </Link>
          <Link
            href="/#compare"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Pricing
          </Link>
          <Link
            href="/#faq"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            FAQ
          </Link>
          <Link
            href="/#install"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Install
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <Link
              href="/projects"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={onGoToFreeViewer}
            className="btn-shine relative overflow-hidden rounded-full bg-[var(--landing-cta)] px-5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_35%,transparent)] transition hover:bg-[var(--landing-cta-bright)] hover:ring-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)]"
          >
            Start Free &rarr;
          </button>
        </div>

        <button
          type="button"
          className="text-slate-800 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200/80 bg-white px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Construction
              </p>
              <div className="flex flex-col gap-1.5">
                {mobileConstructionSolutions.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/solutions/${s.slug}`}
                    className="text-sm font-medium text-slate-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                Operations & FM
              </p>
              <div className="flex flex-col gap-1.5">
                {mobileOperationsSolutions.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/solutions/${s.slug}`}
                    className="text-sm font-medium text-slate-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href="/#walkthrough"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              Watch demo
            </Link>
            <Link
              href="/#features"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              Features
            </Link>
            <Link
              href="/#compare"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="/#faq"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              FAQ
            </Link>
            <Link
              href="/#install"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              Install
            </Link>
            <hr className="border-slate-100" />
            {isLoggedIn ? (
              <Link href="/projects" className="text-sm font-medium text-slate-700">
                Dashboard
              </Link>
            ) : (
              <Link href="/sign-in" className="text-sm font-medium text-slate-700">
                Sign In
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onGoToFreeViewer();
              }}
              className="btn-shine relative overflow-hidden rounded-full bg-[var(--landing-cta)] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
            >
              Start Free &rarr;
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
