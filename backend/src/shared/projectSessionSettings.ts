/** Client portal visibility toggles (stored in `Project.settingsJson.clientVisibility`). */
export type ProjectSessionClientVisibility = {
  showIssues: boolean;
  showRfis: boolean;
  showFieldReports: boolean;
  showPunchList: boolean;
  showDrawings: boolean;
  allowClientComment: boolean;
};

/** Handover pack + FM wizard fields (stored in `settingsJson.omHandover`). */
export type ProjectSessionOmHandover = {
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

/** Optional occupant portal public page copy (headline on `/occupant/...`). */
export type OmTenantPortalUiSettings = {
  headline: string | null;
};
