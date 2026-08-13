"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Box,
  Briefcase,
  CircleHelp,
  ClipboardCheck,
  Layers,
  Link2,
  Menu,
  PackageCheck,
  Users,
  X,
} from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { LandingLanguageSwitcher } from "./LandingLanguageSwitcher";
import { LandingNavMenu, type LandingNavMenuItem } from "./LandingNavMenu";
import { LandingNavMobileSheet } from "./LandingNavMobileSheet";
import { SolutionsDropdown } from "./SolutionsDropdown";

type LandingNavProps = {
  scrolled: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isLoggedIn: boolean;
  onGoToFreeViewer: (source?: string) => void;
  dark?: boolean;
};

function navShellClass(dark: boolean, scrolled: boolean) {
  if (dark) {
    return scrolled
      ? "border-white/12 bg-[rgba(11,18,32,0.92)] shadow-[0_20px_42px_-24px_rgba(0,0,0,0.55)] backdrop-blur-md"
      : "border-white/10 bg-[rgba(11,18,32,0.78)] shadow-[0_8px_28px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl";
  }
  return scrolled
    ? "border-slate-200/90 bg-white/98 shadow-[0_20px_42px_-24px_rgba(15,23,42,0.25)] backdrop-blur-md"
    : "border-slate-200/70 bg-white/95 shadow-[0_8px_28px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl";
}

function desktopLinkClass(dark: boolean, active: boolean) {
  if (dark) {
    return `landing-type-nav rounded-lg px-2.5 py-2 transition ${
      active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/6 hover:text-white"
    }`;
  }
  return `landing-type-nav rounded-lg px-2.5 py-2 transition ${
    active
      ? "bg-slate-900/4 text-slate-900"
      : "text-slate-600 hover:bg-slate-900/3 hover:text-slate-900"
  }`;
}

export function LandingNav({
  scrolled,
  mobileOpen,
  setMobileOpen,
  isLoggedIn,
  onGoToFreeViewer,
  dark = false,
}: LandingNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const label = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

  const productItems: LandingNavMenuItem[] = [
    {
      href: "/#platform",
      label: label("bimDrawings", "BIM & Drawings"),
      description: label("bimDrawingsDesc", "Plans and models in one context"),
      icon: Layers,
    },
    {
      href: "/#workflow",
      label: label("assetIntelligence", "Asset Intelligence"),
      description: label("assetIntelligenceDesc", "From element to operable asset"),
      icon: Link2,
    },
    {
      href: "/#readiness",
      label: label("commissioning", "Commissioning"),
      description: label("commissioningDesc", "Readiness tied to equipment"),
      icon: ClipboardCheck,
    },
    {
      href: "/#handover",
      label: label("operations", "Operations"),
      description: label("operationsDesc", "Carry data into O&M"),
      icon: PackageCheck,
    },
    {
      href: "/#capabilities",
      label: label("collaboration", "Collaboration"),
      description: label("collaborationDesc", "Issues, RFIs, and team workspace"),
      icon: Users,
    },
    {
      href: "/solutions/bim-viewer",
      label: label("bimViewer", "BIM 3D viewer"),
      description: label("bimViewerDesc", "IFC models next to drawings"),
      icon: Box,
    },
  ];

  const resourceItems: LandingNavMenuItem[] = [
    {
      href: "/use-cases",
      label: label("useCases", "Use cases"),
      description: label("useCasesDesc", "How teams run the work"),
      icon: Briefcase,
    },
    {
      href: "/case-studies",
      label: label("caseStudies", "Case studies"),
      description: label("caseStudiesDesc", "Proof from real projects"),
      icon: BookOpen,
    },
    {
      href: "/#faq",
      label: label("faq", "FAQ"),
      description: label("faqDesc", "Billing, storage, and plans"),
      icon: CircleHelp,
    },
  ];

  const closeMobile = () => setMobileOpen(false);
  const pricingActive = pathname === "/pricing";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={`mx-auto flex h-15 max-w-6xl items-center justify-between rounded-2xl border px-4 transition-[background,box-shadow,border-color] duration-300 sm:px-5 ${navShellClass(dark, scrolled)}`}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="PlanSync home">
          <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
          <span
            className={`text-base font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}
          >
            Plan<span className="text-blue-500">Sync</span>
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          <LandingNavMenu dark={dark} label={label("product", "Product")} items={productItems} />
          <SolutionsDropdown dark={dark} />
          <Link href="/#data-centers" className={desktopLinkClass(dark, false)}>
            {label("dataCenters", "Data Centers")}
          </Link>
          <LandingNavMenu
            dark={dark}
            label={label("resources", "Resources")}
            items={resourceItems}
          />
          <Link href="/pricing" className={desktopLinkClass(dark, pricingActive)}>
            {t("pricing")}
          </Link>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <LandingLanguageSwitcher />
          {isLoggedIn ? (
            <Link
              href="/projects"
              className={
                dark
                  ? "landing-type-nav rounded-lg px-3.5 py-2 text-slate-300 transition hover:bg-white/6 hover:text-white"
                  : "landing-type-nav rounded-lg px-3.5 py-2 text-slate-600 transition hover:bg-slate-900/3 hover:text-slate-900"
              }
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
          <Link
            href="/sign-in"
            onClick={() =>
              trackMarketingEvent("marketing_cta_click", {
                ctaType: "explore_plansync",
                source: "nav_desktop_explore",
                destination: "/sign-in",
              })
            }
            className="landing-btn-primary landing-btn-sm"
          >
            {label("getStarted", "Get started")}
          </Link>
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
            className={
              dark
                ? "rounded-xl border border-white/15 bg-white/8 p-2.5 text-white shadow-sm transition hover:bg-white/12"
                : "rounded-xl border border-slate-200/90 bg-white p-2.5 text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            }
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={t("toggleMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <LandingNavMobileSheet
          dark={dark}
          isLoggedIn={isLoggedIn}
          productItems={productItems}
          resourceItems={resourceItems}
          label={label}
          onClose={closeMobile}
          onGoToFreeViewer={onGoToFreeViewer}
        />
      ) : null}
    </nav>
  );
}
