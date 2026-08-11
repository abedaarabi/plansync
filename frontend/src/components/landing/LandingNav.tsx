"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { LandingLanguageSwitcher } from "./LandingLanguageSwitcher";
import { LandingNavMenu, type LandingNavMenuItem } from "./LandingNavMenu";
import { SolutionsDropdown } from "./SolutionsDropdown";

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
  const solutionsMenuT = useTranslations("solutionsMenu");

  const label = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

  const productItems: LandingNavMenuItem[] = [
    {
      href: "/#cde",
      label: label("cde", "CDE"),
      description: label("cdeDesc", "Common data environment"),
    },
    {
      href: "/story",
      label: label("story", "Story"),
      description: label("storyDesc", "From first drawing to ops"),
    },
    {
      href: "/#bim",
      label: label("features", "Features"),
      description: label("featuresDesc", "Plans, BIM, and clash"),
    },
    {
      href: "/#how-it-works",
      label: label("howItWorks", "How it works"),
      description: label("howItWorksDesc", "From PDF to project clarity"),
    },
    {
      href: "/#install",
      label: label("install", "Install"),
      description: label("installDesc", "Add PlanSync to your device"),
    },
  ];

  const resourceItems: LandingNavMenuItem[] = [
    {
      href: "/use-cases",
      label: label("useCases", "Use cases"),
      description: label("useCasesDesc", "How teams run the work"),
    },
    {
      href: "/case-studies",
      label: label("caseStudies", "Case studies"),
      description: label("caseStudiesDesc", "Proof from real projects"),
    },
    {
      href: "/#faq",
      label: label("faq", "FAQ"),
      description: label("faqDesc", "Billing, storage, and plans"),
    },
  ];

  const pricingActive = pathname === "/pricing";
  const desktopLinkClass = (active: boolean) =>
    `landing-type-nav rounded-lg px-2.5 py-2 transition ${
      active
        ? "bg-slate-900/[0.04] text-slate-900"
        : "text-slate-600 hover:bg-slate-900/[0.03] hover:text-slate-900"
    }`;

  const closeMobile = () => setMobileOpen(false);

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

        <div className="hidden items-center gap-0.5 lg:flex">
          <SolutionsDropdown />
          <LandingNavMenu label={label("product", "Product")} items={productItems} />
          <Link href="/pricing" className={desktopLinkClass(pricingActive)}>
            {t("pricing")}
          </Link>
          <LandingNavMenu label={label("resources", "Resources")} items={resourceItems} />
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <LandingLanguageSwitcher />
          {isLoggedIn ? (
            <Link
              href="/projects"
              className="landing-type-nav rounded-lg px-3.5 py-2 text-slate-600 transition hover:bg-slate-900/3 hover:text-slate-900"
            >
              {t("dashboard")}
            </Link>
          ) : (
            <Link
              href="/sign-in"
              onClick={() =>
                trackMarketingEvent("marketing_cta_click", {
                  ctaType: "sign_in",
                  source: "nav_desktop",
                  destination: "/sign-in",
                })
              }
              className="landing-btn-secondary landing-btn-sm"
            >
              {t("signIn")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => onGoToFreeViewer("nav_desktop_start_free")}
            className="landing-btn-primary landing-btn-sm"
          >
            {t("startFree")}
          </button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {!isLoggedIn ? (
            <Link
              href="/sign-in"
              onClick={() =>
                trackMarketingEvent("marketing_cta_click", {
                  ctaType: "sign_in",
                  source: "nav_mobile_header",
                  destination: "/sign-in",
                })
              }
              className="landing-btn-secondary landing-btn-sm"
            >
              {t("signIn")}
            </Link>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-slate-200/90 bg-white p-2.5 text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={t("toggleMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="mt-2 max-h-[min(78dvh,36rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white px-5 pb-6 pt-4 shadow-[0_20px_42px_-24px_rgba(15,23,42,0.25)] lg:hidden">
          <div className="flex flex-col gap-5">
            <div>
              <Link
                href="/solutions"
                className="landing-type-nav inline-flex font-semibold text-slate-900"
                onClick={closeMobile}
              >
                {solutionsMenuT("trigger")}
              </Link>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {label("solutionsMobileHint", "Construction tools and Operations & FM")}
              </p>
            </div>

            <MobileNavGroup title={label("product", "Product")}>
              {productItems.map((item) => (
                <MobileNavLink key={item.href} href={item.href} onClick={closeMobile}>
                  {item.label}
                </MobileNavLink>
              ))}
            </MobileNavGroup>

            <Link
              href="/pricing"
              className="landing-type-nav font-semibold text-slate-900"
              onClick={closeMobile}
            >
              {t("pricing")}
            </Link>

            <MobileNavGroup title={label("resources", "Resources")}>
              {resourceItems.map((item) => (
                <MobileNavLink key={item.href} href={item.href} onClick={closeMobile}>
                  {item.label}
                </MobileNavLink>
              ))}
            </MobileNavGroup>

            <LandingLanguageSwitcher variant="mobile" />
            <hr className="border-slate-100" />

            {isLoggedIn ? (
              <Link
                href="/projects"
                className="landing-type-nav text-slate-700"
                onClick={closeMobile}
              >
                {t("dashboard")}
              </Link>
            ) : (
              <Link
                href="/sign-in"
                onClick={() => {
                  closeMobile();
                  trackMarketingEvent("marketing_cta_click", {
                    ctaType: "sign_in",
                    source: "nav_mobile",
                    destination: "/sign-in",
                  });
                }}
                className="landing-btn-secondary landing-btn-block"
              >
                {t("signIn")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                closeMobile();
                onGoToFreeViewer("nav_mobile_start_free");
              }}
              className="landing-btn-primary landing-btn-block"
            >
              {t("startFree")}
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function MobileNavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="landing-type-label mb-2 text-slate-500">{title}</p>
      <div className="flex flex-col gap-1 border-l border-slate-100 pl-3">{children}</div>
    </div>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="landing-type-nav py-1.5 text-slate-700" onClick={onClick}>
      {children}
    </Link>
  );
}
