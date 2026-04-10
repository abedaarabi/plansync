"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type LandingFooterProps = {
  onGoToFreeViewer: () => void;
};

export function LandingFooter({ onGoToFreeViewer }: LandingFooterProps) {
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
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              The construction drawing workspace for teams who can&apos;t afford to work off the
              wrong information.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Product
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <a
                  href="#how-it-works"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  How it works
                </a>
              </li>
              <li>
                <a href="#solutions" className="text-sm text-slate-300 transition hover:text-white">
                  Solutions
                </a>
              </li>
              <li>
                <a href="#features" className="text-sm text-slate-300 transition hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="#compare" className="text-sm text-slate-300 transition hover:text-white">
                  Pricing
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onGoToFreeViewer}
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  Free viewer
                </button>
              </li>
              <li>
                <span className="text-sm text-slate-500">Changelog</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Company
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <span className="text-sm text-slate-500">About</span>
              </li>
              <li>
                <span className="text-sm text-slate-500">Blog</span>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/plansyncdev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</h4>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <span className="text-sm text-slate-500">Terms of Service</span>
              </li>
              <li>
                <span className="text-sm text-slate-500">Cookie Policy</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-xs text-slate-500" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} PlanSync. All rights reserved.
          </p>
          <button
            type="button"
            onClick={onGoToFreeViewer}
            className="inline-flex items-center gap-2 text-xs font-medium text-sky-400 transition hover:text-sky-300"
          >
            Open free PDF viewer <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </footer>
  );
}
