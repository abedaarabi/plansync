"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CtaHeroAtmosphere } from "@/components/BrandStoryPanel";
import { LANDING_SOLUTIONS_SECTION } from "@/lib/landingContent";
import { SolutionsMenuPanelContent } from "./SolutionsMenuPanelContent";

export function SolutionsDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const overlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close solutions menu"
              className="fixed inset-x-0 top-16 bottom-0 z-40 bg-slate-950/55 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="solutions-panel-title"
              className="fixed inset-x-0 top-16 bottom-0 z-[45] flex flex-col overflow-hidden bg-[#0F172A] shadow-[0_-12px_48px_-14px_rgba(0,0,0,0.45)]"
            >
              <CtaHeroAtmosphere />
              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/45 px-4 py-3 backdrop-blur-md sm:px-6">
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
                      {LANDING_SOLUTIONS_SECTION.eyebrow}
                    </p>
                    <h2
                      id="solutions-panel-title"
                      className="text-lg font-bold tracking-tight text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.35)] sm:text-xl"
                    >
                      {LANDING_SOLUTIONS_SECTION.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-sm transition hover:border-white/25 hover:bg-white/15"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
                <SolutionsMenuPanelContent
                  titleId="solutions-panel-title"
                  showEyebrowHeader={false}
                  showCloseButton={false}
                  onNavigate={() => setOpen(false)}
                  descriptionAlign="center"
                  introTone="onDark"
                  bodyClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 sm:py-8"
                />
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-0.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        Solutions
      </button>
      {overlay}
    </div>
  );
}
