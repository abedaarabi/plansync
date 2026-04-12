"use client";

import { X } from "lucide-react";
import { LANDING_SOLUTIONS_SECTION } from "@/lib/landingContent";
import { SolutionsDirectory } from "./SolutionsDirectory";

export type SolutionsMenuPanelContentProps = {
  /** For `aria-labelledby` on the surrounding dialog (use when `showEyebrowHeader` is true). */
  titleId: string;
  onNavigate?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  /** When false, omit the white title row (e.g. header mega-menu supplies its own chrome). */
  showEyebrowHeader?: boolean;
  /** Intro copy color treatment. */
  introTone?: "default" | "onDark";
  descriptionAlign?: "center" | "left";
  /** Classes for the scrollable body (nav: flex-1; footer: max-height). */
  bodyClassName: string;
};

export function SolutionsMenuPanelContent({
  titleId,
  onNavigate,
  onClose,
  showCloseButton = false,
  showEyebrowHeader = true,
  introTone = "default",
  descriptionAlign = "center",
  bodyClassName,
}: SolutionsMenuPanelContentProps) {
  const align =
    descriptionAlign === "center" ? "mx-auto max-w-3xl text-center" : "max-w-none text-left";

  const introClass =
    introTone === "onDark"
      ? "text-sm leading-relaxed text-slate-200/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] sm:text-base"
      : "text-sm leading-relaxed text-slate-600 sm:text-base";

  return (
    <>
      {showEyebrowHeader ? (
        <div className="flex shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,var(--landing-cta)_16%,#e2e8f0)] bg-white/90 px-4 py-3 sm:px-6">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {LANDING_SOLUTIONS_SECTION.eyebrow}
            </p>
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              {LANDING_SOLUTIONS_SECTION.title}
            </h2>
          </div>
          {showCloseButton && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 transition hover:border-[color-mix(in_srgb,var(--landing-cta)_28%,#e2e8f0)] hover:text-slate-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={bodyClassName}>
        <div className="mx-auto max-w-6xl">
          <p className={`${introClass} ${align}`}>{LANDING_SOLUTIONS_SECTION.description}</p>
          <SolutionsDirectory className="mt-8 sm:mt-10" onNavigate={onNavigate} />
        </div>
      </div>
    </>
  );
}
