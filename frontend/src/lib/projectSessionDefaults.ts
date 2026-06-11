/** Default module flags when project session settings are not loaded yet. */
export const DEFAULT_PROJECT_SESSION_MODULES = {
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
} as const;
