"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";

const STORAGE_KEY = "plansync-onboarding-dismissed-v2";
const LEGACY_STORAGE_KEY = "plansync-onboarding-dismissed-v1";
const LEGACY_CV_KEY = "cv-onboarding-dismissed-v1";

export function ViewerOnboarding() {
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const [visible, setVisible] = useState(false);

  const isProjectSheet = Boolean(viewerProjectId && cloudFileVersionId);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setVisible(false);
        return;
      }
      const dismissed =
        localStorage.getItem(STORAGE_KEY) === "1" ||
        localStorage.getItem(LEGACY_STORAGE_KEY) === "1" ||
        localStorage.getItem(LEGACY_CV_KEY) === "1";
      setVisible(!dismissed);
    } catch {
      setVisible(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(LEGACY_CV_KEY);
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
      <div className="pointer-events-auto max-w-lg rounded-xl border border-blue-500/35 bg-white/92 px-4 py-3 shadow-2xl ring-1 ring-blue-500/25 backdrop-blur-md sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p id="onboarding-title" className="text-sm font-semibold text-slate-900">
              {isProjectSheet ? "Issues on this sheet" : "Quick start"}
            </p>
            {isProjectSheet ? (
              <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-slate-500">
                <li>
                  Switch to <strong className="font-medium text-slate-600">Issues</strong> mode in
                  the left sidebar.
                </li>
                <li>
                  Click <strong className="font-medium text-slate-600">New</strong> to drop an issue
                  pin on the drawing.
                </li>
                <li>
                  Fill in details in the{" "}
                  <strong className="font-medium text-slate-600">panel on the right</strong> — the
                  sheet stays visible while you work.
                </li>
              </ol>
            ) : (
              <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-slate-500">
                <li>
                  <strong className="font-medium text-slate-600">Calibrate</strong> scale from a
                  known length on the sheet.
                </li>
                <li>
                  <strong className="font-medium text-slate-600">Measure</strong> lines, areas, and
                  angles.
                </li>
                <li>
                  <strong className="font-medium text-slate-600">Markup</strong> with pen, shapes,
                  and text—saved in this browser&apos;s local storage.
                </li>
              </ol>
            )}
            <p className="mt-2 text-[10px] text-slate-500">
              <Link href="/settings" className="text-blue-400 underline hover:text-blue-600">
                Settings
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="text-blue-400 underline hover:text-blue-600">
                Privacy
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="viewer-focus-ring shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
