"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BellRing, Download, LogIn, MonitorSmartphone, Share, Smartphone } from "lucide-react";
import { AnimateIn } from "./AnimateIn";

/** Chromium fires this when the app can be installed as a PWA. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function StepIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200/80 bg-linear-to-br from-slate-50 to-blue-50 text-blue-700 shadow-sm">
      {children}
    </div>
  );
}

export function LandingPwaInstallSection() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  };

  return (
    <section
      id="install"
      className="relative scroll-mt-20 border-t border-slate-200/70 bg-linear-to-b from-slate-50/90 to-white py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            Install
          </p>
          <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Add PlanSync to your device
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Install or add to home screen, sign in, then turn on alerts — all in a few steps.
          </p>
        </AnimateIn>

        <AnimateIn delay={40} className="mt-12">
          <ol className="relative space-y-0" aria-label="Install and notification steps">
            {/* Vertical connector */}
            <span
              className="pointer-events-none absolute start-5.5 top-8 bottom-8 w-px bg-linear-to-b from-blue-200 via-blue-200/80 to-blue-100"
              aria-hidden
            />

            <li className="relative flex gap-4 pb-10 sm:gap-5">
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/25 ring-4 ring-white">
                1
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                  <StepIcon>
                    <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </StepIcon>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900">
                      Install or add to home screen
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Pick your device — use these hints so PlanSync opens like a normal app.
                    </p>
                    <ul className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
                      <li className="flex gap-3">
                        <MonitorSmartphone
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-slate-800">
                            Desktop (Chrome / Edge):
                          </span>{" "}
                          look for the install icon in the address bar, or the app menu → Install
                          PlanSync.
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <Share
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-slate-800">
                            iPhone / iPad (Safari):
                          </span>{" "}
                          Share → Add to Home Screen, then open from the icon.
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <Smartphone
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-slate-800">Android (Chrome):</span> menu
                          → Install app or Add to Home screen.
                        </span>
                      </li>
                    </ul>
                    {installEvent ? (
                      <button
                        type="button"
                        onClick={handleInstall}
                        className="mt-5 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-(--landing-cta) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--landing-cta-bright) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-offset-2 sm:w-auto"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Install app
                      </button>
                    ) : (
                      <p className="mt-4 text-xs text-slate-500">
                        If the install button doesn’t appear here, your browser may have already
                        installed the app — use your browser’s menu instead.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>

            <li className="relative flex gap-4 pb-10 sm:gap-5">
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/25 ring-4 ring-white">
                2
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                  <StepIcon>
                    <LogIn className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </StepIcon>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900">Sign in</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Open PlanSync from your new shortcut and sign in to your workspace. You need
                      an account before you can enable push alerts.
                    </p>
                  </div>
                </div>
              </div>
            </li>

            <li className="relative flex gap-4 sm:gap-5">
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/25 ring-4 ring-white">
                3
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                  <StepIcon>
                    <BellRing className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </StepIcon>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900">
                      Turn on notifications
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Go to <span className="font-medium text-slate-800">Account</span> (profile
                      menu) →{" "}
                      <span className="font-medium text-slate-800">Alerts on this device</span> and
                      switch them on. When your browser asks, choose{" "}
                      <span className="font-medium text-slate-800">Allow</span> so we can reach you
                      with RFIs, issues, and other updates when you’re not in the app.
                    </p>
                    <ul className="mt-4 space-y-2 rounded-xl border border-blue-100/90 bg-blue-50/40 px-4 py-3 text-xs leading-relaxed text-slate-600">
                      <li>
                        <span className="font-medium text-blue-900">Chrome / Edge:</span> if you
                        blocked alerts earlier, use the lock or site icon in the address bar → Site
                        settings → Notifications → Allow.
                      </li>
                      <li>
                        <span className="font-medium text-blue-900">Safari (iOS):</span> add
                        PlanSync to the Home Screen first, then check iOS Settings → Notifications
                        (or Apps) for PlanSync.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </AnimateIn>

        <p className="mx-auto mt-10 text-center text-xs leading-relaxed text-slate-500">
          PWA availability depends on your browser. The free viewer works in the tab without
          installing. Notifications need a signed-in workspace and a browser that supports web push.
        </p>
      </div>
    </section>
  );
}
