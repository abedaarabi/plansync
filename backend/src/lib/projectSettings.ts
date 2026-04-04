/** ISO 4217 codes accepted for `Project.currency` (common construction / international). */
export const PROJECT_CURRENCY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "DKK",
  "SEK",
  "NOK",
  "CHF",
  "PLN",
  "CZK",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "HKD",
  "SGD",
  "INR",
  "AED",
  "SAR",
  "BRL",
  "MXN",
  "ZAR",
  "TRY",
  "KRW",
] as const;

export type ProjectCurrencyCode = (typeof PROJECT_CURRENCY_CODES)[number];

export function parseProjectCurrency(raw: unknown): ProjectCurrencyCode | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return (PROJECT_CURRENCY_CODES as readonly string[]).includes(c)
    ? (c as ProjectCurrencyCode)
    : null;
}

/**
 * Per-project module toggles + client visibility (stored in Project.settingsJson).
 * Null/undefined means "all enabled" for backwards compatibility.
 */

export type ProjectModules = {
  issues: boolean;
  rfis: boolean;
  takeoff: boolean;
  proposals: boolean;
  punch: boolean;
  fieldReports: boolean;
};

export type ClientVisibility = {
  showIssues: boolean;
  showRfis: boolean;
  showFieldReports: boolean;
  showPunchList: boolean;
  allowClientComment: boolean;
};

export type ProjectSettingsResolved = {
  modules: ProjectModules;
  clientVisibility: ClientVisibility;
};

const DEFAULT_MODULES: ProjectModules = {
  issues: true,
  rfis: true,
  takeoff: true,
  proposals: true,
  punch: true,
  fieldReports: true,
};

const DEFAULT_CLIENT_VISIBILITY: ClientVisibility = {
  showIssues: true,
  showRfis: true,
  showFieldReports: true,
  showPunchList: true,
  allowClientComment: false,
};

export function parseProjectSettingsJson(raw: unknown): ProjectSettingsResolved {
  if (raw == null || typeof raw !== "object") {
    return { modules: { ...DEFAULT_MODULES }, clientVisibility: { ...DEFAULT_CLIENT_VISIBILITY } };
  }
  const o = raw as Record<string, unknown>;
  const m =
    o.modules && typeof o.modules === "object" ? (o.modules as Record<string, unknown>) : {};
  const c =
    o.clientVisibility && typeof o.clientVisibility === "object"
      ? (o.clientVisibility as Record<string, unknown>)
      : {};

  return {
    modules: {
      issues: typeof m.issues === "boolean" ? m.issues : DEFAULT_MODULES.issues,
      rfis: typeof m.rfis === "boolean" ? m.rfis : DEFAULT_MODULES.rfis,
      takeoff: typeof m.takeoff === "boolean" ? m.takeoff : DEFAULT_MODULES.takeoff,
      proposals: typeof m.proposals === "boolean" ? m.proposals : DEFAULT_MODULES.proposals,
      punch: typeof m.punch === "boolean" ? m.punch : DEFAULT_MODULES.punch,
      fieldReports:
        typeof m.fieldReports === "boolean" ? m.fieldReports : DEFAULT_MODULES.fieldReports,
    },
    clientVisibility: {
      showIssues:
        typeof c.showIssues === "boolean" ? c.showIssues : DEFAULT_CLIENT_VISIBILITY.showIssues,
      showRfis: typeof c.showRfis === "boolean" ? c.showRfis : DEFAULT_CLIENT_VISIBILITY.showRfis,
      showFieldReports:
        typeof c.showFieldReports === "boolean"
          ? c.showFieldReports
          : DEFAULT_CLIENT_VISIBILITY.showFieldReports,
      showPunchList:
        typeof c.showPunchList === "boolean"
          ? c.showPunchList
          : DEFAULT_CLIENT_VISIBILITY.showPunchList,
      allowClientComment:
        typeof c.allowClientComment === "boolean"
          ? c.allowClientComment
          : DEFAULT_CLIENT_VISIBILITY.allowClientComment,
    },
  };
}

export function mergeProjectSettingsPatch(
  current: ProjectSettingsResolved,
  patch: {
    modules?: Partial<ProjectModules>;
    clientVisibility?: Partial<ClientVisibility>;
  },
): ProjectSettingsResolved {
  return {
    modules: { ...current.modules, ...patch.modules },
    clientVisibility: { ...current.clientVisibility, ...patch.clientVisibility },
  };
}
