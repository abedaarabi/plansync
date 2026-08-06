/**
 * Offline draft cache for inspection runs (PWA / flaky network).
 * Persists resultJson locally and merges on reconnect via caller.
 */

const PREFIX = "plansync:om-insp-draft:";

export type OmInspectionOfflineDraft = {
  projectId: string;
  runId: string;
  resultJson: unknown[];
  savedAt: string;
};

function key(projectId: string, runId: string) {
  return `${PREFIX}${projectId}:${runId}`;
}

export function saveOmInspectionOfflineDraft(
  projectId: string,
  runId: string,
  resultJson: unknown[],
): void {
  if (typeof window === "undefined") return;
  const payload: OmInspectionOfflineDraft = {
    projectId,
    runId,
    resultJson,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key(projectId, runId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadOmInspectionOfflineDraft(
  projectId: string,
  runId: string,
): OmInspectionOfflineDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(projectId, runId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OmInspectionOfflineDraft;
    if (parsed.projectId !== projectId || parsed.runId !== runId) return null;
    if (!Array.isArray(parsed.resultJson)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOmInspectionOfflineDraft(projectId: string, runId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(projectId, runId));
  } catch {
    /* ignore */
  }
}

export function listOmInspectionOfflineDrafts(projectId: string): OmInspectionOfflineDraft[] {
  if (typeof window === "undefined") return [];
  const out: OmInspectionOfflineDraft[] = [];
  const needle = `${PREFIX}${projectId}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(needle)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as OmInspectionOfflineDraft;
      if (parsed.projectId === projectId && Array.isArray(parsed.resultJson)) out.push(parsed);
    }
  } catch {
    /* ignore */
  }
  return out;
}
