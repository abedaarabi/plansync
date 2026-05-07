"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BellRing, Download, LogIn, MonitorSmartphone, Share, Smartphone } from "lucide-react";
import { AnimateIn } from "./AnimateIn";

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
  const t = useTranslations("pwa");
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

      <div className="relative mx-auto max-w-3xl min-w-0 px-6">
        <AnimateIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--landing-cta)">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            {t("subtitle")}
          </p>
        </AnimateIn>

        <AnimateIn delay={40} className="mt-12">
          <ol className="relative space-y-0" aria-label={t("stepsAria")}>
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
                    <h3 className="text-base font-semibold text-slate-900">{t("step1Heading")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step1Lead")}</p>
                    <ul className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
                      <li className="flex min-w-0 gap-3">
                        <MonitorSmartphone
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-slate-800">{t("desktopLabel")}</span>{" "}
                          {t("desktopBody")}
                        </span>
                      </li>
                      <li className="flex min-w-0 gap-3">
                        <Share
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-slate-800">{t("iosLabel")}</span>{" "}
                          {t("iosBody")}
                        </span>
                      </li>
                      <li className="flex min-w-0 gap-3">
                        <Smartphone
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-slate-800">{t("androidLabel")}</span>{" "}
                          {t("androidBody")}
                        </span>
                      </li>
                    </ul>
                    {installEvent ? (
                      <button
                        type="button"
                        onClick={handleInstall}
                        className="mt-5 inline-flex min-h-11 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-(--landing-cta) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--landing-cta-bright) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta) focus-visible:ring-offset-2 sm:w-auto"
                      >
                        <Download className="h-4 w-4 shrink-0" aria-hidden />
                        {t("installApp")}
                      </button>
                    ) : (
                      <p className="mt-4 text-xs text-slate-500">{t("installHint")}</p>
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
                    <h3 className="text-base font-semibold text-slate-900">{t("step2Title")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step2Body")}</p>
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
                    <h3 className="text-base font-semibold text-slate-900">{t("step3Title")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("step3Body")}</p>
                    <ul className="mt-4 space-y-2 rounded-xl border border-blue-100/90 bg-blue-50/40 px-4 py-3 text-xs leading-relaxed text-slate-600">
                      <li>
                        <span className="font-medium text-blue-900">{t("notifChrome")}</span>{" "}
                        {t("notifChromeBody")}
                      </li>
                      <li>
                        <span className="font-medium text-blue-900">{t("notifSafari")}</span>{" "}
                        {t("notifSafariBody")}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </AnimateIn>

        <p className="mx-auto mt-10 text-center text-xs leading-relaxed text-slate-500">
          {t("footer")}
        </p>
      </div>
    </section>
  );
}
