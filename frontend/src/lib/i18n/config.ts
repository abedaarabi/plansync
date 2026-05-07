/** BCP-47 tags aligned with next-intl / browser standards */
export const APP_LOCALES = ["en", "fr", "da", "ar", "es", "zh-CN"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Persisted user-visible locale (next-intl convention). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Native-language labels for the language picker */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  da: "Dansk",
  ar: "العربية",
  es: "Español",
  "zh-CN": "简体中文",
};

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (APP_LOCALES as readonly string[]).includes(value);
}

export function coerceLocale(value: string | undefined | null): AppLocale {
  if (isAppLocale(value)) return value;
  /** Accept common aliases */
  if (value === "zh" || value?.startsWith("zh-Hans")) return "zh-CN";
  return DEFAULT_LOCALE;
}
