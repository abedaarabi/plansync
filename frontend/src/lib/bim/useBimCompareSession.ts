"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchResolvedFileRevision } from "@/lib/api-client";
import { fetchBimElementChanges, fetchBimElementCompare } from "@/lib/api-client/bim-viewer";
import { qk } from "@/lib/queryKeys";
import {
  DEFAULT_COMPARE_VISIBLE_KINDS,
  compareChangedCount,
  filterCompareRows,
  listCompareIfcTypes,
  pickDefaultBaseVersion,
  type BimCompareKind,
  type BimCompareVisibleKinds,
  type BimElementChanges,
} from "@/lib/bim/bimCompare";
import { loadFederationMember } from "@/lib/bim/loadFederationModel";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";

// fallow-ignore-next-line complexity
async function syncCompareScene(opts: {
  engine: BimEngine;
  fileId: string;
  fileName: string;
  currentFileVersionId: string;
  baseFileVersionId: string | null;
  overlayFvRef: { current: string | null };
  setOverlayLoading: (v: boolean) => void;
  isolate: boolean;
  visibleKinds: BimCompareVisibleKinds;
  changes: BimElementChanges;
  deletedGuids: string[];
  needsOverlay: boolean;
  isCancelled: () => boolean;
}): Promise<void> {
  const overlayId = opts.needsOverlay ? opts.baseFileVersionId : null;
  if (opts.overlayFvRef.current && opts.overlayFvRef.current !== overlayId) {
    await opts.engine.removeCompareOverlay();
    opts.overlayFvRef.current = null;
  }
  if (opts.isCancelled()) return;
  if (overlayId && opts.overlayFvRef.current !== overlayId) {
    opts.engine.beginCompareOverlay(overlayId);
    opts.setOverlayLoading(true);
    try {
      await loadFederationMember(
        opts.engine,
        {
          fileId: opts.fileId,
          fileVersionId: overlayId,
          name: `${opts.fileName} (previous)`,
        },
        { fitView: false },
      );
      if (opts.isCancelled()) return;
      opts.overlayFvRef.current = overlayId;
    } catch {
      if (!opts.isCancelled()) opts.overlayFvRef.current = null;
    } finally {
      if (!opts.isCancelled()) opts.setOverlayLoading(false);
    }
  }
  if (opts.isCancelled()) return;
  await opts.engine.applyComparePresentation({
    isolate: opts.isolate,
    currentFileVersionId: opts.currentFileVersionId,
    overlayFileVersionId: opts.overlayFvRef.current,
    addedGuids: opts.visibleKinds.added ? opts.changes.added.map((r) => r.guid) : [],
    modifiedGuids: opts.visibleKinds.modified ? opts.changes.modified.map((r) => r.guid) : [],
    deletedGuids: opts.deletedGuids,
  });
}

// fallow-ignore-next-line complexity
export function useBimCompareSession(opts: {
  enabled: boolean;
  fileId: string;
  fileName: string;
  currentFileVersionId: string | null;
  initialBaseFileVersionId?: string | null;
  engine: BimEngine | null;
  pickedGuid: string | null;
}) {
  const [baseFileVersionId, setBaseFileVersionId] = useState<string | null>(
    opts.initialBaseFileVersionId ?? null,
  );
  const [isolate, setIsolate] = useState(false);
  const [visibleKinds, setVisibleKinds] = useState<BimCompareVisibleKinds>(
    DEFAULT_COMPARE_VISIBLE_KINDS,
  );
  const [query, setQuery] = useState("");
  const [ifcType, setIfcType] = useState<string | null>(null);
  const [listGuid, setListGuid] = useState<string | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const overlayFvRef = useRef<string | null>(null);

  const revisionsQuery = useQuery({
    queryKey: qk.fileRevisions(opts.fileId),
    queryFn: () => fetchResolvedFileRevision(opts.fileId),
    enabled: opts.enabled && Boolean(opts.fileId),
    staleTime: 30_000,
  });

  const versions = revisionsQuery.data?.versions ?? [];
  const currentId = opts.currentFileVersionId;

  useEffect(() => {
    if (!opts.enabled || !currentId || versions.length === 0) return;
    setBaseFileVersionId((prev) => {
      if (prev && prev !== currentId && versions.some((v) => v.id === prev)) return prev;
      return pickDefaultBaseVersion(versions, currentId, opts.initialBaseFileVersionId);
    });
  }, [opts.enabled, currentId, versions, opts.initialBaseFileVersionId]);

  const changesQuery = useQuery({
    queryKey: qk.bimElementChanges(currentId ?? "", baseFileVersionId ?? ""),
    queryFn: () => fetchBimElementChanges(currentId!, baseFileVersionId!),
    enabled:
      opts.enabled && Boolean(currentId && baseFileVersionId && currentId !== baseFileVersionId),
  });

  const selectedGuid = listGuid ?? opts.pickedGuid;
  const changes = changesQuery.data ?? null;
  const selectedKind = useMemo(() => {
    if (!selectedGuid || !changes) return null;
    if (changes.added.some((r) => r.guid === selectedGuid)) return "added" as const;
    if (changes.modified.some((r) => r.guid === selectedGuid)) return "modified" as const;
    if (changes.deleted.some((r) => r.guid === selectedGuid)) return "deleted" as const;
    return null;
  }, [changes, selectedGuid]);

  const fieldDiffQuery = useQuery({
    queryKey: qk.bimElementCompare(currentId ?? "", baseFileVersionId ?? "", selectedGuid ?? ""),
    queryFn: () => fetchBimElementCompare(currentId!, baseFileVersionId!, selectedGuid!),
    enabled:
      opts.enabled && Boolean(currentId && baseFileVersionId && selectedGuid && selectedKind),
  });

  const rows = useMemo(
    () => filterCompareRows(changes, { query, ifcType, visibleKinds }),
    [changes, query, ifcType, visibleKinds],
  );
  const ifcTypes = useMemo(() => listCompareIfcTypes(changes), [changes]);
  const changedCount = compareChangedCount(changes?.counts);
  const deletedGuids = useMemo(
    () => (visibleKinds.deleted ? (changes?.deleted.map((r) => r.guid) ?? []) : []),
    [changes, visibleKinds.deleted],
  );
  const needsOverlay = deletedGuids.length > 0;

  useEffect(() => {
    const engine = opts.engine;
    if (!opts.enabled || !engine || !currentId || !changes) {
      if (!opts.enabled) {
        overlayFvRef.current = null;
        void engine?.clearComparePresentation();
        setOverlayLoading(false);
      }
      return;
    }

    let cancelled = false;
    void syncCompareScene({
      engine,
      fileId: opts.fileId,
      fileName: opts.fileName,
      currentFileVersionId: currentId,
      baseFileVersionId,
      overlayFvRef,
      setOverlayLoading,
      isolate,
      visibleKinds,
      changes,
      deletedGuids,
      needsOverlay,
      isCancelled: () => cancelled,
    });

    return () => {
      cancelled = true;
    };
  }, [
    opts.enabled,
    opts.engine,
    opts.fileId,
    opts.fileName,
    currentId,
    baseFileVersionId,
    changes,
    isolate,
    visibleKinds,
    deletedGuids,
    needsOverlay,
  ]);

  useEffect(() => {
    return () => {
      overlayFvRef.current = null;
      void opts.engine?.clearComparePresentation();
    };
  }, [opts.engine]);

  const toggleKind = useCallback((kind: BimCompareKind) => {
    setVisibleKinds((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }, []);

  return {
    versions,
    currentFileVersionId: currentId,
    baseFileVersionId,
    setBaseFileVersionId,
    isolate,
    setIsolate,
    visibleKinds,
    toggleKind,
    query,
    setQuery,
    ifcType,
    setIfcType,
    ifcTypes,
    rows,
    selectedGuid,
    setListGuid,
    changes,
    changedCount,
    overlayLoading,
    revisionsPending: revisionsQuery.isPending,
    changesPending: changesQuery.isPending,
    changesError: changesQuery.error instanceof Error ? changesQuery.error.message : null,
    fieldDiff: fieldDiffQuery.data ?? null,
    fieldDiffPending: fieldDiffQuery.isPending,
    selectedKind,
  };
}
