"use client";

import { useLocale, useTranslations } from "next-intl";
import { memo, useCallback } from "react";
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from "@/lib/i18n/config";
import { persistAppLocale } from "@/lib/i18n/persistLocale";

export type AppLocaleSelectVariant = "nav" | "mobile" | "enterprise";

type Props = {
  className?: string;
  variant?: AppLocaleSelectVariant;
  /** For enterprise menu: reserve space for label */
  showLabel?: boolean;
  /** `id` for the `<select>` (defaults by variant) */
  selectId?: string;
};

const selectClassByVariant: Record<AppLocaleSelectVariant, string> = {
  nav: "max-w-[13rem] rounded-lg border border-slate-200/90 bg-white/90 py-1.5 ps-2 pe-7 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)]/30",
  mobile:
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 ps-3 pe-8 text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)]/30",
  enterprise:
    "w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-1.5 ps-2 pe-7 text-xs font-medium text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30",
};

export const AppLocaleSelect = memo(function AppLocaleSelect({
  className = "",
  variant = "nav",
  showLabel,
  selectId,
}: Props) {
  const t = useTranslations("language");
  const locale = useLocale() as AppLocale;

  const onSelect = useCallback(async (next: string) => {
    const ok = await persistAppLocale(next);
    if (!ok) return;
    // Full reload: `router.refresh()` can run before the browser applies `Set-Cookie`, so RSC
    // may still see the old locale. A navigation reload always sends the updated `NEXT_LOCALE`.
    window.location.reload();
  }, []);

  const id =
    selectId ?? (variant === "enterprise" ? "plansync-app-locale" : "plansync-landing-locale");

  const labelVisible = showLabel ?? variant === "enterprise";

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {labelVisible ? (
        <label className="text-[11px] font-medium text-[var(--enterprise-text-muted)]" htmlFor={id}>
          {t("label")}
        </label>
      ) : (
        <label className="sr-only" htmlFor={id}>
          {t("label")}
        </label>
      )}
      <select
        id={id}
        aria-label={t("switchTo")}
        value={APP_LOCALES.includes(locale) ? locale : "en"}
        onChange={(e) => void onSelect(e.target.value)}
        className={selectClassByVariant[variant]}
      >
        {APP_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
});
