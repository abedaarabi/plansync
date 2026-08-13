"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { LandingLanguageSwitcher } from "./LandingLanguageSwitcher";
import type { LandingNavMenuItem } from "./LandingNavMenu";

type LandingNavMobileSheetProps = {
  dark: boolean;
  isLoggedIn: boolean;
  productItems: LandingNavMenuItem[];
  resourceItems: LandingNavMenuItem[];
  label: (key: string, fallback: string) => string;
  onClose: () => void;
  onGoToFreeViewer: (source?: string) => void;
};

export function LandingNavMobileSheet({
  dark,
  isLoggedIn,
  productItems,
  resourceItems,
  label,
  onClose,
  onGoToFreeViewer,
}: LandingNavMobileSheetProps) {
  const t = useTranslations("nav");
  const solutionsMenuT = useTranslations("solutionsMenu");
  const strong = dark ? "text-white" : "text-slate-900";
  const muted = dark ? "text-slate-400" : "text-slate-500";

  return (
    <div
      className={
        dark
          ? "mt-2 max-h-[min(78dvh,36rem)] overflow-y-auto rounded-2xl border border-white/12 bg-[rgba(11,18,32,0.96)] px-5 pb-6 pt-4 shadow-[0_20px_42px_-24px_rgba(0,0,0,0.55)] backdrop-blur-md lg:hidden"
          : "mt-2 max-h-[min(78dvh,36rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white px-5 pb-6 pt-4 shadow-[0_20px_42px_-24px_rgba(15,23,42,0.25)] lg:hidden"
      }
    >
      <div className="flex flex-col gap-5">
        <MobileNavGroup dark={dark} title={label("product", "Product")}>
          {productItems.map((item) => (
            <MobileNavLink key={item.href} dark={dark} href={item.href} onClick={onClose}>
              {item.label}
            </MobileNavLink>
          ))}
        </MobileNavGroup>

        <div>
          <Link
            href="/solutions"
            className={`landing-type-nav inline-flex font-semibold ${strong}`}
            onClick={onClose}
          >
            {solutionsMenuT("trigger")}
          </Link>
          <p className={`mt-1 text-xs leading-relaxed ${muted}`}>
            {label("solutionsMobileHint", "Owners, builders, MEP, commissioning, and ops")}
          </p>
        </div>

        <Link
          href="/#data-centers"
          className={`landing-type-nav font-semibold ${strong}`}
          onClick={onClose}
        >
          {label("dataCenters", "Data Centers")}
        </Link>

        <MobileNavGroup dark={dark} title={label("resources", "Resources")}>
          {resourceItems.map((item) => (
            <MobileNavLink key={item.href} dark={dark} href={item.href} onClick={onClose}>
              {item.label}
            </MobileNavLink>
          ))}
        </MobileNavGroup>

        <Link
          href="/pricing"
          className={`landing-type-nav font-semibold ${strong}`}
          onClick={onClose}
        >
          {t("pricing")}
        </Link>

        <LandingLanguageSwitcher variant="mobile" />
        <hr className={dark ? "border-white/10" : "border-slate-100"} />

        {isLoggedIn ? (
          <Link
            href="/projects"
            className={`landing-type-nav ${dark ? "text-slate-300" : "text-slate-700"}`}
            onClick={onClose}
          >
            {t("dashboard")}
          </Link>
        ) : (
          <Link
            href="/sign-in"
            onClick={() => {
              onClose();
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
        <Link
          href="/sign-in"
          onClick={() => {
            onClose();
            trackMarketingEvent("marketing_cta_click", {
              ctaType: "explore_plansync",
              source: "nav_mobile_explore",
              destination: "/sign-in",
            });
          }}
          className="landing-btn-primary landing-btn-block"
        >
          {label("getStarted", "Get started")}
        </Link>
        <button
          type="button"
          onClick={() => {
            onClose();
            onGoToFreeViewer("nav_mobile_open_pdf");
          }}
          className={`landing-type-caption text-center underline-offset-2 hover:underline ${
            dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {label("openPdf", "Open a PDF →")}
        </button>
      </div>
    </div>
  );
}

function MobileNavGroup({
  title,
  children,
  dark = false,
}: {
  title: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div>
      <p className={`landing-type-label mb-2 ${dark ? "text-slate-400" : "text-slate-500"}`}>
        {title}
      </p>
      <div
        className={`flex flex-col gap-1 border-l pl-3 ${dark ? "border-white/10" : "border-slate-100"}`}
      >
        {children}
      </div>
    </div>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
  dark = false,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`landing-type-nav py-1.5 ${dark ? "text-slate-300" : "text-slate-700"}`}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
