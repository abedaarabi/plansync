"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  BimClashRunStats,
  BimClashSetDef,
  BimClashStatus,
} from "@plansync/shared/bimClashTypes";
import type { BimQuantityIndex } from "@plansync/shared/bimTypes";
import {
  bulkPatchClashes,
  clearClashTestResults,
  createClashTest,
  deleteClash,
  fetchClashTestClashes,
  fetchClashTests,
  patchClash,
  postClashRun,
  type BimClashRow,
  type BimClashTestRow,
} from "@/lib/api-client";
import {
  buildClashSetDef,
  clashCoveredByOpenModels,
  ifcTypesFromSet,
  levelFromSet,
  modelIdFromSet,
  openFileVersionIdsFromModelIds,
  resolveClashSet,
  sortModelsForClashPair,
  testMatchesOpenModels,
} from "@/lib/bim/clash/clashSets";
import { enrichClashRowsWithQuantityNames } from "@/lib/bim/clash/clashLabels";
import { runClashTest } from "@/lib/bim/clash/runClashTest";
import {
  readClashSession,
  writeClashSession,
  type ClashContextMode,
  type ClashSessionState,
} from "@/lib/bim/clash/clashSessionStorage";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";

type ClashModelRef = { modelId: string; name: string };

function withModelOnSet(prev: BimClashSetDef, model: ClashModelRef): BimClashSetDef {
  const prevId = modelIdFromSet(prev);
  return buildClashSetDef({
    modelId: model.modelId,
    modelName: model.name,
    // Keep type/level filters only when the model itself is unchanged.
    ifcTypes: prevId === model.modelId ? ifcTypesFromSet(prev) : [],
    level: prevId === model.modelId ? levelFromSet(prev) : null,
  });
}

/** Rebind Set A/B to the current federation; returns null when nothing changed. */
function nextClashSetsForModels(
  models: ClashModelRef[],
  prevA: BimClashSetDef,
  prevB: BimClashSetDef,
): { setA: BimClashSetDef; setB: BimClashSetDef } | null {
  if (models.length === 0) return null;
  const sorted = sortModelsForClashPair(models);
  const ids = new Set(models.map((m) => m.modelId));
  const idA = modelIdFromSet(prevA);
  const idB = modelIdFromSet(prevB);
  const aModel = idA && ids.has(idA) ? models.find((m) => m.modelId === idA)! : sorted[0]!;
  const bModel =
    sorted.length < 2
      ? null
      : idB && ids.has(idB) && idB !== aModel.modelId
        ? models.find((m) => m.modelId === idB)!
        : (sorted.find((m) => m.modelId !== aModel.modelId) ?? null);

  const nextA = withModelOnSet(prevA, aModel);
  const nextB = bModel
    ? withModelOnSet(prevB, bModel)
    : { label: "Set B", rules: [] as BimClashSetDef["rules"] };

  const aChanged = modelIdFromSet(prevA) !== modelIdFromSet(nextA) || prevA.label !== nextA.label;
  const bChanged = modelIdFromSet(prevB) !== modelIdFromSet(nextB) || prevB.label !== nextB.label;
  if (!aChanged && !bChanged) return null;
  return { setA: nextA, setB: nextB };
}

// fallow-ignore-next-line complexity
export function useBimClashSession(args: {
  projectId: string | null;
  fileVersionId: string | null;
  quantityIndex: BimQuantityIndex | null;
  engine: BimEngine | null;
  active: boolean;
  /** Loaded federation models — used to default Structure vs MEP as model pairs. */
  models?: { modelId: string; name: string }[];
}) {
  const [tests, setTests] = useState<BimClashTestRow[]>([]);
  const [activeTest, setActiveTest] = useState<BimClashTestRow | null>(null);
  const [clashes, setClashes] = useState<BimClashRow[]>([]);
  const [selectedClashId, setSelectedClashId] = useState<string | null>(null);
  const [setA, setSetA] = useState<BimClashSetDef>({ label: "Set A", rules: [] });
  const [setB, setSetB] = useState<BimClashSetDef>({ label: "Set B", rules: [] });
  const [clearanceEnabled, setClearanceEnabled] = useState(true);
  const [clearanceMm, setClearanceMm] = useState(25);
  const [statusFilter, setStatusFilter] = useState<BimClashStatus | "ALL" | "ORPHANED" | "STALE">(
    "ALL",
  );
  const [assigneeMe, setAssigneeMe] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [focusMode, setFocusMode] = useState(true);
  const [contextMode, setContextModeState] = useState<ClashContextMode>("ghost");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [runStats, setRunStats] = useState<BimClashRunStats | null>(null);
  const [previewHits, setPreviewHits] = useState<BimClashRow[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionLoaded = useRef(false);
  const setARef = useRef(setA);
  const setBRef = useRef(setB);
  setARef.current = setA;
  setBRef.current = setB;
  const selectedClashRef = useRef<BimClashRow | null>(null);
  const selectedClashIdRef = useRef<string | null>(null);
  selectedClashIdRef.current = selectedClashId;
  const activeTestRef = useRef<BimClashTestRow | null>(null);
  activeTestRef.current = activeTest;
  const engineRef = useRef<BimEngine | null>(args.engine);
  engineRef.current = args.engine;
  const contextModeRef = useRef<ClashContextMode>(contextMode);
  contextModeRef.current = contextMode;

  const modelsKey = useMemo(
    () => (args.models ?? []).map((m) => `${m.modelId}\0${m.name}`).join("|"),
    [args.models],
  );

  const openModelIds = useMemo(() => (args.models ?? []).map((m) => m.modelId), [args.models]);

  const openFileVersionIds = useMemo(
    () => openFileVersionIdsFromModelIds(openModelIds),
    [openModelIds],
  );

  // Restore session once per project.
  useEffect(() => {
    if (!args.projectId || sessionLoaded.current) return;
    sessionLoaded.current = true;
    const s = readClashSession(args.projectId);
    if (s.setA) setSetA(s.setA);
    if (s.setB) setSetB(s.setB);
    setClearanceEnabled(s.clearanceEnabled);
    setClearanceMm(s.clearanceMm);
    setStatusFilter(s.statusFilter);
    setAssigneeMe(s.assigneeMe);
    setGrouped(s.grouped);
    setFocusMode(s.focusMode);
    setContextModeState(s.contextMode);
  }, [args.projectId]);

  /** Tear down clash viewport first, then clear selection so Filters can re-apply. */
  const endClashReviewPresentation = useCallback(async () => {
    await engineRef.current?.clearClashReviewPresentation();
    setSelectedClashId(null);
  }, []);

  // Bind sets to loaded models once when the model list changes — never in a setA/setB loop.
  useEffect(() => {
    const models = args.models ?? [];
    const openIds = models.map((m) => m.modelId);
    const openFvs = openFileVersionIdsFromModelIds(openIds);

    const nextSets = nextClashSetsForModels(models, setARef.current, setBRef.current);
    if (nextSets) {
      setSetA(nextSets.setA);
      setSetB(nextSets.setB);
    }

    // Drop results / selection when the federation no longer covers the active test.
    const test = activeTestRef.current;
    if (test && !testMatchesOpenModels(test, openIds)) {
      setActiveTest(null);
      setClashes([]);
      setRunStats(null);
      void endClashReviewPresentation();
    } else {
      const clash = selectedClashRef.current;
      if (clash && !clashCoveredByOpenModels(clash, openFvs)) {
        void endClashReviewPresentation();
      }
    }
    // modelsKey captures args.models identity without a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when loaded models change
  }, [modelsKey, endClashReviewPresentation]);

  // Persist session. Keep last matching testId when results are cleared for an unrelated federation.
  useEffect(() => {
    if (!args.projectId || !args.active) return;
    const prevTestId = readClashSession(args.projectId).testId;
    const state: ClashSessionState = {
      testId: activeTest?.id ?? prevTestId,
      statusFilter,
      assigneeMe,
      grouped,
      focusMode,
      contextMode,
      setA,
      setB,
      clearanceEnabled,
      clearanceMm,
    };
    writeClashSession(args.projectId, state);
  }, [
    args.projectId,
    args.active,
    activeTest?.id,
    statusFilter,
    assigneeMe,
    grouped,
    focusMode,
    contextMode,
    setA,
    setB,
    clearanceEnabled,
    clearanceMm,
  ]);

  const pickPreferredClashTest = useCallback(
    (list: BimClashTestRow[], session: ClashSessionState): BimClashTestRow | null => {
      const matching = list.filter((t) => testMatchesOpenModels(t, openModelIds));
      if (matching.length === 0) return null;
      const currentId = activeTestRef.current?.id;
      const labelA = setARef.current.label;
      const labelB = setBRef.current.label;
      return (
        (currentId ? matching.find((t) => t.id === currentId) : null) ??
        matching.find((t) => t.id === session.testId) ??
        matching.find((t) => t.setA.label === labelA && t.setB.label === labelB) ??
        matching[0] ??
        null
      );
    },
    [openModelIds],
  );

  const clearClashResultsState = useCallback(async () => {
    setActiveTest(null);
    setClashes([]);
    setRunStats(null);
    setPreviewHits([]);
    await endClashReviewPresentation();
  }, [endClashReviewPresentation]);

  const reloadTests = useCallback(async () => {
    if (!args.projectId) return;
    try {
      const list = await fetchClashTests(args.projectId);
      setTests(list);
      const preferred = pickPreferredClashTest(list, readClashSession(args.projectId));
      if (!preferred) {
        await clearClashResultsState();
        return;
      }
      setActiveTest(preferred);
      // Do not overwrite setA/setB here — that fought model binding and re-fetched in a loop.
      const data = await fetchClashTestClashes(preferred.id);
      setClashes(data.clashes);
      setRunStats(data.test.lastRunStats);
      // Keep pair presentation if a clash is already selected and still covered.
      const row = selectedClashIdRef.current
        ? data.clashes.find((c) => c.id === selectedClashIdRef.current)
        : null;
      const engine = engineRef.current;
      if (
        engine &&
        row &&
        (row.guidA || row.guidB) &&
        clashCoveredByOpenModels(row, openFileVersionIds)
      ) {
        await engine.presentClashPartners({
          a: { guid: row.guidA, fileVersionId: row.fileVersionAId },
          b: { guid: row.guidB, fileVersionId: row.fileVersionBId },
          point: row.point,
          context: contextModeRef.current,
          refocusCamera: false,
        });
      } else if (
        selectedClashIdRef.current &&
        (!row || !clashCoveredByOpenModels(row, openFileVersionIds))
      ) {
        await endClashReviewPresentation();
      }
    } catch (err) {
      if (args.active) {
        toast.error(err instanceof Error ? err.message : "Could not load clash tests");
      }
    }
  }, [
    args.projectId,
    args.active,
    pickPreferredClashTest,
    clearClashResultsState,
    endClashReviewPresentation,
    openFileVersionIds,
  ]);

  useEffect(() => {
    if (!args.active || !args.projectId) return;
    void reloadTests();
  }, [args.active, args.projectId, modelsKey, reloadTests]);

  const displayClashes = useMemo(() => {
    const rows = previewHits.length > 0 && running ? previewHits : clashes;
    return enrichClashRowsWithQuantityNames(rows, args.quantityIndex);
  }, [clashes, previewHits, running, args.quantityIndex]);

  const filteredIds = useMemo(() => {
    let rows = displayClashes;
    if (statusFilter === "ORPHANED") {
      rows = rows.filter((c) => Boolean(c.elementMissingSinceId));
    } else if (statusFilter === "STALE") {
      const last = activeTest?.lastRunAt;
      if (last) {
        const t = new Date(last).getTime();
        rows = rows.filter((c) => new Date(c.lastSeenAt).getTime() < t);
      }
    } else if (statusFilter !== "ALL") {
      rows = rows.filter((c) => c.status === statusFilter);
    }
    return new Set(rows.map((c) => c.id));
  }, [displayClashes, statusFilter, activeTest?.lastRunAt]);

  const selectedClash = displayClashes.find((c) => c.id === selectedClashId) ?? null;
  selectedClashRef.current = selectedClash;

  const openCount = useMemo(
    () => clashes.filter((c) => c.status === "NEW" || c.status === "ACTIVE").length,
    [clashes],
  );

  const ensureTest = useCallback(async (): Promise<BimClashTestRow> => {
    if (!args.projectId) throw new Error("Missing project");
    if (
      activeTest &&
      activeTest.setA.label === setA.label &&
      activeTest.setB.label === setB.label
    ) {
      return activeTest;
    }
    const existing = tests.find((t) => t.setA.label === setA.label && t.setB.label === setB.label);
    if (existing) {
      setActiveTest(existing);
      return existing;
    }
    const created = await createClashTest(args.projectId, {
      name: `${setA.label} vs ${setB.label}`,
      setA,
      setB,
      clearanceEnabled,
      clearanceMm,
    });
    setTests((prev) => [created, ...prev]);
    setActiveTest(created);
    return created;
  }, [args.projectId, activeTest, setA, setB, tests, clearanceEnabled, clearanceMm]);

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setProgress(null);
  }, []);

  const setCounts = useMemo(() => {
    const a = resolveClashSet(args.quantityIndex, setA, args.fileVersionId).length;
    const b = resolveClashSet(args.quantityIndex, setB, args.fileVersionId).length;
    return { a, b };
  }, [args.quantityIndex, args.fileVersionId, setA, setB]);

  const presentClashIsolate = useCallback(
    async (
      clash: BimClashRow,
      contextOverride?: ClashContextMode,
      opts?: { refocusCamera?: boolean },
    ) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (!clash.guidA && !clash.guidB) return;
      if (!clashCoveredByOpenModels(clash, openFileVersionIds)) {
        toast.error("Load both clash partner models to review this clash.");
        return;
      }
      await engine.presentClashPartners({
        a: { guid: clash.guidA, fileVersionId: clash.fileVersionAId },
        b: { guid: clash.guidB, fileVersionId: clash.fileVersionBId },
        point: clash.point,
        context: contextOverride ?? contextModeRef.current,
        refocusCamera: opts?.refocusCamera,
      });
    },
    [openFileVersionIds],
  );

  const setContextMode = useCallback(
    (mode: ClashContextMode) => {
      contextModeRef.current = mode;
      setContextModeState(mode);
      const clash = selectedClashRef.current;
      // Context toggle should not yank the camera — only re-paint presentation.
      if (clash) void presentClashIsolate(clash, mode, { refocusCamera: false });
    },
    [presentClashIsolate],
  );

  const inspectClashItem = useCallback(
    async (clash: BimClashRow, item: "a" | "b") => {
      const engine = args.engine;
      if (!engine) return;
      await engine.inspectClashPartner(
        item === "a"
          ? { guid: clash.guidA, fileVersionId: clash.fileVersionAId }
          : { guid: clash.guidB, fileVersionId: clash.fileVersionBId },
      );
    },
    [args.engine],
  );

  // fallow-ignore-next-line complexity
  const runTest = useCallback(async () => {
    const engine = args.engine;
    if (!engine || !args.projectId) {
      toast.error("Open a project model before running clash detection.");
      return;
    }
    if (!args.quantityIndex?.elements?.length) {
      toast.error("Quantity index is still loading. Wait until both models finish indexing.");
      return;
    }
    cancelRun();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress(0);
    setPreviewHits([]);
    try {
      const test = await ensureTest();
      toast.message(
        `Scanning ${setCounts.a.toLocaleString()} × ${setCounts.b.toLocaleString()} elements…`,
      );
      const result = await runClashTest({
        engine,
        quantityIndex: args.quantityIndex,
        setA,
        setB,
        clearanceEnabled,
        clearanceMm,
        fallbackFileVersionId: args.fileVersionId,
        signal: controller.signal,
        onProgress: (info) => {
          if (info.total > 0) setProgress(info.done / info.total);
          if (info.hits.length > 0) {
            // Temporary preview rows until persist completes.
            setPreviewHits(
              info.hits.map((h, i) => ({
                id: `preview-${i}-${h.guidA}-${h.guidB}`,
                testId: test.id,
                projectId: args.projectId!,
                fileVersionAId: h.fileVersionIdA,
                fileVersionBId: h.fileVersionIdB,
                elementAId: "",
                elementBId: "",
                guidA: h.guidA,
                guidB: h.guidB,
                clashType: h.clashType,
                distanceMm: h.distanceMm,
                point: h.point,
                contactCount: h.contactCount,
                status: "NEW" as const,
                statusChangedAt: null,
                statusDistanceMm: null,
                assigneeId: null,
                groupId: null,
                elementMissingSinceId: null,
                issueId: null,
                firstSeenAt: new Date().toISOString(),
                lastSeenAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                elementA: {
                  name: h.nameA ?? null,
                  ifcType: h.ifcTypeA ?? null,
                  ifcGuid: h.guidA,
                },
                elementB: {
                  name: h.nameB ?? null,
                  ifcType: h.ifcTypeB ?? null,
                  ifcGuid: h.guidB,
                },
                assignee: null,
                issue: null,
              })),
            );
          }
        },
      });
      if (controller.signal.aborted) return;

      const d = result.diagnostics;
      if (d.setACount === 0 || d.setBCount === 0) {
        toast.error(
          `Selection sets are empty (A: ${d.setACount}, B: ${d.setBCount}). Pick each IFC under Model in Selection sets.`,
        );
        return;
      }
      if (d.boxesA === 0 || d.boxesB === 0) {
        toast.error(
          `Could not read geometry boxes (A: ${d.boxesA}, B: ${d.boxesB}). Wait for both models to finish loading.`,
        );
        return;
      }
      if (d.pairs === 0) {
        toast.error(
          `No overlapping pairs (${d.boxesA} × ${d.boxesB} boxes). Models may not share the same coordinates.`,
        );
        return;
      }

      const saved = await postClashRun(test.id, {
        clearanceEnabled,
        clearanceMm,
        setA,
        setB,
        hits: result.hits,
        scannedPairs: result.scannedPairs,
        truncated: result.truncated,
      });
      setClashes(saved.clashes);
      setRunStats(saved.stats);
      setPreviewHits([]);
      setStatusFilter("ALL");
      setActiveTest((prev) =>
        prev
          ? {
              ...prev,
              lastRunAt: new Date().toISOString(),
              lastRunStats: saved.stats,
              clearanceEnabled,
              clearanceMm,
              setA,
              setB,
            }
          : prev,
      );

      const reviewFirst =
        saved.clashes.find((c) => c.status === "NEW" || c.status === "ACTIVE") ??
        saved.clashes[0] ??
        null;
      if (reviewFirst) {
        setSelectedClashId(reviewFirst.id);
        await presentClashIsolate(reviewFirst);
        toast.success(
          `Clash run complete · ${saved.clashes.length} clashes · reviewing first result`,
        );
      } else if (result.hits.length > 0) {
        toast.error(
          `Found ${result.hits.length} geometric hits but none could be saved. Check that both models belong to this project.`,
        );
      } else {
        toast.success(
          `Clash run complete · no clashes · ${result.scannedPairs.toLocaleString()} pairs scanned`,
        );
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        toast.error(err instanceof Error ? err.message : "Clash test failed");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
      setProgress(null);
      setPreviewHits([]);
    }
  }, [
    args.engine,
    args.projectId,
    args.quantityIndex,
    args.fileVersionId,
    setA,
    setB,
    setCounts.a,
    setCounts.b,
    clearanceEnabled,
    clearanceMm,
    ensureTest,
    cancelRun,
    presentClashIsolate,
  ]);

  const focusClash = useCallback(
    async (clash: BimClashRow) => {
      if (!clashCoveredByOpenModels(clash, openFileVersionIds)) {
        toast.error("Load both clash partner models to review this clash.");
        return;
      }
      setSelectedClashId(clash.id);
      await presentClashIsolate(clash);
    },
    [presentClashIsolate, openFileVersionIds],
  );

  const clearFocusMode = useCallback(async () => {
    await endClashReviewPresentation();
  }, [endClashReviewPresentation]);

  const deleteClashById = useCallback(
    async (clash: BimClashRow) => {
      try {
        await deleteClash(clash.id);
        setClashes((prev) => prev.filter((c) => c.id !== clash.id));
        if (selectedClashId === clash.id) {
          await endClashReviewPresentation();
        }
        toast.success("Clash deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete clash");
      }
    },
    [endClashReviewPresentation, selectedClashId],
  );

  /** Wipe all saved clashes for the active test and return to a clean setup. */
  const resetClashResults = useCallback(async () => {
    const test = activeTest;
    if (!test) {
      setClashes([]);
      setRunStats(null);
      setPreviewHits([]);
      await endClashReviewPresentation();
      return;
    }
    try {
      const { deletedCount } = await clearClashTestResults(test.id);
      setClashes([]);
      setRunStats(null);
      setPreviewHits([]);
      setActiveTest({
        ...test,
        lastRunAt: null,
        lastRunById: null,
        lastRunStats: null,
        clashCount: 0,
      });
      setTests((prev) =>
        prev.map((t) =>
          t.id === test.id
            ? { ...t, lastRunAt: null, lastRunById: null, lastRunStats: null, clashCount: 0 }
            : t,
        ),
      );
      await endClashReviewPresentation();
      toast.success(
        deletedCount > 0
          ? `Cleared ${deletedCount.toLocaleString()} clash${deletedCount === 1 ? "" : "es"}`
          : "Clash results cleared",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset clash results");
    }
  }, [activeTest, endClashReviewPresentation]);

  /** After IssueFormSlider saves, attach the new issue to one or more clashes. */
  const linkClashesToIssue = useCallback(
    async (clashIds: string[], issueId: string) => {
      const uniqueIds = [...new Set(clashIds.filter(Boolean))];
      if (uniqueIds.length === 0) return;

      if (uniqueIds.length === 1) {
        const updated = await patchClash(uniqueIds[0]!, { issueId });
        setClashes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        return;
      }

      const testId =
        clashes.find((c) => uniqueIds.includes(c.id))?.testId ?? activeTest?.id ?? null;
      if (!testId) {
        throw new Error("Could not resolve clash test for linking.");
      }
      const updated = await bulkPatchClashes(testId, { clashIds: uniqueIds, issueId });
      const byId = new Map(updated.map((c) => [c.id, c]));
      setClashes((prev) => prev.map((c) => byId.get(c.id) ?? c));
    },
    [activeTest?.id, clashes],
  );

  const levels = useMemo(() => {
    if (!args.quantityIndex) return [];
    return Object.keys(args.quantityIndex.byLevel ?? {}).sort();
  }, [args.quantityIndex]);

  return {
    tests,
    activeTest,
    clashes: displayClashes,
    selectedClashId,
    selectedClash,
    setA,
    setB,
    clearanceEnabled,
    clearanceMm,
    statusFilter,
    assigneeMe,
    grouped,
    focusMode,
    contextMode,
    running,
    progress,
    runStats,
    openCount,
    filteredIds,
    setCounts,
    levels,
    setSetA,
    setSetB,
    setClearanceEnabled,
    setClearanceMm,
    setStatusFilter,
    setAssigneeMe,
    setGrouped,
    setFocusMode,
    setContextMode,
    setClashes,
    setSelectedClashId,
    runTest,
    cancelRun,
    focusClash,
    inspectClashItem,
    clearFocusMode,
    deleteClashById,
    resetClashResults,
    linkClashesToIssue,
  };
}
