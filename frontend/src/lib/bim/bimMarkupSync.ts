import { fetchViewerState, putViewerState } from "@/lib/api-client";
import { ProRequiredError } from "@/lib/api-client/errors";
import { setViewerCollabRevision } from "@/lib/viewerCollabRevision";
import type { BimAnnotation } from "@/store/bimMarkupStore";
import { useBimMarkupStore } from "@/store/bimMarkupStore";
import { toast } from "sonner";

function parseBimAnnotations(raw: unknown): BimAnnotation[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.bimAnnotations)) return [];
  return o.bimAnnotations.filter(
    (a): a is BimAnnotation =>
      a != null &&
      typeof a === "object" &&
      typeof (a as BimAnnotation).id === "string" &&
      Array.isArray((a as BimAnnotation).points),
  );
}

// fallow-ignore-next-line complexity
function mergeAnnotations(server: BimAnnotation[], local: BimAnnotation[]): BimAnnotation[] {
  const byId = new Map<string, BimAnnotation>();
  for (const a of server) byId.set(a.id, a);
  for (const a of local) {
    const existing = byId.get(a.id);
    if (!existing || a.createdAt >= existing.createdAt) byId.set(a.id, a);
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

// fallow-ignore-next-line complexity
function mergePayloadForPut(bimAnnotations: BimAnnotation[]): Record<string, unknown> {
  const s = useBimMarkupStore.getState();
  const merge = s.serverBlobMerge ?? {};
  const annotations = Array.isArray(merge.annotations) ? merge.annotations : [];
  const calibrationByPage =
    merge.calibrationByPage && typeof merge.calibrationByPage === "object"
      ? merge.calibrationByPage
      : {};
  return {
    annotations,
    calibrationByPage,
    ...(typeof merge.currentPage === "number" ? { currentPage: merge.currentPage } : {}),
    ...(typeof merge.scale === "number" ? { scale: merge.scale } : {}),
    ...(typeof merge.measureUnit === "string" ? { measureUnit: merge.measureUnit } : {}),
    ...(typeof merge.snapToGeometry === "boolean" ? { snapToGeometry: merge.snapToGeometry } : {}),
    ...(typeof merge.snapRadiusPx === "number" ? { snapRadiusPx: merge.snapRadiusPx } : {}),
    ...(Array.isArray(merge.takeoffItems) ? { takeoffItems: merge.takeoffItems } : {}),
    ...(Array.isArray(merge.takeoffZones) ? { takeoffZones: merge.takeoffZones } : {}),
    ...(typeof merge.takeoffPackageStatus === "string"
      ? { takeoffPackageStatus: merge.takeoffPackageStatus }
      : {}),
    bimAnnotations,
  };
}

let lastPersistErrorToastAt = 0;

function toastPersistError(message: string): void {
  const now = Date.now();
  if (now - lastPersistErrorToastAt < 4000) return;
  lastPersistErrorToastAt = now;
  toast.error(message);
}

/** Load BIM markups and merge context from Pro viewer-state. */
// fallow-ignore-next-line complexity
export async function hydrateBimMarkupViewerState(fileVersionId: string): Promise<void> {
  const store = useBimMarkupStore.getState();
  const localBefore = store.annotations;
  store.setViewerStateHydrated(false);
  try {
    const { viewerState, revision } = await fetchViewerState(fileVersionId);
    const blob =
      viewerState && typeof viewerState === "object"
        ? (viewerState as Record<string, unknown>)
        : null;
    const merge = blob ? { ...blob } : {};
    delete merge.bimAnnotations;
    const serverAnnotations = parseBimAnnotations(blob);
    store.setCloudContext(fileVersionId, revision, merge);
    setViewerCollabRevision(revision);
    store.setAnnotations(mergeAnnotations(serverAnnotations, localBefore));
  } catch (err) {
    store.setCloudContext(fileVersionId, 0, store.serverBlobMerge);
    if (localBefore.length === 0) store.setAnnotations([]);
    if (err instanceof ProRequiredError) {
      toastPersistError("Cloud markups require a Pro workspace to save.");
    }
  } finally {
    store.setViewerStateHydrated(true);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBimMarkupPersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistBimMarkupsNow();
  }, 500);
}

// fallow-ignore-next-line complexity
export async function persistBimMarkupsNow(): Promise<boolean> {
  const s = useBimMarkupStore.getState();
  if (!s.cloudFileVersionId || !s.viewerStateHydrated) return false;
  const payload = mergePayloadForPut(s.annotations);
  try {
    const { revision } = await putViewerState(s.cloudFileVersionId, payload as never);
    const mergedBlob = {
      ...(s.serverBlobMerge ?? {}),
      ...payload,
      bimAnnotations: s.annotations,
    };
    useBimMarkupStore.getState().setCloudContext(s.cloudFileVersionId, revision, mergedBlob);
    return true;
  } catch (err) {
    if (err instanceof ProRequiredError) {
      toastPersistError("Cloud markups require a Pro workspace to save.");
    } else {
      toastPersistError(err instanceof Error ? err.message : "Could not save markups. Try again.");
    }
    return false;
  }
}
