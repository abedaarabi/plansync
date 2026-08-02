/// <reference lib="webworker" />
import type { BimClashHit } from "@plansync/shared/bimClashTypes";
import {
  broadPhasePairs,
  computeOriginOffset,
  offsetPositions,
  runNarrowPhase,
  type ClashElementBox,
  type ClashMeshPayload,
} from "./clashCore";

export type ClashWorkerRequest = {
  type: "run";
  requestId: string;
  setA: ClashElementBox[];
  setB: ClashElementBox[];
  /** Candidate meshes keyed by `fileVersionId:guid`. Positions are world-space. */
  meshes: Record<
    string,
    {
      guid: string;
      fileVersionId: string;
      ifcType: string | null;
      name: string | null;
      positions: Float32Array;
      indices: Uint32Array | null;
    }
  >;
  clearanceEnabled: boolean;
  clearanceMm: number;
  pairCap?: number;
};

export type ClashWorkerProgress = {
  type: "progress";
  requestId: string;
  done: number;
  total: number;
  hits: BimClashHit[];
};

export type ClashWorkerDone = {
  type: "done";
  requestId: string;
  hits: BimClashHit[];
  scannedPairs: number;
  truncated: boolean;
};

export type ClashWorkerError = {
  type: "error";
  requestId: string;
  message: string;
};

type ClashWorkerCancel = {
  type: "cancel";
  requestId: string;
};

type InMsg = ClashWorkerRequest | ClashWorkerCancel;

let activeRequestId: string | null = null;
let cancelled = false;

function meshKey(fileVersionId: string, guid: string): string {
  return `${fileVersionId}:${guid}`;
}

function handleRun(msg: ClashWorkerRequest): void {
  activeRequestId = msg.requestId;
  cancelled = false;
  try {
    const origin = computeOriginOffset(msg.setA, msg.setB);
    const pairs = broadPhasePairs(msg.setA, msg.setB, msg.clearanceMm, msg.clearanceEnabled);

    // Only keep meshes for candidates that survived broad phase.
    const needed = new Set<string>();
    for (const p of pairs) {
      needed.add(meshKey(p.a.fileVersionId, p.a.guid));
      needed.add(meshKey(p.b.fileVersionId, p.b.guid));
    }

    const meshes = new Map<string, ClashMeshPayload>();
    for (const key of needed) {
      const raw = msg.meshes[key];
      if (!raw) continue;
      meshes.set(key, {
        guid: raw.guid,
        fileVersionId: raw.fileVersionId,
        ifcType: raw.ifcType,
        name: raw.name,
        positions: offsetPositions(raw.positions, origin),
        indices: raw.indices,
      });
    }

    const result = runNarrowPhase(
      pairs,
      meshes,
      {
        clearanceEnabled: msg.clearanceEnabled,
        clearanceMm: msg.clearanceMm,
        pairCap: msg.pairCap,
        signal: {
          get aborted() {
            return cancelled || activeRequestId !== msg.requestId;
          },
        },
        onProgress: (done, total, hits) => {
          if (cancelled || activeRequestId !== msg.requestId) return;
          const progress: ClashWorkerProgress = {
            type: "progress",
            requestId: msg.requestId,
            done,
            total,
            hits: [...hits],
          };
          self.postMessage(progress);
        },
      },
      origin,
    );

    if (cancelled || activeRequestId !== msg.requestId) return;
    const done: ClashWorkerDone = {
      type: "done",
      requestId: msg.requestId,
      hits: result.hits,
      scannedPairs: result.scannedPairs,
      truncated: result.truncated,
    };
    self.postMessage(done);
  } catch (err) {
    const error: ClashWorkerError = {
      type: "error",
      requestId: msg.requestId,
      message: err instanceof Error ? err.message : "Clash worker failed",
    };
    self.postMessage(error);
  }
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    if (activeRequestId === msg.requestId) cancelled = true;
    return;
  }
  if (msg.type === "run") handleRun(msg);
};
