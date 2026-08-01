import {
  getLastProjectContext,
  isProjectRestoreEntryPath,
  normalizeProjectPath,
  shouldSkipProjectRestore,
} from "@/lib/lastProject";
import type { Project } from "@/types/projects";

export type RestorePhase = "checking" | "show" | "redirecting";

export type RestoreLayoutResult =
  | { phase: RestorePhase; target?: undefined }
  | { phase: "redirecting"; target: string };

export function initialRestorePhase(): RestorePhase {
  if (typeof window === "undefined") return "checking";
  if (!isProjectRestoreEntryPath(window.location.pathname)) return "show";
  if (shouldSkipProjectRestore()) return "show";
  return "checking";
}

function restoreTargetForWorkspace(wid: string, pathname: string): RestoreLayoutResult {
  const ctx = getLastProjectContext(wid);
  if (!ctx) return { phase: "show" };
  const target = normalizeProjectPath(ctx.path, ctx.projectId);
  if (target === pathname) return { phase: "show" };
  return { phase: "redirecting", target };
}

/**
 * Keep `skipProjectRestore` set while the user stays on hub/dashboard.
 * Clearing it on first resolve races React Strict Mode remounts and immediately
 * redirects back into the last project (sidebar "Projects" appears broken).
 * Cleared when leaving entry paths (see `useProjectRestoreEntry`) or entering a project.
 */
// fallow-ignore-next-line complexity
export function resolveRestoreOnEntry(
  isEntry: boolean,
  ctxLoading: boolean,
  wid: string | undefined,
  pathname: string,
): RestoreLayoutResult | null {
  if (!isEntry) return { phase: "show" };
  if (shouldSkipProjectRestore()) return { phase: "show" };
  if (ctxLoading || !wid) return null;
  return restoreTargetForWorkspace(wid, pathname);
}

export function storedProjectMissing(wid: string, projects: Project[]): boolean {
  const ctx = getLastProjectContext(wid);
  if (!ctx) return true;
  return !projects.some((p) => p.id === ctx.projectId);
}
