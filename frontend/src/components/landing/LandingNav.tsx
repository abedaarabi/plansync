"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { getSolutionsByCategory } from "@/lib/landingContent";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { LandingLanguageSwitcher } from "./LandingLanguageSwitcher";
import { SolutionsDropdown } from "./SolutionsDropdown";

const mobileConstructionSolutions = getSolutionsByCategory("construction");
const mobileOperationsSolutions = getSolutionsByCategory("operations");

type LandingNavProps = {
  scrolled: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isLoggedIn: boolean;
  onGoToFreeViewer: (source?: string) => void;
};

export function LandingNav({
  scrolled,
  mobileOpen,
  setMobileOpen,
  isLoggedIn,
  onGoToFreeViewer,
}: LandingNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const solutionT = useTranslations("solutionCopy");
  const getLocalizedSolutionTitle = (slug: string, fallback: string) =>
    solutionT.has(`${slug}.title`) ? solutionT(`${slug}.title`) : fallback;
  const desktopLinkClass = (href: string) => {
    const isActive =
      href === "/pricing"
        ? pathname === "/pricing"
        : href === "/use-cases"
          ? pathname.startsWith("/use-cases")
          : href === "/case-studies"
            ? pathname.startsWith("/case-studies")
            : false;
    return `rounded-lg px-2.5 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-slate-900/[0.04] text-slate-900"
        : "text-slate-600 hover:bg-slate-900/[0.03] hover:text-slate-900"
    }`;
  };
  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={`mx-auto flex h-15 max-w-6xl items-center justify-between rounded-2xl border px-4 transition-[background,box-shadow,border-color] duration-300 sm:px-5 ${
          scrolled
            ? "border-slate-200/90 bg-white/98 shadow-[0_20px_42px_-24px_rgba(15,23,42,0.25)] backdrop-blur-md"
            : "border-slate-200/70 bg-white/95 shadow-[0_8px_28px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="PlanSync home">
          <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
          <span className="text-base font-bold tracking-tight text-slate-900">
            Plan<span className="text-blue-600">Sync</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1.5 md:flex">
          <SolutionsDropdown />
          <Link href="/#features" className={desktopLinkClass("/#features")}>
            {t("features")}
          </Link>
          <Link href="/pricing" className={desktopLinkClass("/pricing")}>
            {t("pricing")}
          </Link>
          <Link href="/use-cases" className={desktopLinkClass("/use-cases")}>
            {t("useCases")}
          </Link>
          <Link href="/case-studies" className={desktopLinkClass("/case-studies")}>
            {t("caseStudies")}
          </Link>
          <Link href="/#faq" className={desktopLinkClass("/#faq")}>
            {t("faq")}
          </Link>
          <Link href="/#install" className={desktopLinkClass("/#install")}>
            {t("install")}
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LandingLanguageSwitcher />
          {isLoggedIn ? (
            <Link
              href="/projects"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/3 hover:text-slate-900"
            >
              {t("dashboard")}
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                onClick={() =>
                  trackMarketingEvent("marketing_cta_click", {
                    ctaType: "sign_in",
                    source: "nav_desktop",
                    destination: "/sign-in",
                  })
                }
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/sign-in?mode=sign-up"
                onClick={() =>
                  trackMarketingEvent("marketing_cta_click", {
                    ctaType: "sign_up",
                    source: "nav_desktop",
                    destination: "/sign-in?mode=sign-up",
                  })
                }
                className="rounded-lg border border-slate-900/15 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Sign up
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={() => onGoToFreeViewer("nav_desktop_start_free")}
            className="btn-shine relative overflow-hidden rounded-full bg-(--landing-cta) px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--landing-cta)_55%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_35%,transparent)] transition hover:bg-(--landing-cta-bright) hover:ring-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)]"
          >
            {t("startFree")}
          </button>
        </div>

        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-white p-2.5 text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t("toggleMenu")}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mt-2 rounded-2xl border border-slate-200/80 bg-white px-5 pb-6 pt-4 shadow-[0_20px_42px_-24px_rgba(15,23,42,0.25)] md:hidden">
          <div className="flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                {t("construction")}
              </p>
              <div className="flex flex-col gap-1.5">
                {mobileConstructionSolutions.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/solutions/${s.slug}`}
                    className="text-sm font-medium text-slate-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    {getLocalizedSolutionTitle(s.slug, s.title)}
                  </Link>
                ))}
              </div>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                {t("operationsFm")}
              </p>
              <div className="flex flex-col gap-1.5">
                {mobileOperationsSolutions.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/solutions/${s.slug}`}
                    className="text-sm font-medium text-slate-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    {getLocalizedSolutionTitle(s.slug, s.title)}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href="/#features"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              {t("features")}
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              {t("pricing")}
            </Link>
            <Link
              href="/use-cases"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              {t("useCases")}
            </Link>
            <Link
              href="/case-studies"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              {t("caseStudies")}
            </Link>
            <Link
              href="/#faq"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              {t("faq")}
            </Link>
            <Link
              href="/#install"
              className="text-sm text-slate-600"
              onClick={() => setMobileOpen(false)}
            >
              {t("install")}
            </Link>
            <LandingLanguageSwitcher variant="mobile" />
            <hr className="border-slate-100" />
            {isLoggedIn ? (
              <Link href="/projects" className="text-sm font-medium text-slate-700">
                {t("dashboard")}
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  onClick={() =>
                    trackMarketingEvent("marketing_cta_click", {
                      ctaType: "sign_in",
                      source: "nav_mobile",
                      destination: "/sign-in",
                    })
                  }
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("signIn")}
                </Link>
                <Link
                  href="/sign-in?mode=sign-up"
                  onClick={() =>
                    trackMarketingEvent("marketing_cta_click", {
                      ctaType: "sign_up",
                      source: "nav_mobile",
                      destination: "/sign-in?mode=sign-up",
                    })
                  }
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Sign up
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onGoToFreeViewer("nav_mobile_start_free");
              }}
              className="btn-shine relative overflow-hidden rounded-xl bg-(--landing-cta) px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-(--landing-cta-bright)"
            >
              {t("startFree")}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
