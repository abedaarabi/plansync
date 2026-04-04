"use client";

import { apiUrl } from "@/lib/api-url";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FilePlus2,
  FileUp,
  GitBranchPlus,
  History,
  Link2,
  Loader2,
  SearchCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { carryForwardIssues, previewUploadMatches, type UploadPreviewRow } from "@/lib/api-client";
import { mergeUploadedFileIntoProject } from "@/lib/projectsCache";
import { qk } from "@/lib/queryKeys";
import type { CloudFile, FileVersion } from "@/types/projects";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";

type StagedFile = { id: string; file: File };
type PreviewState = UploadPreviewRow & {
  stageId: string;
  overrideMode: "auto" | "link" | "new";
  overrideFileId: string | null;
};

type UploadResult = {
  uploadedCount: number;
  newVersionCount: number;
  newSheetCount: number;
  carriedIssueCount: number;
};

function stageIdFor(file: File, i: number): string {
  return `${file.name}::${file.size}::${file.lastModified}::${i}`;
}

function uploadPdfWithProgress(input: {
  file: File;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  fileName: string;
  onProgress: (pct: number) => void;
}): Promise<{
  file: {
    id: string;
    name: string;
    mimeType: string;
    folderId: string | null;
    updatedAt?: string;
  };
  fileVersion: FileVersion;
}> {
  const fd = new FormData();
  fd.append("workspaceId", input.workspaceId);
  fd.append("projectId", input.projectId);
  if (input.folderId) fd.append("folderId", input.folderId);
  fd.append("fileName", input.fileName);
  fd.append("file", input.file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/v1/files/upload"));
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        input.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid upload response."));
        }
        return;
      }
      try {
        const j = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(j.error ?? `Upload failed (${xhr.status}).`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error."));
    xhr.send(fd);
  });
}

export function UploadDrawingsWizard(props: {
  open: boolean;
  onClose: () => void;
  initialFiles: File[];
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  existingFiles: CloudFile[];
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [staged, setStaged] = useState<StagedFile[]>(
    props.initialFiles.map((file, i) => ({ id: stageIdFor(file, i), file })),
  );
  const [previewRows, setPreviewRows] = useState<PreviewState[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [applyCarryToAll, setApplyCarryToAll] = useState(true);
  const [carryByStageId, setCarryByStageId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!props.open) return;
    setStep(1);
    setPreviewRows([]);
    setLoadingPreview(false);
    setPublishing(false);
    setProgressLabel(null);
    setApplyCarryToAll(true);
    setCarryByStageId({});
    setStaged(props.initialFiles.map((file, i) => ({ id: stageIdFor(file, i), file })));
  }, [props.open, props.initialFiles]);

  const hasCarryCandidates = previewRows.some(
    (row) =>
      row.kind === "new_version" && row.issueCountOnLatestVersion > 0 && row.fromFileVersionId,
  );

  const existingNameById = useMemo(() => {
    const out = new Map<string, string>();
    for (const f of props.existingFiles) out.set(f.id, f.name);
    return out;
  }, [props.existingFiles]);

  function resetAndClose() {
    setStep(1);
    setPreviewRows([]);
    setLoadingPreview(false);
    setPublishing(false);
    setProgressLabel(null);
    setApplyCarryToAll(true);
    setCarryByStageId({});
    props.onClose();
  }

  async function runPreview() {
    if (staged.length === 0) {
      toast.error("Add at least one file.");
      return;
    }
    setLoadingPreview(true);
    try {
      const data = await previewUploadMatches({
        projectId: props.projectId,
        folderId: props.folderId,
        candidates: staged.map((s) => ({ clientName: s.file.name })),
      });
      const next: PreviewState[] = data.rows.map((row, i) => ({
        ...row,
        stageId: staged[i]!.id,
        overrideMode: "auto",
        overrideFileId: row.matchedFile?.id ?? null,
      }));
      setPreviewRows(next);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not review uploads.");
    } finally {
      setLoadingPreview(false);
    }
  }

  function resolvedRow(row: PreviewState): { fileName: string; kind: "new_sheet" | "new_version" } {
    if (row.overrideMode === "new") return { fileName: row.clientName, kind: "new_sheet" };
    if (row.overrideMode === "link" && row.overrideFileId) {
      const linked = existingNameById.get(row.overrideFileId);
      if (linked) return { fileName: linked, kind: "new_version" };
      return { fileName: row.clientName, kind: "new_sheet" };
    }
    if (row.kind === "new_version" && row.matchedFile) {
      return { fileName: row.matchedFile.name, kind: "new_version" };
    }
    return { fileName: row.clientName, kind: "new_sheet" };
  }

  async function publish() {
    setPublishing(true);
    const summary: UploadResult = {
      uploadedCount: 0,
      newVersionCount: 0,
      newSheetCount: 0,
      carriedIssueCount: 0,
    };
    try {
      for (let i = 0; i < staged.length; i += 1) {
        const stagedFile = staged[i]!;
        const row = previewRows.find((r) => r.stageId === stagedFile.id);
        if (!row) continue;
        const resolved = resolvedRow(row);
        setProgressLabel(`Uploading ${stagedFile.file.name} (${i + 1}/${staged.length})`);
        const upload = await uploadPdfWithProgress({
          file: stagedFile.file,
          workspaceId: props.workspaceId,
          projectId: props.projectId,
          folderId: props.folderId,
          fileName: resolved.fileName,
          onProgress: () => undefined,
        });
        mergeUploadedFileIntoProject(
          queryClient,
          props.workspaceId,
          props.projectId,
          upload.file,
          upload.fileVersion,
        );
        summary.uploadedCount += 1;
        if (resolved.kind === "new_version") summary.newVersionCount += 1;
        else summary.newSheetCount += 1;

        const shouldCarry =
          resolved.kind === "new_version" &&
          Boolean(row.fromFileVersionId) &&
          row.issueCountOnLatestVersion > 0 &&
          (applyCarryToAll || carryByStageId[row.stageId]);
        if (shouldCarry && row.fromFileVersionId) {
          setProgressLabel(`Carrying issues for ${resolved.fileName}`);
          const carry = await carryForwardIssues(upload.fileVersion.id, row.fromFileVersionId);
          summary.carriedIssueCount += carry.copiedIssueCount;
        }
      }

      await queryClient.invalidateQueries({ queryKey: qk.projects(props.workspaceId) });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard(props.workspaceId) });
      await queryClient.invalidateQueries({ queryKey: qk.projectAudit(props.projectId) });
      await queryClient.invalidateQueries({ queryKey: qk.me() });

      toast.success(
        `${summary.newVersionCount} new versions, ${summary.newSheetCount} new sheets, ${summary.carriedIssueCount} issues carried forward.`,
      );
      resetAndClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
      setProgressLabel(null);
    }
  }

  const header =
    step === 1 ? (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Step 1 of 3</p>
        <h2 className="text-base font-semibold text-[var(--enterprise-text)]">Upload drawings</h2>
      </div>
    ) : step === 2 ? (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Step 2 of 3</p>
        <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
          Review version detection
        </h2>
      </div>
    ) : (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Step 3 of 3</p>
        <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
          Carry forward existing issues
        </h2>
      </div>
    );

  return (
    <EnterpriseSlideOver
      open={props.open}
      onClose={resetAndClose}
      header={header}
      footer={
        step === 1 ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={resetAndClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loadingPreview || staged.length === 0}
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void runPreview()}
            >
              {loadingPreview ? "Checking..." : "Next →"}
            </button>
          </>
        ) : step === 2 ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(1)}
              disabled={publishing}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => (hasCarryCandidates ? setStep(3) : void publish())}
              disabled={publishing}
            >
              {publishing ? "Publishing..." : hasCarryCandidates ? "Next →" : "Publish →"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(2)}
              disabled={publishing}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void publish()}
              disabled={publishing}
            >
              {publishing ? "Publishing..." : "Publish →"}
            </button>
          </>
        )
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 text-xs">
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${step === 1 ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${step === 2 ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          <SearchCheck className="h-3.5 w-3.5" />
          Detect
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${step === 3 ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          <GitBranchPlus className="h-3.5 w-3.5" />
          Carry
        </div>
      </div>

      {step === 1 ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700">
              Add files
            </div>
            <div className="p-4">
              <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-600 transition hover:border-slate-400">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const incoming = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
                    if (incoming.length === 0) return;
                    setStaged((prev) => [
                      ...prev,
                      ...incoming.map((file, i) => ({
                        id: stageIdFor(file, prev.length + i),
                        file,
                      })),
                    ]);
                    e.currentTarget.value = "";
                  }}
                />
                Drop files here or click to browse
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700">
              Selected files ({staged.length})
            </div>
            <ul className="space-y-2 p-4">
              {staged.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FilePlus2 className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate">{s.file.name}</span>
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    onClick={() => setStaged((prev) => prev.filter((x) => x.id !== s.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Uploaded file</span>
            <span>Detected</span>
            <span>Action</span>
          </div>
          <div className="space-y-2 p-3">
            {previewRows.map((row) => (
              <div key={row.stageId} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0 font-medium text-[var(--enterprise-text)]">
                    {row.clientName}
                  </div>
                  <div className="text-slate-600">
                    {resolvedRow(row).kind === "new_version" ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          New version
                        </span>
                        <div>
                          <span>→ {resolvedRow(row).fileName}</span>
                          <span className="ml-2">
                            v{row.currentMaxVersion ?? 1} → v{(row.currentMaxVersion ?? 1) + 1}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        New sheet
                      </span>
                    )}
                    <span className="ml-2 text-xs">score {row.score.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`rounded-lg border px-2 py-1 text-xs ${row.overrideMode === "auto" ? "bg-slate-100" : ""}`}
                      onClick={() =>
                        setPreviewRows((prev) =>
                          prev.map((r) =>
                            r.stageId === row.stageId ? { ...r, overrideMode: "auto" } : r,
                          ),
                        )
                      }
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-2 py-1 text-xs ${row.overrideMode === "new" ? "bg-slate-100" : ""}`}
                      onClick={() =>
                        setPreviewRows((prev) =>
                          prev.map((r) =>
                            r.stageId === row.stageId
                              ? { ...r, overrideMode: "new", overrideFileId: null }
                              : r,
                          ),
                        )
                      }
                    >
                      New
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <select
                    className="w-full rounded-lg border px-2 py-1 text-xs"
                    value={row.overrideFileId ?? ""}
                    onChange={(e) => {
                      const nextId = e.target.value || null;
                      setPreviewRows((prev) =>
                        prev.map((r) =>
                          r.stageId === row.stageId
                            ? {
                                ...r,
                                overrideMode: nextId ? "link" : "new",
                                overrideFileId: nextId,
                              }
                            : r,
                        ),
                      );
                    }}
                  >
                    <option value="">Link to existing...</option>
                    {props.existingFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <input
              type="checkbox"
              checked={applyCarryToAll}
              onChange={(e) => setApplyCarryToAll(e.target.checked)}
            />
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-slate-500" />
              Apply to all sheets with existing issues
            </span>
          </label>
          {!applyCarryToAll &&
            previewRows
              .filter(
                (r) =>
                  resolvedRow(r).kind === "new_version" &&
                  r.issueCountOnLatestVersion > 0 &&
                  r.fromFileVersionId,
              )
              .map((r) => (
                <label
                  key={r.stageId}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <span>
                    {resolvedRow(r).fileName} ({r.issueCountOnLatestVersion} issues on previous
                    version)
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(carryByStageId[r.stageId])}
                    onChange={(e) =>
                      setCarryByStageId((prev) => ({ ...prev, [r.stageId]: e.target.checked }))
                    }
                  />
                </label>
              ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
        <p className="mb-2 font-semibold text-slate-800">Rules guaranteed</p>
        <div className="grid gap-1 md:grid-cols-2">
          <span className="inline-flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-slate-500" />
            Old versions are preserved and never deleted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-slate-500" />
            Issues stay linked to the version they were created on
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
            Viewer opens latest version by default
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GitBranchPlus className="h-3.5 w-3.5 text-slate-500" />
            Version picker keeps all revisions (v1, v2, v3...)
          </span>
          <span className="inline-flex items-center gap-1.5 md:col-span-2">
            <SearchCheck className="h-3.5 w-3.5 text-slate-500" />
            Matching uses filename similarity, not exact equality
          </span>
        </div>
      </div>

      {publishing ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{progressLabel ?? "Publishing uploads..."}</span>
        </div>
      ) : null}
    </EnterpriseSlideOver>
  );
}
