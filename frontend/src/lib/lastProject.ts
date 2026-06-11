/** Workspace-scoped last project + path (survives browser restarts). */
import { extractProjectIdFromPath } from "./projectScopedPath";

export const LAST_PROJECT_CONTEXT_KEY = "plansync:lastProjectContext:v2";

/** @deprecated Legacy global project id — migrated on read. */
export const LAST_PROJECT_STORAGE_KEY = "plansync:lastProjectId";

/** @deprecated Legacy path — migrated on read. */
const LEGACY_LAST_PROJECT_PATH_KEY = "plansync-enterprise-last-project-path-v1";

/** Fired on `window` when the last-selected project changes (same tab). */
export const LAST_PROJECT_CHANGED_EVENT = "plansync:last-project-changed";

/** Set when the user explicitly opens the projects hub or dashboard (same session). */
const SKIP_PROJECT_RESTORE_KEY = "plansync:skipProjectRestore";

export type LastProjectContext = {
  projectId: string;
  path: string;
  updatedAt: number;
};

type LastProjectStore = Record<string, LastProjectContext>;

const RESTORE_ENTRY_PATHS = new Set(["/projects", "/dashboard"]);

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function parseStore(raw: string): LastProjectStore | null {
  try {
    const parsed = JSON.parse(raw) as LastProjectStore;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readStore(): LastProjectStore {
  if (typeof window === "undefined") return {};
  const raw = safeLocalGet(LAST_PROJECT_CONTEXT_KEY);
  return raw ? (parseStore(raw) ?? {}) : {};
}

function writeStore(store: LastProjectStore) {
  if (typeof window === "undefined") return;
  safeLocalSet(LAST_PROJECT_CONTEXT_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(LAST_PROJECT_CHANGED_EVENT));
}

function readLegacyKeys(): { projectId: string | null; path: string | null } {
  return {
    projectId: safeLocalGet(LAST_PROJECT_STORAGE_KEY),
    path: safeLocalGet(LEGACY_LAST_PROJECT_PATH_KEY),
  };
}

// fallow-ignore-next-line complexity
function migrateLegacyStore(): LastProjectStore {
  const store = readStore();
  if (Object.keys(store).length > 0) return store;

  const { projectId, path } = readLegacyKeys();
  if (!projectId) return store;

  const normalizedPath =
    path && extractProjectIdFromPath(path) === projectId ? path : defaultProjectPath(projectId);

  const legacy: LastProjectStore = {
    __legacy__: { projectId, path: normalizedPath, updatedAt: Date.now() },
  };
  writeStore(legacy);
  return legacy;
}

function legacyContext(legacy: LastProjectContext): LastProjectContext {
  return {
    projectId: legacy.projectId,
    path: normalizeProjectPath(legacy.path, legacy.projectId),
    updatedAt: legacy.updatedAt,
  };
}

export function defaultProjectPath(projectId: string): string {
  return `/projects/${projectId}/home`;
}

export function normalizeProjectPath(path: string, projectId: string): string {
  const id = extractProjectIdFromPath(path);
  if (id === projectId && path.startsWith("/projects/")) return path;
  return defaultProjectPath(projectId);
}

export function isProjectRestoreEntryPath(pathname: string): boolean {
  return RESTORE_ENTRY_PATHS.has(pathname);
}

export function setLastProjectContext(workspaceId: string, projectId: string, path: string) {
  if (!workspaceId || !projectId) return;
  const store = migrateLegacyStore();
  store[workspaceId] = {
    projectId,
    path: normalizeProjectPath(path, projectId),
    updatedAt: Date.now(),
  };
  if (store.__legacy__) delete store.__legacy__;
  writeStore(store);
  safeLocalSet(LAST_PROJECT_STORAGE_KEY, projectId);
  safeLocalSet(LEGACY_LAST_PROJECT_PATH_KEY, store[workspaceId].path);
}

function legacyFromStore(store: LastProjectStore): LastProjectContext | null {
  const legacy = store.__legacy__;
  return legacy?.projectId ? legacyContext(legacy) : null;
}

export function getLastProjectContext(
  workspaceId: string | null | undefined,
): LastProjectContext | null {
  if (!workspaceId) return null;
  const store = migrateLegacyStore();
  const hit = store[workspaceId];
  if (hit?.projectId) return hit;
  return legacyFromStore(store);
}

/** @deprecated Prefer `getLastProjectContext`. */
// fallow-ignore-next-line complexity
export function getLastProjectId(workspaceId?: string | null): string | null {
  if (workspaceId) return getLastProjectContext(workspaceId)?.projectId ?? null;
  return typeof window === "undefined" ? null : safeLocalGet(LAST_PROJECT_STORAGE_KEY);
}

export function markSkipProjectRestore() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SKIP_PROJECT_RESTORE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearSkipProjectRestore() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SKIP_PROJECT_RESTORE_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldSkipProjectRestore(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SKIP_PROJECT_RESTORE_KEY) === "1";
  } catch {
    return false;
  }
}
