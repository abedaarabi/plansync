import type { AbstractIntlMessages } from "next-intl";
import type { AppLocale } from "./config";
import { DEFAULT_LOCALE } from "./config";
import en from "../../../messages/en.json";
import appEn from "../../../messages/app.en.json";
import appAr from "../../../messages/app.ar.json";
import appDa from "../../../messages/app.da.json";
import appEs from "../../../messages/app.es.json";
import appFr from "../../../messages/app.fr.json";
import appZhCn from "../../../messages/app.zh-CN.json";
import ar from "../../../messages/ar.json";
import da from "../../../messages/da.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import zhCn from "../../../messages/zh-CN.json";

const enWithApp = {
  ...(en as Record<string, unknown>),
  app: appEn,
} as unknown as AbstractIntlMessages;

function withApp<T extends Record<string, unknown>>(base: T, app: unknown): AbstractIntlMessages {
  return { ...base, app } as unknown as AbstractIntlMessages;
}

/** JSON includes arrays; next-intl's AbstractIntlMessages typing is string-recursive only. */
const catalogs: Record<AppLocale, AbstractIntlMessages> = {
  en: enWithApp,
  fr: withApp(fr as unknown as Record<string, unknown>, appFr),
  da: withApp(da as unknown as Record<string, unknown>, appDa),
  ar: withApp(ar as unknown as Record<string, unknown>, appAr),
  es: withApp(es as unknown as Record<string, unknown>, appEs),
  "zh-CN": withApp(zhCn as unknown as Record<string, unknown>, appZhCn),
};

function deepFill<T extends Record<string, unknown>>(base: T, over: T): T {
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(over)) {
    const bv = base[k as keyof T];
    const ov = over[k as keyof T];
    if (
      ov !== null &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[k] = deepFill(bv as Record<string, unknown>, ov as Record<string, unknown>);
    } else if (ov !== undefined) {
      out[k] = ov;
    }
  }
  return out as T;
}

/** Full message bundle with English fallback for missing keys (phased translation). */
export function getMessagesForLocale(locale: AppLocale): AbstractIntlMessages {
  const target = catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
  if (locale === DEFAULT_LOCALE) return target;
  return deepFill(
    enWithApp as Record<string, unknown>,
    target as Record<string, unknown>,
  ) as AbstractIntlMessages;
}
