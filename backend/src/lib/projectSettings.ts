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
  /** O&M: asset register */
  omAssets: boolean;
  /** O&M: preventive maintenance schedules */
  omMaintenance: boolean;
  /** O&M: inspection templates & runs */
  omInspections: boolean;
  /** O&M: occupant portal (magic link) */
  omTenantPortal: boolean;
  /** Construction schedule (Gantt / timeline). */
  schedule: boolean;
};

/** Handover pack + FM wizard fields (stored in `settingsJson.omHandover`). */
export type OmHandoverSettings = {
  /** Free text: warranty contacts, training dates, caveats. */
  notes: string;
  /** ISO datetime when the team marked handover complete (optional). */
  handoverCompletedAt: string | null;
  /** Display name for the building in FM handover wizard (optional). */
  buildingLabel: string | null;
  /** Primary FM contact — workspace user id. */
  facilityManagerUserId: string | null;
  /** Handover date as YYYY-MM-DD from wizard (optional). */
  handoverDate: string | null;
  /** Wizard: transfer intent checkboxes (informational / planning). */
  transferAsBuilt: boolean;
  transferClosedIssues: boolean;
  transferPunch: boolean;
  transferTeamAccess: boolean;
  /** ISO datetime when “Complete handover” was submitted in the wizard. */
  handoverWizardCompletedAt: string | null;
  /**
   * When set, completing an inspection emails this address the PDF report (Resend + verified sender).
   */
  buildingOwnerEmail: string | null;
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
  omHandover: OmHandoverSettings;
};

const DEFAULT_MODULES: ProjectModules = {
  issues: true,
  rfis: true,
  takeoff: true,
  proposals: true,
  punch: true,
  fieldReports: true,
  omAssets: true,
  omMaintenance: true,
  omInspections: true,
  omTenantPortal: true,
  schedule: true,
};

const DEFAULT_CLIENT_VISIBILITY: ClientVisibility = {
  showIssues: true,
  showRfis: true,
  showFieldReports: true,
  showPunchList: true,
  allowClientComment: false,
};

const DEFAULT_OM_HANDOVER: OmHandoverSettings = {
  notes: "",
  handoverCompletedAt: null,
  buildingLabel: null,
  facilityManagerUserId: null,
  handoverDate: null,
  transferAsBuilt: true,
  transferClosedIssues: true,
  transferPunch: true,
  transferTeamAccess: true,
  handoverWizardCompletedAt: null,
  buildingOwnerEmail: null,
};

function parseOptionalStringNull(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Normalised lowercase email or null if missing / invalid. */
function parseOptionalEmailNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  if (t.length > 320) return null;
  return t;
}

function parseBool(v: unknown, defaultVal: boolean): boolean {
  return typeof v === "boolean" ? v : defaultVal;
}

export function parseProjectSettingsJson(raw: unknown): ProjectSettingsResolved {
  if (raw == null || typeof raw !== "object") {
    return {
      modules: { ...DEFAULT_MODULES },
      clientVisibility: { ...DEFAULT_CLIENT_VISIBILITY },
      omHandover: { ...DEFAULT_OM_HANDOVER },
    };
  }
  const o = raw as Record<string, unknown>;
  const m =
    o.modules && typeof o.modules === "object" ? (o.modules as Record<string, unknown>) : {};
  const c =
    o.clientVisibility && typeof o.clientVisibility === "object"
      ? (o.clientVisibility as Record<string, unknown>)
      : {};
  const h =
    o.omHandover && typeof o.omHandover === "object"
      ? (o.omHandover as Record<string, unknown>)
      : {};

  const handoverCompletedAt =
    h.handoverCompletedAt === null
      ? null
      : typeof h.handoverCompletedAt === "string" && h.handoverCompletedAt.trim()
        ? h.handoverCompletedAt.trim()
        : DEFAULT_OM_HANDOVER.handoverCompletedAt;

  const handoverWizardCompletedAt =
    h.handoverWizardCompletedAt === null
      ? null
      : typeof h.handoverWizardCompletedAt === "string" && h.handoverWizardCompletedAt.trim()
        ? h.handoverWizardCompletedAt.trim()
        : DEFAULT_OM_HANDOVER.handoverWizardCompletedAt;

  return {
    modules: {
      issues: typeof m.issues === "boolean" ? m.issues : DEFAULT_MODULES.issues,
      rfis: typeof m.rfis === "boolean" ? m.rfis : DEFAULT_MODULES.rfis,
      takeoff: typeof m.takeoff === "boolean" ? m.takeoff : DEFAULT_MODULES.takeoff,
      proposals: typeof m.proposals === "boolean" ? m.proposals : DEFAULT_MODULES.proposals,
      punch: typeof m.punch === "boolean" ? m.punch : DEFAULT_MODULES.punch,
      fieldReports:
        typeof m.fieldReports === "boolean" ? m.fieldReports : DEFAULT_MODULES.fieldReports,
      omAssets: typeof m.omAssets === "boolean" ? m.omAssets : DEFAULT_MODULES.omAssets,
      omMaintenance:
        typeof m.omMaintenance === "boolean" ? m.omMaintenance : DEFAULT_MODULES.omMaintenance,
      omInspections:
        typeof m.omInspections === "boolean" ? m.omInspections : DEFAULT_MODULES.omInspections,
      omTenantPortal:
        typeof m.omTenantPortal === "boolean" ? m.omTenantPortal : DEFAULT_MODULES.omTenantPortal,
      schedule: typeof m.schedule === "boolean" ? m.schedule : DEFAULT_MODULES.schedule,
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
    omHandover: {
      notes: typeof h.notes === "string" ? h.notes.slice(0, 20000) : DEFAULT_OM_HANDOVER.notes,
      handoverCompletedAt,
      buildingLabel: parseOptionalStringNull(h.buildingLabel) ?? DEFAULT_OM_HANDOVER.buildingLabel,
      facilityManagerUserId:
        parseOptionalStringNull(h.facilityManagerUserId) ??
        DEFAULT_OM_HANDOVER.facilityManagerUserId,
      handoverDate: parseOptionalStringNull(h.handoverDate) ?? DEFAULT_OM_HANDOVER.handoverDate,
      transferAsBuilt: parseBool(h.transferAsBuilt, DEFAULT_OM_HANDOVER.transferAsBuilt),
      transferClosedIssues: parseBool(
        h.transferClosedIssues,
        DEFAULT_OM_HANDOVER.transferClosedIssues,
      ),
      transferPunch: parseBool(h.transferPunch, DEFAULT_OM_HANDOVER.transferPunch),
      transferTeamAccess: parseBool(h.transferTeamAccess, DEFAULT_OM_HANDOVER.transferTeamAccess),
      handoverWizardCompletedAt,
      buildingOwnerEmail:
        parseOptionalEmailNull(h.buildingOwnerEmail) ?? DEFAULT_OM_HANDOVER.buildingOwnerEmail,
    },
  };
}

export function mergeProjectSettingsPatch(
  current: ProjectSettingsResolved,
  patch: {
    modules?: Partial<ProjectModules>;
    clientVisibility?: Partial<ClientVisibility>;
    omHandover?: Partial<OmHandoverSettings>;
  },
): ProjectSettingsResolved {
  let om: OmHandoverSettings = { ...current.omHandover };
  if (patch.omHandover) {
    const p = patch.omHandover;
    if (p.notes !== undefined) {
      om.notes = typeof p.notes === "string" ? p.notes.slice(0, 20000) : "";
    }
    if (p.handoverCompletedAt !== undefined) {
      const v = p.handoverCompletedAt;
      om.handoverCompletedAt =
        v === null ? null : typeof v === "string" && v.trim() ? v.trim() : om.handoverCompletedAt;
    }
    if (p.buildingLabel !== undefined) {
      om.buildingLabel =
        p.buildingLabel === null
          ? null
          : typeof p.buildingLabel === "string" && p.buildingLabel.trim()
            ? p.buildingLabel.trim().slice(0, 500)
            : null;
    }
    if (p.facilityManagerUserId !== undefined) {
      om.facilityManagerUserId =
        p.facilityManagerUserId === null
          ? null
          : typeof p.facilityManagerUserId === "string" && p.facilityManagerUserId.trim()
            ? p.facilityManagerUserId.trim()
            : null;
    }
    if (p.handoverDate !== undefined) {
      om.handoverDate =
        p.handoverDate === null
          ? null
          : typeof p.handoverDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.handoverDate)
            ? p.handoverDate
            : om.handoverDate;
    }
    if (p.transferAsBuilt !== undefined) om.transferAsBuilt = Boolean(p.transferAsBuilt);
    if (p.transferClosedIssues !== undefined)
      om.transferClosedIssues = Boolean(p.transferClosedIssues);
    if (p.transferPunch !== undefined) om.transferPunch = Boolean(p.transferPunch);
    if (p.transferTeamAccess !== undefined) om.transferTeamAccess = Boolean(p.transferTeamAccess);
    if (p.handoverWizardCompletedAt !== undefined) {
      const v = p.handoverWizardCompletedAt;
      om.handoverWizardCompletedAt =
        v === null
          ? null
          : typeof v === "string" && v.trim()
            ? v.trim()
            : om.handoverWizardCompletedAt;
    }
    if (p.buildingOwnerEmail !== undefined) {
      om.buildingOwnerEmail = parseOptionalEmailNull(p.buildingOwnerEmail);
    }
  }
  return {
    modules: { ...current.modules, ...patch.modules },
    clientVisibility: { ...current.clientVisibility, ...patch.clientVisibility },
    omHandover: om,
  };
}

/** When enabling `operationsMode`, optionally turn off construction-heavy modules (Super Admin choice). */
export const OM_DEFAULT_MODULES_WHEN_ENABLING: Partial<ProjectModules> = {
  rfis: false,
  takeoff: false,
  proposals: false,
};
