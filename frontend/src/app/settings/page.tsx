"use client";

import Link from "next/link";
import { useState } from "react";
import { clearAllViewerLocalStorage } from "@/lib/sessionPersistence";
import { useViewerStore } from "@/store/viewerStore";

export default function SettingsPage() {
  const resetSession = useViewerStore((s) => s.resetSession);
  const [note, setNote] = useState<string | null>(null);

  const clearEverything = () => {
    if (
      !window.confirm(
        "Remove all PlanSync data stored in this browser (sessions, display name, calibration tips, bookmarks)? The app will reset to an empty state.",
      )
    ) {
      return;
    }
    clearAllViewerLocalStorage();
    resetSession();
    setNote("Local data cleared. Open a PDF again from the home page.");
  };

  return (
    <div className="landing-atmosphere min-h-full font-sans">
      <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Back to PlanSync
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Local data</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            PlanSync stores the current PDF session, your display name, per-file calibration
            dismissals, saved views, and onboarding flags in this browser&apos;s{" "}
            <strong className="font-medium text-slate-800">local storage</strong> only.
          </p>
          <button
            type="button"
            onClick={clearEverything}
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900 transition hover:bg-red-100"
          >
            Clear all PlanSync data in this browser
          </button>
          {note && (
            <p className="mt-3 text-sm text-emerald-700" role="status">
              {note}
            </p>
          )}
        </section>
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy &amp; data
          </Link>
        </p>
      </main>
    </div>
  );
}
