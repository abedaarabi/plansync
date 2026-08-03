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
  createIssue,
  deleteClash,
  fetchClashTestClashes,
  fetchClashTests,
  fetchProjectSession,
  patchClash,
  postClashRun,
  type BimClashRow,
  type BimClashTestRow,
} from "@/lib/api-client";
import {
  uploadIssueReferencePhotoFile,
  type IssueBimAnchor,
} from "@/lib/api-client/core-issues-takeoff";
import {
  buildClashSetDef,
  ifcTypesFromSet,
  levelFromSet,
  modelIdFromSet,
  resolveClashSet,
  sortModelsForClashPair,
} from "@/lib/bim/clash/clashSets";
import {
  clashElementLabel,
  clashIssueDescription,
  enrichClashRowsWithQuantityNames,
} from "@/lib/bim/clash/clashLabels";
import { formatClashDistanceDetail } from "@/lib/bim/clash/clashStatusStyle";
import { runClashTest } from "@/lib/bim/clash/runClashTest";
import {
  readClashSession,
  writeClashSession,
  type ClashContextMode,
  type ClashSessionState,
} from "@/lib/bim/clash/clashSessionStorage";
import { dataUrlToFile } from "@/lib/bim/bimMarkupSnapshot";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";

async function resolveWorkspaceId(projectId: string): Promise<string> {
  const session = await fetchProjectSession(projectId);
  return session.workspaceId;
}

// fallow-ignore-next-line complexity
export function useBimClashSession(args: {
  projectId: string | null;
  fileId: string;
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
  const [contextMode, setContextModeState] = useState<ClashContextMode>("color");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [runStats, setRunStats] = useState<BimClashRunStats | null>(null);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [previewHits, setPreviewHits] = useState<BimClashRow[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionLoaded = useRef(false);
  const setARef = useRef(setA);
  const setBRef = useRef(setB);
  setARef.current = setA;
  setBRef.current = setB;
  const selectedClashRef = useRef<BimClashRow | null>(null);
  const contextModeRef = useRef<ClashContextMode>(contextMode);
  contextModeRef.current = contextMode;

  const modelsKey = useMemo(
    () => (args.models ?? []).map((m) => `${m.modelId}\0${m.name}`).join("|"),
    [args.models],
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

  // Bind sets to loaded models once when the model list changes — never in a setA/setB loop.
  useEffect(() => {
    const models = args.models ?? [];
    if (models.length === 0) return;
    const sorted = sortModelsForClashPair(models);
    const ids = new Set(models.map((m) => m.modelId));

    const withModel = (prev: BimClashSetDef, model: { modelId: string; name: string }) => {
      const prevId = modelIdFromSet(prev);
      return buildClashSetDef({
        modelId: model.modelId,
        modelName: model.name,
        // Keep type/level filters only when the model itself is unchanged.
        ifcTypes: prevId === model.modelId ? ifcTypesFromSet(prev) : [],
        level: prevId === model.modelId ? levelFromSet(prev) : null,
      });
    };

    const prevA = setARef.current;
    const prevB = setBRef.current;
    const idA = modelIdFromSet(prevA);
    const idB = modelIdFromSet(prevB);
    const aModel = idA && ids.has(idA) ? models.find((m) => m.modelId === idA)! : sorted[0]!;
    const bModel =
      sorted.length < 2
        ? null
        : idB && ids.has(idB) && idB !== aModel.modelId
          ? models.find((m) => m.modelId === idB)!
          : (sorted.find((m) => m.modelId !== aModel.modelId) ?? null);

    const nextA = withModel(prevA, aModel);
    const nextB = bModel
      ? withModel(prevB, bModel)
      : { label: "Set B", rules: [] as BimClashSetDef["rules"] };

    if (modelIdFromSet(prevA) !== modelIdFromSet(nextA) || prevA.label !== nextA.label) {
      setSetA(nextA);
    }
    if (modelIdFromSet(prevB) !== modelIdFromSet(nextB) || prevB.label !== nextB.label) {
      setSetB(nextB);
    }
    // modelsKey captures args.models identity without a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when loaded models change
  }, [modelsKey]);

  // Persist session.
  useEffect(() => {
    if (!args.projectId || !args.active) return;
    const state: ClashSessionState = {
      testId: activeTest?.id ?? null,
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

  const reloadTests = useCallback(async () => {
    if (!args.projectId) return;
    try {
      const list = await fetchClashTests(args.projectId);
      setTests(list);
      const session = readClashSession(args.projectId);
      const labelA = setARef.current.label;
      const labelB = setBRef.current.label;
      const preferred =
        list.find((t) => t.id === session.testId) ??
        list.find((t) => t.setA.label === labelA && t.setB.label === labelB) ??
        list[0] ??
        null;
      if (preferred) {
        setActiveTest(preferred);
        // Do not overwrite setA/setB here — that fought model binding and re-fetched in a loop.
        const data = await fetchClashTestClashes(preferred.id);
        setClashes(data.clashes);
        setRunStats(data.test.lastRunStats);
      }
    } catch (err) {
      if (args.active) {
        toast.error(err instanceof Error ? err.message : "Could not load clash tests");
      }
    }
  }, [args.projectId, args.active]);

  useEffect(() => {
    if (!args.active || !args.projectId) return;
    void reloadTests();
  }, [args.active, args.projectId, reloadTests]);

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
      const engine = args.engine;
      if (!engine) return;
      if (!clash.guidA && !clash.guidB) return;
      await engine.presentClashPartners({
        a: { guid: clash.guidA, fileVersionId: clash.fileVersionAId },
        b: { guid: clash.guidB, fileVersionId: clash.fileVersionBId },
        point: clash.point,
        context: contextOverride ?? contextModeRef.current,
        refocusCamera: opts?.refocusCamera,
      });
    },
    [args.engine],
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
      setSelectedClashId(clash.id);
      await presentClashIsolate(clash);
    },
    [presentClashIsolate],
  );

  const clearFocusMode = useCallback(async () => {
    const engine = args.engine;
    if (!engine) return;
    setSelectedClashId(null);
    await engine.clearClashReviewPresentation();
  }, [args.engine]);

  const deleteClashById = useCallback(
    async (clash: BimClashRow) => {
      try {
        await deleteClash(clash.id);
        setClashes((prev) => prev.filter((c) => c.id !== clash.id));
        if (selectedClashId === clash.id) {
          setSelectedClashId(null);
          await args.engine?.clearClashReviewPresentation();
        }
        toast.success("Clash deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete clash");
      }
    },
    [args.engine, selectedClashId],
  );

  /** Wipe all saved clashes for the active test and return to a clean setup. */
  const resetClashResults = useCallback(async () => {
    const test = activeTest;
    if (!test) {
      setClashes([]);
      setRunStats(null);
      setSelectedClashId(null);
      setPreviewHits([]);
      await args.engine?.clearClashReviewPresentation();
      return;
    }
    try {
      const { deletedCount } = await clearClashTestResults(test.id);
      setClashes([]);
      setRunStats(null);
      setPreviewHits([]);
      setSelectedClashId(null);
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
      await args.engine?.clearClashReviewPresentation();
      toast.success(
        deletedCount > 0
          ? `Cleared ${deletedCount.toLocaleString()} clash${deletedCount === 1 ? "" : "es"}`
          : "Clash results cleared",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset clash results");
    }
  }, [activeTest, args.engine]);

  const attachClashSnapshotToIssue = useCallback(
    async (issueId: string, clash: BimClashRow): Promise<boolean> => {
      const dataUrl = args.engine ? await args.engine.captureSnapshot() : null;
      if (!dataUrl) return false;
      const file = dataUrlToFile(dataUrl, `clash-${clash.id.slice(0, 8)}.jpg`);
      await uploadIssueReferencePhotoFile(issueId, file);
      return true;
    },
    [args.engine],
  );

  const createIssueFromClash = useCallback(
    async (clash: BimClashRow) => {
      if (!args.projectId) {
        toast.error("Missing project context for issue creation.");
        return;
      }
      if (clash.issueId) {
        toast.message("This clash already has a linked issue.");
        return;
      }
      setCreatingIssue(true);
      try {
        const workspaceId = await resolveWorkspaceId(args.projectId);
        const anchor: IssueBimAnchor = {
          ifcGuid: clash.guidA,
          name: clash.elementA?.name ?? undefined,
          ifcType: clash.elementA?.ifcType ?? undefined,
          position: clash.point,
        };
        const issue = await createIssue({
          workspaceId,
          projectId: args.projectId,
          fileId: args.fileId,
          fileVersionId: clash.fileVersionAId || args.fileVersionId || undefined,
          title: `Clash: ${clashElementLabel(clash.elementA, clash.guidA)} × ${clashElementLabel(clash.elementB, clash.guidB)}`,
          description: clashIssueDescription(clash),
          bimAnchor: anchor,
          priority: clash.clashType === "HARD" ? "HIGH" : "MEDIUM",
        });
        const updated = await patchClash(clash.id, { issueId: issue.id });
        setClashes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

        let photoAttached = false;
        try {
          photoAttached = await attachClashSnapshotToIssue(issue.id, clash);
        } catch {
          /* issue is created; photo is best-effort */
        }
        toast.success(
          photoAttached ? "Issue created from clash with snapshot" : "Issue created from clash",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create issue");
      } finally {
        setCreatingIssue(false);
      }
    },
    [args.projectId, args.fileId, args.fileVersionId, attachClashSnapshotToIssue],
  );

  const bulkCreateIssueFromGroup = useCallback(
    async (groupClashes: BimClashRow[]) => {
      if (!args.projectId || groupClashes.length === 0) return;
      const first = groupClashes[0]!;
      setCreatingIssue(true);
      try {
        const workspaceId = await resolveWorkspaceId(args.projectId);
        const issue = await createIssue({
          workspaceId,
          projectId: args.projectId,
          fileId: args.fileId,
          fileVersionId: first.fileVersionAId || args.fileVersionId || undefined,
          title: `Clash group · ${groupClashes.length} clashes`,
          description: [
            `Group of ${groupClashes.length} clashes`,
            "",
            ...groupClashes
              .slice(0, 8)
              .map(
                (c) =>
                  `• ${clashElementLabel(c.elementA, c.guidA)} × ${clashElementLabel(c.elementB, c.guidB)} · ${formatClashDistanceDetail(c.clashType, c.distanceMm)}`,
              ),
            groupClashes.length > 8 ? `…and ${groupClashes.length - 8} more` : null,
            "",
            clashIssueDescription(first),
          ]
            .filter(Boolean)
            .join("\n"),
          bimAnchor: {
            ifcGuid: first.guidA,
            name: first.elementA?.name ?? undefined,
            ifcType: first.elementA?.ifcType ?? undefined,
            position: first.point,
          },
          priority: "HIGH",
        });
        const updated = await bulkPatchClashes(first.testId, {
          clashIds: groupClashes.map((c) => c.id),
          issueId: issue.id,
        });
        const byId = new Map(updated.map((c) => [c.id, c]));
        setClashes((prev) => prev.map((c) => byId.get(c.id) ?? c));

        try {
          await attachClashSnapshotToIssue(issue.id, first);
        } catch {
          /* best-effort photo */
        }
        toast.success(`Linked ${groupClashes.length} clashes to one issue`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create group issue");
      } finally {
        setCreatingIssue(false);
      }
    },
    [args.projectId, args.fileId, args.fileVersionId, attachClashSnapshotToIssue],
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
    creatingIssue,
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
    createIssueFromClash,
    bulkCreateIssueFromGroup,
  };
}
