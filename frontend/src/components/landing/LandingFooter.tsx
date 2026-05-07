"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { LANDING_SOLUTIONS } from "@/lib/landingContent";

type LandingFooterProps = {
  onGoToFreeViewer: () => void;
};

export function LandingFooter({ onGoToFreeViewer }: LandingFooterProps) {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-slate-800/80 bg-[#0F172A] text-white">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-8 sm:pt-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.svg"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
                unoptimized
              />
              <span className="text-base font-bold tracking-tight">PlanSync</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">{t("tagline")}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("product")}
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("howItWorks")}
                </Link>
              </li>
              <li>
                <Link
                  href="/solutions"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("allSolutions")}
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("features")}
                </Link>
              </li>
              <li>
                <Link
                  href="/#compare"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("pricing")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onGoToFreeViewer}
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("freeViewer")}
                </button>
              </li>
              <li>
                <span className="text-sm text-slate-500">{t("changelog")}</span>
              </li>
            </ul>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("solutionsHeading")}
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LANDING_SOLUTIONS.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/solutions/${s.slug}`}
                    className="text-sm text-slate-300 transition hover:text-[var(--landing-cta)]"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("company")}
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <span className="text-sm text-slate-500">{t("about")}</span>
              </li>
              <li>
                <span className="text-sm text-slate-500">{t("blog")}</span>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/plansyncdev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("contact")}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("legal")}
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <span className="text-sm text-slate-500">{t("terms")}</span>
              </li>
              <li>
                <span className="text-sm text-slate-500">{t("cookies")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-xs text-slate-500" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} PlanSync. {t("rights")}
          </p>
          <button
            type="button"
            onClick={onGoToFreeViewer}
            className="inline-flex items-center gap-2 text-xs font-medium text-sky-400 transition hover:text-sky-300"
          >
            {t("openViewerCta")} <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </footer>
  );
}
