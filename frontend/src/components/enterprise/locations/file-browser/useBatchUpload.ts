"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadBuildingAsset, type BuildingDiscipline } from "@/lib/api-client/locations";
import { useBimJobTracker } from "@/lib/bim/bimJobTracker";
import { invalidateBuildingQueries } from "@/lib/locations/useBuildingQueries";
import { assetTypeFromKind, kindFromName, MAX_UPLOAD_BYTES, type FileKind } from "./fileKind";

export type UploadRowStatus = "queued" | "uploading" | "processing" | "ready" | "failed";

export type UploadRow = {
  id: string;
  file: File;
  kind: FileKind;
  /** Relative path segments for folder drops, e.g. ["Arch", "L1.pdf"]. */
  path: string[];
  discipline: BuildingDiscipline;
  status: UploadRowStatus;
  progress: number;
  error: string | null;
  fileVersionId: string | null;
};

const CONCURRENCY = 3;

function makeId(file: File, path: string[]): string {
  return `${path.join("/") || file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function useBatchUpload(params: {
  buildingId: string;
  projectId: string;
  workspaceId: string;
  locationId: string;
}) {
  const { buildingId, projectId, workspaceId, locationId } = params;
  const qc = useQueryClient();
  const upsertJob = useBimJobTracker((s) => s.upsertJob);

  const [rows, setRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const rowsRef = useRef<UploadRow[]>([]);
  rowsRef.current = rows;

  const patchRow = useCallback((id: string, patch: Partial<UploadRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addFiles = useCallback((files: Array<{ file: File; path?: string[] }>) => {
    const next: UploadRow[] = files.map(({ file, path }) => {
      const segments = path && path.length > 0 ? path : [file.name];
      const kind = kindFromName(file.name);
      return {
        id: makeId(file, segments),
        file,
        kind,
        path: segments,
        discipline: null,
        status: file.size > MAX_UPLOAD_BYTES ? "failed" : "queued",
        progress: 0,
        error: file.size > MAX_UPLOAD_BYTES ? "File exceeds 500 MB limit" : null,
        fileVersionId: null,
      };
    });
    setRows((prev) => {
      const seen = new Set(prev.map((r) => `${r.file.name}-${r.file.size}`));
      const deduped = next.filter((r) => !seen.has(`${r.file.name}-${r.file.size}`));
      return [...prev, ...deduped];
    });
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clear = useCallback(() => {
    setRows([]);
  }, []);

  const uploadOne = useCallback(
    async (row: UploadRow) => {
      const type = assetTypeFromKind(row.kind);
      patchRow(row.id, { status: "uploading", progress: 0, error: null });
      try {
        const result = await uploadBuildingAsset(
          buildingId,
          row.file,
          type,
          workspaceId,
          row.discipline ?? null,
          (pct) => patchRow(row.id, { progress: pct }),
        );
        if (type === "IFC") {
          upsertJob({
            fileVersionId: result.fileVersionId,
            fileId: result.fileId,
            fileName: row.file.name,
            projectId,
            workspaceId,
            phase: "registering",
            uploadPct: 100,
            indexProgress: null,
            indexPhase: null,
            conversionStatus: "pending",
            error: null,
            startedAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        patchRow(row.id, {
          status: type === "OTHER" ? "ready" : "processing",
          progress: 100,
          fileVersionId: result.fileVersionId,
        });
      } catch (e) {
        patchRow(row.id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Upload failed",
        });
      }
    },
    [buildingId, workspaceId, projectId, patchRow, upsertJob],
  );

  const startUpload = useCallback(async () => {
    const pending = rowsRef.current.filter((r) => r.status === "queued");
    if (pending.length === 0) return;
    setUploading(true);

    const queue = [...pending];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) break;
        await uploadOne(row);
      }
    });
    await Promise.all(workers);

    invalidateBuildingQueries(qc, buildingId, locationId);
    setUploading(false);
  }, [uploadOne, qc, buildingId, locationId]);

  const retryRow = useCallback(
    async (id: string) => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row || row.file.size > MAX_UPLOAD_BYTES) return;
      await uploadOne(row);
      invalidateBuildingQueries(qc, buildingId, locationId);
    },
    [uploadOne, qc, buildingId, locationId],
  );

  const setRowDiscipline = useCallback(
    (id: string, discipline: BuildingDiscipline) => {
      patchRow(id, { discipline });
    },
    [patchRow],
  );

  const queuedCount = rows.filter((r) => r.status === "queued").length;
  const settledCount = rows.filter(
    (r) => r.status === "ready" || r.status === "processing" || r.status === "failed",
  ).length;
  const allSettled = rows.length > 0 && settledCount === rows.length;

  return {
    rows,
    addFiles,
    removeRow,
    clear,
    startUpload,
    retryRow,
    setRowDiscipline,
    uploading,
    queuedCount,
    allSettled,
  };
}
