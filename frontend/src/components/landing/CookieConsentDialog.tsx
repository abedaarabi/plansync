"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "plansync_cookie_consent_v1";

export function CookieConsentDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONSENT_KEY);
      setOpen(saved !== "accepted" && saved !== "rejected");
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  function saveConsent(value: "accepted" | "rejected") {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Ignore storage failures; user still closes dialog for this session.
    }
    setOpen(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Cookie preferences</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
              We use essential cookies to keep PlanSync secure and working. With your permission, we
              may also use non-essential cookies to improve product experience. See our{" "}
              <Link
                href="/cookies"
                className="font-medium text-[var(--landing-cta)] hover:underline"
              >
                Cookie Policy
              </Link>
              .
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => saveConsent("rejected")}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:text-sm"
            >
              Reject optional
            </button>
            <button
              type="button"
              onClick={() => saveConsent("accepted")}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--landing-cta)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--landing-cta-bright)] sm:text-sm"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
