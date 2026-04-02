export const LAST_PROJECT_STORAGE_KEY = "plansync:lastProjectId";

/** Fired on `window` when the last-selected project changes (same tab). */
export const LAST_PROJECT_CHANGED_EVENT = "plansync:last-project-changed";

export function setLastProjectId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_PROJECT_STORAGE_KEY, id);
    window.dispatchEvent(new Event(LAST_PROJECT_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function getLastProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}
