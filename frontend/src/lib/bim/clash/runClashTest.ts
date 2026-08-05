import type { BimClashHit, BimClashRunMode, BimClashSetDef } from "@plansync/shared/bimClashTypes";
import { runModeNeedsClearance } from "@plansync/shared/bimClashTypes";
import type { BimQuantityIndex } from "@plansync/shared/bimTypes";
import {
  broadPhasePairs,
  computeOriginOffset,
  offsetPositions,
  runNarrowPhase,
  type ClashElementBox,
  type ClashMeshPayload,
} from "./clashCore";
import { resolveClashSet } from "./clashSets";
import type {
  ClashWorkerDone,
  ClashWorkerError,
  ClashWorkerProgress,
  ClashWorkerRequest,
} from "./clashWorker";

export type ClashGuidRef = { guid: string; fileVersionId?: string | null };

export type ClashGeometrySource = {
  /**
   * Resolve IFC GUIDs to fragment local ids. Prefer fileVersionId so federated
   * models (and progressive tiles) map correctly even when GlobalIds collide.
   */
  resolveGuidsToLocalIds: (
    refs: ClashGuidRef[],
  ) => Promise<Map<string, { modelId: string; localId: number; fileVersionId: string | null }>>;
  getElementBoxes: (modelId: string, localIds: number[]) => Promise<Float32Array>;
  getElementGeometry: (
    modelId: string,
    localIds: number[],
  ) => Promise<
    {
      localId: number;
      positions: Float32Array;
      indices: Uint32Array | null;
    }[]
  >;
};

export type RunClashTestArgs = {
  engine: ClashGeometrySource;
  quantityIndex: BimQuantityIndex | null;
  setA: BimClashSetDef;
  setB: BimClashSetDef;
  clearanceEnabled: boolean;
  clearanceMm: number;
  runMode?: BimClashRunMode;
  fallbackFileVersionId?: string | null;
  pairCap?: number;
  signal?: AbortSignal;
  onProgress?: (info: {
    phase: "boxes" | "geometry" | "narrow";
    done: number;
    total: number;
    hits: BimClashHit[];
  }) => void;
};

function effectiveClearance(args: RunClashTestArgs): boolean {
  const mode = args.runMode ?? (args.clearanceEnabled ? "BOTH" : "HARD");
  return runModeNeedsClearance(mode) && args.clearanceMm > 0;
}

export type RunClashTestDiagnostics = {
  setACount: number;
  setBCount: number;
  boxesA: number;
  boxesB: number;
  pairs: number;
  meshes: number;
};

export type RunClashTestResult = {
  hits: BimClashHit[];
  scannedPairs: number;
  truncated: boolean;
  diagnostics: RunClashTestDiagnostics;
};

function meshKey(fileVersionId: string, guid: string): string {
  return `${fileVersionId}:${guid}`;
}

function isFiniteBox(box: Float32Array): boolean {
  return (
    box.length >= 6 &&
    Number.isFinite(box[0]) &&
    Number.isFinite(box[1]) &&
    Number.isFinite(box[2]) &&
    Number.isFinite(box[3]) &&
    Number.isFinite(box[4]) &&
    Number.isFinite(box[5]) &&
    box[3]! > box[0]! &&
    box[4]! > box[1]! &&
    box[5]! > box[2]!
  );
}

function emptyResult(diagnostics: RunClashTestDiagnostics): RunClashTestResult {
  return { hits: [], scannedPairs: 0, truncated: false, diagnostics };
}

// fallow-ignore-next-line complexity
async function collectBoxes(
  engine: ClashGeometrySource,
  elements: {
    guid: string;
    fileVersionId: string;
    ifcType: string | null;
    name: string | null;
  }[],
  signal?: AbortSignal,
): Promise<ClashElementBox[]> {
  const byModel = new Map<
    string,
    {
      localId: number;
      guid: string;
      fileVersionId: string;
      ifcType: string | null;
      name: string | null;
    }[]
  >();
  const resolved = await engine.resolveGuidsToLocalIds(
    elements.map((e) => ({ guid: e.guid, fileVersionId: e.fileVersionId })),
  );
  // Key meta by guid+fileVersion — federated models may reuse GlobalIds.
  const metaByKey = new Map(elements.map((e) => [`${e.fileVersionId}\0${e.guid}`, e] as const));

  for (const [guid, loc] of resolved) {
    const meta =
      metaByKey.get(`${loc.fileVersionId ?? ""}\0${guid}`) ??
      elements.find(
        (e) => e.guid === guid && (!loc.fileVersionId || e.fileVersionId === loc.fileVersionId),
      );
    if (!meta) continue;
    const list = byModel.get(loc.modelId) ?? [];
    list.push({
      localId: loc.localId,
      guid,
      fileVersionId: meta.fileVersionId,
      ifcType: meta.ifcType,
      name: meta.name,
    });
    byModel.set(loc.modelId, list);
  }

  const out: ClashElementBox[] = [];
  for (const [modelId, items] of byModel) {
    if (signal?.aborted) break;
    const localIds = items.map((i) => i.localId);
    const boxes = await engine.getElementBoxes(modelId, localIds);
    // boxes is flat: 6 floats per localId
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const offset = i * 6;
      if (offset + 5 >= boxes.length) continue;
      const box = boxes.slice(offset, offset + 6);
      if (!isFiniteBox(box)) continue;
      out.push({
        guid: item.guid,
        fileVersionId: item.fileVersionId,
        ifcType: item.ifcType,
        name: item.name,
        box,
      });
    }
  }
  return out;
}

// fallow-ignore-next-line complexity
async function collectGeometry(
  engine: ClashGeometrySource,
  candidates: ClashElementBox[],
  signal?: AbortSignal,
): Promise<Map<string, ClashMeshPayload>> {
  const byModel = new Map<string, ClashElementBox[]>();
  const resolved = await engine.resolveGuidsToLocalIds(
    candidates.map((c) => ({ guid: c.guid, fileVersionId: c.fileVersionId })),
  );
  const boxByKey = new Map(candidates.map((c) => [`${c.fileVersionId}\0${c.guid}`, c] as const));

  for (const [guid, loc] of resolved) {
    const box =
      boxByKey.get(`${loc.fileVersionId ?? ""}\0${guid}`) ??
      candidates.find(
        (c) => c.guid === guid && (!loc.fileVersionId || c.fileVersionId === loc.fileVersionId),
      );
    if (!box) continue;
    const list = byModel.get(loc.modelId) ?? [];
    list.push(box);
    byModel.set(loc.modelId, list);
  }

  const meshes = new Map<string, ClashMeshPayload>();
  for (const [modelId, boxes] of byModel) {
    if (signal?.aborted) break;
    const locs = await engine.resolveGuidsToLocalIds(
      boxes.map((b) => ({ guid: b.guid, fileVersionId: b.fileVersionId })),
    );
    const localIds: number[] = [];
    const order: ClashElementBox[] = [];
    for (const box of boxes) {
      const loc = locs.get(box.guid);
      if (!loc || loc.modelId !== modelId) continue;
      // Prefer the entry that matches this box's file version when GlobalIds collide.
      if (loc.fileVersionId && loc.fileVersionId !== box.fileVersionId) continue;
      localIds.push(loc.localId);
      order.push(box);
    }
    if (localIds.length === 0) continue;
    const geos = await engine.getElementGeometry(modelId, localIds);
    const geoByLocal = new Map(geos.map((g) => [g.localId, g]));
    for (let i = 0; i < order.length; i++) {
      const box = order[i]!;
      const localId = localIds[i]!;
      const geo = geoByLocal.get(localId);
      if (!geo) continue;
      meshes.set(meshKey(box.fileVersionId, box.guid), {
        guid: box.guid,
        fileVersionId: box.fileVersionId,
        ifcType: box.ifcType,
        name: box.name,
        positions: geo.positions,
        indices: geo.indices,
      });
    }
  }
  return meshes;
}

function runOnMainThread(
  setA: ClashElementBox[],
  setB: ClashElementBox[],
  worldMeshes: Map<string, ClashMeshPayload>,
  args: RunClashTestArgs,
  diagnostics: RunClashTestDiagnostics,
): Promise<RunClashTestResult> {
  return new Promise((resolve) => {
    const origin = computeOriginOffset(setA, setB);
    const clearanceOn = effectiveClearance(args);
    const runMode = args.runMode ?? (args.clearanceEnabled ? "BOTH" : "HARD");
    const pairs = broadPhasePairs(setA, setB, args.clearanceMm, clearanceOn);
    const meshes = new Map<string, ClashMeshPayload>();
    for (const [key, m] of worldMeshes) {
      meshes.set(key, { ...m, positions: offsetPositions(m.positions, origin) });
    }

    const CHUNK = 4;
    let index = 0;
    const accumulated: BimClashHit[] = [];
    const pairCap = args.pairCap ?? 50_000;
    const work = pairs.slice(0, pairCap);

    const step = () => {
      if (args.signal?.aborted) {
        resolve({
          hits: accumulated,
          scannedPairs: index,
          truncated: pairs.length > pairCap,
          diagnostics,
        });
        return;
      }
      const slice = work.slice(index, index + CHUNK);
      if (slice.length === 0) {
        resolve({
          hits: accumulated,
          scannedPairs: work.length,
          truncated: pairs.length > pairCap,
          diagnostics,
        });
        return;
      }
      const partial = runNarrowPhase(
        slice,
        meshes,
        {
          clearanceEnabled: clearanceOn,
          clearanceMm: args.clearanceMm,
          runMode,
          pairCap: slice.length,
        },
        origin,
      );
      accumulated.push(...partial.hits);
      index += slice.length;
      args.onProgress?.({
        phase: "narrow",
        done: index,
        total: work.length,
        hits: [...accumulated],
      });
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => step(), { timeout: 32 });
      } else {
        setTimeout(step, 0);
      }
    };
    step();
  });
}

function runInWorker(
  setA: ClashElementBox[],
  setB: ClashElementBox[],
  worldMeshes: Map<string, ClashMeshPayload>,
  args: RunClashTestArgs,
  diagnostics: RunClashTestDiagnostics,
): Promise<RunClashTestResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./clashWorker.ts", import.meta.url), { type: "module" });
    } catch (err) {
      reject(err);
      return;
    }

    const requestId = `clash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const meshRecord: ClashWorkerRequest["meshes"] = {};
    const transfer: Transferable[] = [];
    for (const [key, m] of worldMeshes) {
      // Copy buffers so we can transfer without detaching orchestrator copies.
      const positions = m.positions.slice();
      const indices = m.indices ? m.indices.slice() : null;
      meshRecord[key] = {
        guid: m.guid,
        fileVersionId: m.fileVersionId,
        ifcType: m.ifcType,
        name: m.name,
        positions,
        indices,
      };
      transfer.push(positions.buffer);
      if (indices) transfer.push(indices.buffer);
    }

    const onAbort = () => {
      worker.postMessage({ type: "cancel", requestId });
      worker.terminate();
      resolve(emptyResult(diagnostics));
    };
    args.signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = (
      ev: MessageEvent<ClashWorkerProgress | ClashWorkerDone | ClashWorkerError>,
    ) => {
      const msg = ev.data;
      if (msg.requestId !== requestId) return;
      if (msg.type === "progress") {
        args.onProgress?.({
          phase: "narrow",
          done: msg.done,
          total: msg.total,
          hits: msg.hits,
        });
        return;
      }
      args.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      if (msg.type === "error") {
        reject(new Error(msg.message));
        return;
      }
      resolve({
        hits: msg.hits,
        scannedPairs: msg.scannedPairs,
        truncated: msg.truncated,
        diagnostics,
      });
    };
    worker.onerror = (err) => {
      args.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      reject(err.error ?? new Error("Clash worker error"));
    };

    const clearanceOn = effectiveClearance(args);
    const runMode = args.runMode ?? (args.clearanceEnabled ? "BOTH" : "HARD");
    const req: ClashWorkerRequest = {
      type: "run",
      requestId,
      setA,
      setB,
      meshes: meshRecord,
      clearanceEnabled: clearanceOn,
      clearanceMm: args.clearanceMm,
      runMode,
      pairCap: args.pairCap,
    };
    worker.postMessage(req, transfer);
  });
}

export async function runClashTest(args: RunClashTestArgs): Promise<RunClashTestResult> {
  const elsA = resolveClashSet(args.quantityIndex, args.setA, args.fallbackFileVersionId);
  const elsB = resolveClashSet(args.quantityIndex, args.setB, args.fallbackFileVersionId);
  const baseDiag = {
    setACount: elsA.length,
    setBCount: elsB.length,
    boxesA: 0,
    boxesB: 0,
    pairs: 0,
    meshes: 0,
  };
  if (elsA.length === 0 || elsB.length === 0) {
    return emptyResult(baseDiag);
  }

  args.onProgress?.({ phase: "boxes", done: 0, total: elsA.length + elsB.length, hits: [] });
  const [setA, setB] = await Promise.all([
    collectBoxes(args.engine, elsA, args.signal),
    collectBoxes(args.engine, elsB, args.signal),
  ]);
  if (args.signal?.aborted) {
    return emptyResult({ ...baseDiag, boxesA: setA.length, boxesB: setB.length });
  }

  const pairs = broadPhasePairs(setA, setB, args.clearanceMm, effectiveClearance(args));
  const candidateBoxes: ClashElementBox[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const ka = meshKey(p.a.fileVersionId, p.a.guid);
    const kb = meshKey(p.b.fileVersionId, p.b.guid);
    if (!seen.has(ka)) {
      seen.add(ka);
      candidateBoxes.push(p.a);
    }
    if (!seen.has(kb)) {
      seen.add(kb);
      candidateBoxes.push(p.b);
    }
  }

  const midDiag: RunClashTestDiagnostics = {
    ...baseDiag,
    boxesA: setA.length,
    boxesB: setB.length,
    pairs: pairs.length,
  };
  if (pairs.length === 0) {
    return emptyResult(midDiag);
  }

  args.onProgress?.({
    phase: "geometry",
    done: 0,
    total: candidateBoxes.length,
    hits: [],
  });
  const worldMeshes = await collectGeometry(args.engine, candidateBoxes, args.signal);
  const finalDiag: RunClashTestDiagnostics = { ...midDiag, meshes: worldMeshes.size };
  if (args.signal?.aborted) {
    return emptyResult(finalDiag);
  }

  try {
    return await runInWorker(setA, setB, worldMeshes, args, finalDiag);
  } catch {
    return runOnMainThread(setA, setB, worldMeshes, args, finalDiag);
  }
}
