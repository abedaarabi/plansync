"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "plansync-onboarding-dismissed-v1";
const LEGACY_STORAGE_KEY = "cv-onboarding-dismissed-v1";

export function ViewerOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setVisible(false);
        return;
      }
      const dismissed =
        localStorage.getItem(STORAGE_KEY) === "1" ||
        localStorage.getItem(LEGACY_STORAGE_KEY) === "1";
      setVisible(!dismissed);
    } catch {
      setVisible(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 print:hidden"
      role="dialog"
      aria-labelledby="onboarding-title"
    >
      <div className="pointer-events-auto max-w-lg rounded-xl border border-blue-500/35 bg-slate-950/92 px-4 py-3 shadow-2xl ring-1 ring-blue-500/25 backdrop-blur-md sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p id="onboarding-title" className="text-sm font-semibold text-slate-100">
              Quick start
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-slate-400">
              <li>
                <strong className="font-medium text-slate-300">Calibrate</strong> scale from a known
                length on the sheet.
              </li>
              <li>
                <strong className="font-medium text-slate-300">Measure</strong> lines, areas, and
                angles.
              </li>
              <li>
                <strong className="font-medium text-slate-300">Markup</strong> with pen, shapes, and
                text—saved in this browser&apos;s local storage. Clear from{" "}
                <strong className="text-slate-300">Document</strong> (info) → Clear saved markups.
              </li>
            </ol>
            <p className="mt-2 text-[10px] text-slate-500">
              <Link href="/settings" className="text-blue-400 underline hover:text-blue-300">
                Settings
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="text-blue-400 underline hover:text-blue-300">
                Privacy
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="viewer-focus-ring shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
