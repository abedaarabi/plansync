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
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900">Cookie preferences</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => saveConsent("rejected")}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 transition-all duration-150 active:scale-[0.97] hover:bg-slate-50 sm:min-h-11 sm:w-auto sm:text-sm"
            >
              Reject optional
            </button>
            <button
              type="button"
              onClick={() => saveConsent("accepted")}
              className="landing-btn-primary min-h-[52px] w-full sm:min-h-11 sm:w-auto"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
